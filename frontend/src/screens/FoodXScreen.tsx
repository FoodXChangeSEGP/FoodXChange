/**
 * FoodX Search Screen
 * Product search with text queries and barcode scanning
 * Uses Open Food Facts API for UK product data
 * 
 * Fixes:
 * - Bug 1: Search relevance - now sorts by relevance (popularity) by default
 * - Bug 3: Filters and pagination support
 * - Bug 7: Loading state on re-search
 * - Bug 9: Text node error fixed
 * - Bug 10: Product detail modal with nutritional info
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '@/theme';
import { SearchBar, OFFProductCard, PlaceholderCard } from '@/components';
import { api, OFFProduct, OFFSearchOptions } from '@/services/api';
import { useSearchStore, useCartStore } from '@/store';

// Filter options
type SortOption = 'relevance' | 'nutriscore' | 'nova' | 'name';
type NutriScoreFilter = 'a' | 'b' | 'c' | 'd' | 'e';
type NovaFilter = 1 | 2 | 3 | 4;

interface FilterState {
  sortBy: SortOption;
  nutriscoreFilter: NutriScoreFilter[];
  novaFilter: NovaFilter[];
  excludeNoNova: boolean;
  excludeNoNutriscore: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  sortBy: 'relevance',
  nutriscoreFilter: [],
  novaFilter: [],
  excludeNoNova: false,
  excludeNoNutriscore: false,
};

export const FoodXScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Product detail modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OFFProduct | null>(null);
  
  // Healthy swap modal state
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [alternatives, setAlternatives] = useState<OFFProduct[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();
  const { addItem, isInCart } = useCartStore();

  const performSearch = useCallback(async (query: string, page: number = 1, append: boolean = false) => {
    if (!query.trim()) return;

    if (page === 1) {
      setIsSearching(true);
      setSearchResults([]);
    } else {
      setIsLoadingMore(true);
    }
    
    setHasSearched(true);
    if (page === 1) {
      addRecentSearch(query.trim());
    }

    try {
      const options: OFFSearchOptions = {
        page,
        page_size: 20,
        sort_by: filters.sortBy,
        nutriscore: filters.nutriscoreFilter.length > 0 ? filters.nutriscoreFilter : undefined,
        nova_group: filters.novaFilter.length > 0 ? filters.novaFilter : undefined,
        exclude_no_nova: filters.excludeNoNova,
        exclude_no_nutriscore: filters.excludeNoNutriscore,
      };

      const response = await api.off.search(query.trim(), options);
      
      if (append) {
        setSearchResults(prev => [...prev, ...response.results]);
      } else {
        setSearchResults(response.results);
      }
      
      setTotalCount(response.total_count);
      setCurrentPage(response.page);
      setTotalPages(response.total_pages);
      setHasNextPage(response.has_next);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search products. Please try again.');
      if (!append) {
        setSearchResults([]);
        setTotalCount(0);
      } else {
        // Reset page on load more failure to allow retry
        setCurrentPage(page - 1);
      }
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, [filters, addRecentSearch]);

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    performSearch(searchQuery, 1, false);
  }, [searchQuery, performSearch]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasNextPage && !isSearching) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage); // Update page immediately to prevent duplicate requests
      performSearch(searchQuery, nextPage, true);
    }
  }, [isLoadingMore, hasNextPage, isSearching, searchQuery, currentPage, performSearch]);

  const handleBarcodeScan = () => {
    Alert.alert(
      'Barcode Scanner',
      'Barcode scanning will be available in a future update.\n\nThis feature will allow you to scan product barcodes to instantly find nutrition information and compare prices.',
      [{ text: 'OK' }]
    );
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    performSearch(query, 1, false);
  };

  const handleProductPress = (product: OFFProduct) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
  };

  const handleAddToCart = (product: OFFProduct) => {
    addItem(product, 1);
    Alert.alert('Added to Cart', product.product_name + ' has been added to your cart.');
  };

  const handleSwapPress = async (product: OFFProduct) => {
    setSelectedProduct(product);
    setDetailModalVisible(false);
    setSwapModalVisible(true);
    setIsLoadingAlternatives(true);
    setAlternatives([]);

    try {
      const response = await api.off.getHealthySwap({ id: product.id, limit: 5 });
      setAlternatives(response.alternatives);
    } catch (error) {
      console.error('Healthy swap error:', error);
      Alert.alert('Error', 'Unable to find healthier alternatives.');
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  const applyFilters = useCallback(() => {
    setShowFilterModal(false);
    setCurrentPage(1);
    if (searchQuery.trim()) {
      performSearch(searchQuery, 1, false);
    }
  }, [searchQuery, performSearch]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const toggleNutriscore = (grade: NutriScoreFilter) => {
    setFilters(prev => ({
      ...prev,
      nutriscoreFilter: prev.nutriscoreFilter.includes(grade)
        ? prev.nutriscoreFilter.filter(g => g !== grade)
        : [...prev.nutriscoreFilter, grade],
    }));
  };

  const toggleNova = (group: NovaFilter) => {
    setFilters(prev => ({
      ...prev,
      novaFilter: prev.novaFilter.includes(group)
        ? prev.novaFilter.filter(g => g !== group)
        : [...prev.novaFilter, group],
    }));
  };

  const getTrafficLightColor = (level: string): string => {
    const colorMap: Record<string, string> = {
      green: '#22C55E',
      amber: '#F59E0B',
      red: '#EF4444',
      unknown: colors.neutral.lightGray,
    };
    return colorMap[level] || colors.neutral.lightGray;
  };

  const renderProductDetailModal = () => {
    if (!selectedProduct) return null;

    const nutriColor = {
      a: colors.nutriScore.A,
      b: colors.nutriScore.B,
      c: colors.nutriScore.C,
      d: colors.nutriScore.D,
      e: colors.nutriScore.E,
      unknown: colors.neutral.gray,
    }[selectedProduct.nutriscore_grade] || colors.neutral.gray;

    const novaColor = selectedProduct.nova_group
      ? colors.nova[selectedProduct.nova_group as keyof typeof colors.nova]
      : colors.neutral.gray;

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Product Details</Text>
            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
            {/* Product Image */}
            <View style={styles.detailImageContainer}>
              {selectedProduct.image_url ? (
                <Image source={{ uri: selectedProduct.image_url }} style={styles.detailImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>🥗</Text>
                </View>
              )}
            </View>

            {/* Product Name & Brand */}
            <Text style={styles.detailName}>{selectedProduct.product_name}</Text>
            {selectedProduct.brands ? (
              <Text style={styles.detailBrand}>{selectedProduct.brands}</Text>
            ) : null}
            <Text style={styles.detailBarcode}>{'Barcode: ' + selectedProduct.code}</Text>

            {/* Scores */}
            <View style={styles.scoresSection}>
              <Text style={styles.sectionTitle}>Health Scores</Text>
              <View style={styles.scoresRow}>
                <View style={[styles.scoreBadgeLarge, { backgroundColor: nutriColor }]}>
                  <Text style={styles.scoreBadgeLabel}>Nutri-Score</Text>
                  <Text style={styles.scoreBadgeValue}>
                    {selectedProduct.nutriscore_grade.toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.scoreBadgeLarge, { backgroundColor: novaColor }]}>
                  <Text style={styles.scoreBadgeLabel}>NOVA Group</Text>
                  <Text style={styles.scoreBadgeValue}>
                    {selectedProduct.nova_group || '?'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Traffic Light Nutrients */}
            <View style={styles.nutrientsSection}>
              <Text style={styles.sectionTitle}>Nutrients per 100g</Text>
              
              <View style={styles.nutrientRow}>
                <View style={styles.nutrientInfo}>
                  <View
                    style={[
                      styles.trafficLightDot,
                      { backgroundColor: getTrafficLightColor(selectedProduct.traffic_light.sugars.level) },
                    ]}
                  />
                  <Text style={styles.nutrientLabel}>Sugars</Text>
                </View>
                <Text style={styles.nutrientValue}>
                  {selectedProduct.traffic_light.sugars.value ? selectedProduct.traffic_light.sugars.value + 'g' : 'N/A'}
                </Text>
              </View>

              <View style={styles.nutrientRow}>
                <View style={styles.nutrientInfo}>
                  <View
                    style={[
                      styles.trafficLightDot,
                      { backgroundColor: getTrafficLightColor(selectedProduct.traffic_light.fat.level) },
                    ]}
                  />
                  <Text style={styles.nutrientLabel}>Fat</Text>
                </View>
                <Text style={styles.nutrientValue}>
                  {selectedProduct.traffic_light.fat.value ? selectedProduct.traffic_light.fat.value + 'g' : 'N/A'}
                </Text>
              </View>

              <View style={styles.nutrientRow}>
                <View style={styles.nutrientInfo}>
                  <View
                    style={[
                      styles.trafficLightDot,
                      { backgroundColor: getTrafficLightColor(selectedProduct.traffic_light.saturated_fat.level) },
                    ]}
                  />
                  <Text style={styles.nutrientLabel}>Saturated Fat</Text>
                </View>
                <Text style={styles.nutrientValue}>
                  {selectedProduct.traffic_light.saturated_fat.value ? selectedProduct.traffic_light.saturated_fat.value + 'g' : 'N/A'}
                </Text>
              </View>

              <View style={styles.nutrientRow}>
                <View style={styles.nutrientInfo}>
                  <View
                    style={[
                      styles.trafficLightDot,
                      { backgroundColor: getTrafficLightColor(selectedProduct.traffic_light.salt.level) },
                    ]}
                  />
                  <Text style={styles.nutrientLabel}>Salt</Text>
                </View>
                <Text style={styles.nutrientValue}>
                  {selectedProduct.traffic_light.salt.value ? selectedProduct.traffic_light.salt.value + 'g' : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.addToCartButton]}
                onPress={() => {
                  handleAddToCart(selectedProduct);
                  setDetailModalVisible(false);
                }}
              >
                <Ionicons name="cart-outline" size={20} color={colors.neutral.white} />
                <Text style={styles.actionButtonText}>
                  {isInCart(selectedProduct.code) ? 'Add More' : 'Add to Cart'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.swapButtonStyle]}
                onPress={() => handleSwapPress(selectedProduct)}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.primary.dark} />
                <Text style={[styles.actionButtonText, { color: colors.primary.dark }]}>
                  Find Healthier
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filters & Sorting</Text>
          <TouchableOpacity
            onPress={() => setShowFilterModal(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent}>
          {/* Sort By */}
          <Text style={styles.filterSectionTitle}>Sort By</Text>
          <View style={styles.sortOptions}>
            {(['relevance', 'nutriscore', 'nova', 'name'] as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.sortOption,
                  filters.sortBy === option && styles.sortOptionActive,
                ]}
                onPress={() => setFilters(prev => ({ ...prev, sortBy: option }))}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    filters.sortBy === option && styles.sortOptionTextActive,
                  ]}
                >
                  {option === 'relevance' ? 'Relevance' :
                   option === 'nutriscore' ? 'Healthiest' :
                   option === 'nova' ? 'Least Processed' : 'Name A-Z'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nutri-Score Filter */}
          <Text style={styles.filterSectionTitle}>Nutri-Score</Text>
          <View style={styles.filterChips}>
            {(['a', 'b', 'c', 'd', 'e'] as NutriScoreFilter[]).map((grade) => (
              <TouchableOpacity
                key={grade}
                style={[
                  styles.filterChipLarge,
                  filters.nutriscoreFilter.includes(grade) && {
                    backgroundColor: colors.nutriScore[grade.toUpperCase() as keyof typeof colors.nutriScore],
                    borderColor: colors.nutriScore[grade.toUpperCase() as keyof typeof colors.nutriScore],
                  },
                ]}
                onPress={() => toggleNutriscore(grade)}
              >
                <Text
                  style={[
                    styles.filterChipLargeText,
                    filters.nutriscoreFilter.includes(grade) && styles.filterChipLargeTextActive,
                  ]}
                >
                  {grade.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* NOVA Group Filter */}
          <Text style={styles.filterSectionTitle}>NOVA Group</Text>
          <View style={styles.filterChips}>
            {([1, 2, 3, 4] as NovaFilter[]).map((group) => (
              <TouchableOpacity
                key={group}
                style={[
                  styles.filterChipLarge,
                  filters.novaFilter.includes(group) && {
                    backgroundColor: colors.nova[group],
                    borderColor: colors.nova[group],
                  },
                ]}
                onPress={() => toggleNova(group)}
              >
                <Text
                  style={[
                    styles.filterChipLargeText,
                    filters.novaFilter.includes(group) && styles.filterChipLargeTextActive,
                  ]}
                >
                  {String(group)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Exclusion Options */}
          <Text style={styles.filterSectionTitle}>Data Quality</Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFilters(prev => ({ ...prev, excludeNoNova: !prev.excludeNoNova }))}
          >
            <Ionicons
              name={filters.excludeNoNova ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.excludeNoNova ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={styles.checkboxLabel}>Only show products with NOVA score</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFilters(prev => ({ ...prev, excludeNoNutriscore: !prev.excludeNoNutriscore }))}
          >
            <Ionicons
              name={filters.excludeNoNutriscore ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.excludeNoNutriscore ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={styles.checkboxLabel}>Only show products with Nutri-Score</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.filterActions}>
          <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderSwapModal = () => (
    <Modal
      visible={swapModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSwapModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Healthier Alternatives</Text>
          <TouchableOpacity
            onPress={() => setSwapModalVisible(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
          </TouchableOpacity>
        </View>

        {selectedProduct ? (
          <View style={styles.originalProductSection}>
            <Text style={styles.sectionLabel}>Original Product</Text>
            <OFFProductCard product={selectedProduct} compact />
          </View>
        ) : null}

        <View style={styles.alternativesSection}>
          <Text style={styles.sectionLabel}>
            {isLoadingAlternatives ? 'Finding healthier options...' : 'Healthier Alternatives'}
          </Text>
          
          {isLoadingAlternatives ? (
            <ActivityIndicator size="large" color={colors.primary.dark} style={styles.loader} />
          ) : alternatives.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {alternatives.map((alt) => (
                <View key={alt.id} style={styles.alternativeItem}>
                  <OFFProductCard
                    product={alt}
                    onPress={handleProductPress}
                    onSwapPress={handleAddToCart}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noAlternatives}>
              <Ionicons name="leaf-outline" size={48} color={colors.neutral.gray} />
              <Text style={styles.noAlternativesText}>
                This is already a healthy choice! No better alternatives found.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.dark} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color={colors.neutral.gray} />
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptyText}>
            Try a different search term or adjust your filters
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.initialContainer}>
        {/* Category Quick Access */}
        <Text style={styles.sectionTitle}>Browse Categories</Text>
        <View style={styles.categoriesGrid}>
          {['Dairy', 'Bakery', 'Beverages', 'Snacks', 'Fresh', 'Pantry'].map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryCard}
              onPress={() => handleRecentSearch(category)}
            >
              <Ionicons
                name="grid-outline"
                size={24}
                color={colors.primary.dark}
              />
              <Text style={styles.categoryText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Searches */}
        {recentSearches.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearRecentSearches}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.slice(0, 5).map((search, index) => (
              <TouchableOpacity
                key={search + '-' + String(index)}
                style={styles.recentItem}
                onPress={() => handleRecentSearch(search)}
              >
                <Ionicons name="time-outline" size={20} color={colors.neutral.gray} />
                <Text style={styles.recentText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Scan Prompt */}
        <PlaceholderCard
          title="Scan a Barcode"
          description="Instantly find product info, nutrition scores, and compare prices across retailers"
          icon="barcode-outline"
          color={colors.accent.lime}
        />
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasNextPage) return null;
    
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary.dark} />
          <Text style={styles.footerText}>Loading more...</Text>
        </View>
      );
    }
    
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
        <Text style={styles.loadMoreText}>Load More</Text>
      </TouchableOpacity>
    );
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== 'relevance') count++;
    count += filters.nutriscoreFilter.length;
    count += filters.novaFilter.length;
    if (filters.excludeNoNova) count++;
    if (filters.excludeNoNutriscore) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FoodX Search</Text>
        <Text style={styles.headerSubtitle}>Find healthy, affordable food (UK)</Text>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmit={handleSearch}
        onBarcodeScan={handleBarcodeScan}
        placeholder="Search products, brands, or barcodes..."
      />

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFiltersCount > 0 ? colors.neutral.white : colors.primary.dark}
          />
          <Text style={[
            styles.filterButtonText,
            activeFiltersCount > 0 && styles.filterButtonTextActive
          ]}>
            {activeFiltersCount > 0 ? 'Filters (' + String(activeFiltersCount) + ')' : 'Filters'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.sortLabel}>
          {filters.sortBy === 'relevance' ? 'Sorted by: Relevance' :
           filters.sortBy === 'nutriscore' ? 'Sorted by: Healthiest' :
           filters.sortBy === 'nova' ? 'Sorted by: Least Processed' : 'Sorted by: Name'}
        </Text>
      </View>

      {/* Results or Empty State */}
      {hasSearched && searchResults.length > 0 ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultCount}>
            {String(totalCount) + ' products found' + (totalPages > 1 ? ' (page ' + String(currentPage) + ' of ' + String(totalPages) + ')' : '')}
          </Text>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.productItem}>
                <OFFProductCard
                  product={item}
                  onPress={handleProductPress}
                  onSwapPress={handleSwapPress}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={renderFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
          />
        </View>
      ) : (
        renderEmptyState()
      )}

      {/* Modals */}
      {renderProductDetailModal()}
      {renderFilterModal()}
      {renderSwapModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    backgroundColor: colors.neutral.offWhite,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    marginTop: spacing.xs,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary.dark,
  },
  filterButtonActive: {
    backgroundColor: colors.primary.dark,
  },
  filterButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.primary.dark,
    fontWeight: typography.fontWeight.medium,
  },
  filterButtonTextActive: {
    color: colors.neutral.white,
  },
  sortLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  productItem: {
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  initialContainer: {
    flex: 1,
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },
  categoryText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.charcoal,
    marginTop: spacing.xs,
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clearText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary.dark,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },
  recentText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
    marginLeft: spacing.sm,
  },
  resultsContainer: {
    flex: 1,
  },
  resultCount: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    marginLeft: spacing.sm,
    color: colors.neutral.darkGray,
    fontSize: typography.fontSize.sm,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.dark,
  },
  loadMoreText: {
    color: colors.primary.dark,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
    backgroundColor: colors.neutral.white,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  closeButton: {
    padding: spacing.xs,
  },
  // Product Detail Modal
  detailContent: {
    flex: 1,
    padding: spacing.base,
  },
  detailImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.neutral.lightGray,
  },
  detailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.lightGray,
  },
  imagePlaceholderText: {
    fontSize: 64,
  },
  detailName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
  },
  detailBrand: {
    fontSize: typography.fontSize.lg,
    color: colors.neutral.darkGray,
    marginBottom: spacing.xs,
  },
  detailBarcode: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.gray,
    marginBottom: spacing.lg,
  },
  scoresSection: {
    marginBottom: spacing.lg,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreBadgeLarge: {
    width: '45%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  scoreBadgeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.white,
    opacity: 0.9,
  },
  scoreBadgeValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
    marginTop: spacing.xs,
  },
  nutrientsSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },
  nutrientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trafficLightDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  nutrientLabel: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
  },
  nutrientValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing['2xl'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
  },
  addToCartButton: {
    backgroundColor: colors.primary.dark,
  },
  swapButtonStyle: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.primary.dark,
  },
  actionButtonText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.white,
  },
  // Filter Modal
  filterContent: {
    flex: 1,
    padding: spacing.base,
  },
  filterSectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sortOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },
  sortOptionActive: {
    backgroundColor: colors.primary.dark,
    borderColor: colors.primary.dark,
  },
  sortOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.charcoal,
  },
  sortOptionTextActive: {
    color: colors.neutral.white,
    fontWeight: typography.fontWeight.medium,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChipLarge: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.white,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipLargeText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  filterChipLargeTextActive: {
    color: colors.neutral.white,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkboxLabel: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
  },
  filterActions: {
    flexDirection: 'row',
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.lightGray,
    backgroundColor: colors.neutral.white,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.gray,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.neutral.darkGray,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.dark,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.neutral.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  // Swap Modal
  originalProductSection: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.darkGray,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alternativesSection: {
    flex: 1,
    padding: spacing.base,
  },
  alternativeItem: {
    marginBottom: spacing.md,
  },
  loader: {
    marginTop: spacing['2xl'],
  },
  noAlternatives: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  noAlternativesText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});

export default FoodXScreen;
