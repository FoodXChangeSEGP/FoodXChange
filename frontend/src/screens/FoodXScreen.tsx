import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, typography, textFont, glassShadows } from '@/theme';
import { GlassCard, GlassModal, GlassSearchBar, AnimatedPressable, ScoreBadge, PriceTag, ProductDetailModal, BarcodeScannerModal } from '@/components';
import { api, CombinedProduct, GrocerSearchOptions } from '@/services/api';
import { useSearchStore, useCartStore, useMyListStore, useAuthStore, useFavouritesStore } from '@/store';

type SortOption = 'relevance' | 'price' | 'name';

interface FilterState {
  sortBy: SortOption;
  showOnlyWithNutrition: boolean;
  showOnlyMultiRetailer: boolean;
  showOnlyFavourites: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  sortBy: 'relevance',
  showOnlyWithNutrition: false,
  showOnlyMultiRetailer: false,
  showOnlyFavourites: false,
};

export const FoodXScreen: React.FC = () => {
  const { colors, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CombinedProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CombinedProduct | null>(
    null
  );

  const [scannerVisible, setScannerVisible] = useState(false);
  const [isBarcodeLoading, setIsBarcodeLoading] = useState(false);

  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useSearchStore();
  const { addItem } = useCartStore();
  const { addItem: addToMyList, removeItem: removeFromMyList, isSaved, items: myListItems, updateQuantity: updateMyListQty } = useMyListStore();
  const { isAuthenticated } = useAuthStore();
  const { toggle: toggleFavourite, isFavourite } = useFavouritesStore();

  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

      setIsSearching(true);
      setSearchResults([]);
      setHasSearched(true);
      addRecentSearch(query.trim());

      try {
        const options: GrocerSearchOptions = {
          page_size: 30,
          include_nutrition: true,
        };

        const response = await api.grocers.search(query.trim(), options);

        // Deduplicate by barcode, merging prices from different retailers
        const barcodeMap = new Map<string, CombinedProduct>();
        for (const p of response.products) {
          const existing = barcodeMap.get(p.barcode);
          if (existing) {
            const newPrices = p.prices.filter(
              (np) => !existing.prices.some((ep) => ep.grocer_id === np.grocer_id),
            );
            existing.prices = [...existing.prices, ...newPrices];
            existing.retailer_count = existing.prices.length;
            if (
              p.cheapest_price &&
              (!existing.cheapest_price ||
                parseFloat(p.cheapest_price) < parseFloat(existing.cheapest_price))
            ) {
              existing.cheapest_price = p.cheapest_price;
              existing.cheapest_retailer = p.cheapest_retailer;
            }
            if (!existing.image_url && p.image_url) existing.image_url = p.image_url;
            if (!existing.has_off_match && p.has_off_match) {
              existing.has_off_match = p.has_off_match;
              existing.nutrition = p.nutrition;
            }
          } else {
            barcodeMap.set(p.barcode, { ...p });
          }
        }

        // Apply client-side filters
        let results = Array.from(barcodeMap.values());

        if (filters.showOnlyWithNutrition) {
          results = results.filter((p) => p.has_off_match);
        }

        if (filters.showOnlyMultiRetailer) {
          results = results.filter((p) => p.retailer_count > 1);
        }

        // Sort results
        if (filters.sortBy === 'price') {
          results = [...results].sort((a, b) => {
            const priceA = a.cheapest_price ? parseFloat(a.cheapest_price) : Infinity;
            const priceB = b.cheapest_price ? parseFloat(b.cheapest_price) : Infinity;
            return priceA - priceB;
          });
        } else if (filters.sortBy === 'name') {
          results = [...results].sort((a, b) => a.name.localeCompare(b.name));
        }
        // 'relevance' is already the default from the API

        setSearchResults(results);
        setTotalCount(response.total_products);
      } catch (error) {
        console.error('Search error:', error);
        Alert.alert('Search Error', 'Unable to search products. Please try again.');
        setSearchResults([]);
        setTotalCount(0);
      } finally {
        setIsSearching(false);
      }
    },
    [filters, addRecentSearch]
  );

  const handleSearch = useCallback(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  const handleBarcodeScan = () => {
    setScannerVisible(true);
  };

  const handleBarcodeResult = useCallback(
    async (barcode: string) => {
      setIsBarcodeLoading(true);
      try {
        // Use the cross-retailer comparison endpoint for the most complete result
        const product = await api.grocers.compareByBarcode(barcode);
        setScannerVisible(false);
        setSearchQuery(barcode);
        setSearchResults([product]);
        setHasSearched(true);
        setTotalCount(1);
      } catch (compareErr: any) {
        // If cross-retailer comparison fails, try OFF database
        try {
          const offProduct = await api.off.getByBarcode(barcode);
          setScannerVisible(false);
          // Convert OFF product to display-friendly format
          const combinedProduct: CombinedProduct = {
            barcode: offProduct.code,
            name: offProduct.product_name || 'Unknown Product',
            brand: offProduct.brands || null,
            description: '',
            categories: [],
            image_url: offProduct.image_url || null,
            prices: [],
            relevance_score: 1,
            retailer_count: 0,
            nutrition: {
              nutriscore_grade: offProduct.nutriscore_grade || 'unknown',
              nutriscore_display: offProduct.nutriscore_display || 'Unknown',
              nova_group: offProduct.nova_group,
              nova_display: offProduct.nova_display || 'Unknown',
              sugars_100g: offProduct.sugars_100g ?? null,
              salt_100g: offProduct.salt_100g ?? null,
              fat_100g: offProduct.fat_100g ?? null,
              saturated_fat_100g: offProduct.saturated_fat_100g ?? null,
              traffic_light: offProduct.traffic_light || {
                sugars: { value: null, level: 'unknown' as const },
                salt: { value: null, level: 'unknown' as const },
                fat: { value: null, level: 'unknown' as const },
                saturated_fat: { value: null, level: 'unknown' as const },
              },
            },
            has_off_match: true,
            cheapest_price: null,
            cheapest_retailer: null,
            price_comparison: null,
            has_nutrition_data: true,
          };
          setSearchQuery(barcode);
          setSearchResults([combinedProduct]);
          setHasSearched(true);
          setTotalCount(1);
        } catch {
          setScannerVisible(false);
          Alert.alert(
            'Product Not Found',
            `No product found for barcode ${barcode}. Try searching by name instead.`,
            [{ text: 'OK' }],
          );
        }
      } finally {
        setIsBarcodeLoading(false);
      }
    },
    [],
  );

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  const handleProductPress = (product: CombinedProduct) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
  };

  const handleConfirmSave = useCallback(
    async (product: CombinedProduct, qty: number) => {
      try {
        // addToMyList → fetchMyList → fetchPrices already syncs the cart,
        // so do NOT call addItem here — that would double the quantity.
        await addToMyList(product.barcode, product.name, qty);
      } catch {
        Alert.alert('Error', 'Failed to save item. Please try again.');
      }
    },
    [addToMyList],
  );

  const handleSavePress = useCallback(
    async (product: CombinedProduct, event?: any) => {
      if (event) event.stopPropagation?.();

      if (!isAuthenticated) {
        Alert.alert(
          'Sign In Required',
          'Please sign in from the Home tab to save items to My List.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (isSaved(product.barcode)) {
        await removeFromMyList(product.barcode);
      } else {
        await handleConfirmSave(product, 1);
      }
    },
    [removeFromMyList, isSaved, isAuthenticated],
  );

  const applyFilters = useCallback(() => {
    setShowFilterModal(false);
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  }, [searchQuery, performSearch]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const renderFilterModal = () => (
    <GlassModal
      visible={showFilterModal}
      onClose={() => setShowFilterModal(false)}
      title="Filters & Sorting"
    >
      <ScrollView style={styles.filterContent}>
        <Text style={[styles.filterSectionTitle, { color: colors.neutral.charcoal }]}>Sort By</Text>
        <View style={styles.sortOptions}>
          {(['relevance', 'price', 'name'] as SortOption[]).map((option) => (
            <AnimatedPressable
              key={option}
              onPress={() => setFilters((prev) => ({ ...prev, sortBy: option }))}
            >
              <View
                style={[
                  styles.sortOption,
                  {
                    backgroundColor: filters.sortBy === option ? colors.primary.main : colors.surface.glassOverlay,
                    borderColor: filters.sortBy === option ? colors.primary.main : colors.neutral.lightGray,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    { color: filters.sortBy === option ? colors.neutral.white : colors.neutral.charcoal }
                  ]}
                >
                  {option === 'relevance'
                    ? 'Relevance'
                    : option === 'price'
                    ? 'Lowest Price'
                    : 'Name A-Z'}
                </Text>
              </View>
            </AnimatedPressable>
          ))}
        </View>

        <Text style={[styles.filterSectionTitle, { color: colors.neutral.charcoal }]}>Filter Options</Text>

        <AnimatedPressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              showOnlyWithNutrition: !prev.showOnlyWithNutrition,
            }))
          }
        >
          <View style={styles.checkboxRow}>
            <Ionicons
              name={filters.showOnlyWithNutrition ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.showOnlyWithNutrition ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={[styles.checkboxLabel, { color: colors.neutral.charcoal }]}>Only show products with nutrition data</Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              showOnlyMultiRetailer: !prev.showOnlyMultiRetailer,
            }))
          }
        >
          <View style={styles.checkboxRow}>
            <Ionicons
              name={filters.showOnlyMultiRetailer ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.showOnlyMultiRetailer ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={[styles.checkboxLabel, { color: colors.neutral.charcoal }]}>Only show products at multiple retailers</Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() =>
            setFilters((prev) => ({
              ...prev,
              showOnlyFavourites: !prev.showOnlyFavourites,
            }))
          }
        >
          <View style={styles.checkboxRow}>
            <Ionicons
              name={filters.showOnlyFavourites ? 'star' : 'star-outline'}
              size={24}
              color={filters.showOnlyFavourites ? '#f59e0b' : colors.neutral.gray}
            />
            <Text style={[styles.checkboxLabel, { color: colors.neutral.charcoal }]}>Only show favourited products</Text>
          </View>
        </AnimatedPressable>
      </ScrollView>

      <View style={[styles.filterActions, { borderTopColor: colors.neutral.lightGray, backgroundColor: colors.surface.glassOverlay }]}>
        <AnimatedPressable onPress={resetFilters} style={{ flex: 1, marginRight: spacing.sm }}>
          <View style={[styles.resetButton, { borderColor: colors.neutral.gray }]}>
            <Text style={[styles.resetButtonText, { color: colors.neutral.darkGray }]}>Reset</Text>
          </View>
        </AnimatedPressable>
        <AnimatedPressable onPress={applyFilters} style={{ flex: 2 }}>
          <LinearGradient
            colors={[colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.applyButton}
          >
            <Text style={[styles.applyButtonText, { color: colors.neutral.white }]}>Apply Filters</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </GlassModal>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={[styles.emptyText, { color: colors.neutral.darkGray }]}>Searching Tesco & Sainsbury&apos;s...</Text>
        </View>
      );
    }

    if (hasSearched && displayResults.length === 0) {
      const noFavouritesMatch = filters.showOnlyFavourites && searchResults.length > 0;
      return (
        <View style={styles.emptyContainer}>
          <GlassCard blur="medium" padding="lg" style={styles.noResultsCard}>
            <Ionicons
              name={noFavouritesMatch ? 'star-outline' : 'search-outline'}
              size={64}
              color={colors.neutral.gray}
            />
            <Text style={[styles.emptyTitle, { color: colors.neutral.charcoal }]}>
              {noFavouritesMatch ? 'No Favourites in Results' : 'No Results Found'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.neutral.darkGray }]}>
              {noFavouritesMatch
                ? 'None of the search results are favourited yet'
                : 'Try a different search term or adjust your filters'}
            </Text>
          </GlassCard>
        </View>
      );
    }

    return (
      <View style={styles.initialContainer}>
        {recentSearches.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>Recent Searches</Text>
              <AnimatedPressable onPress={clearRecentSearches}>
                <Text style={[styles.clearText, { color: colors.primary.main }]}>Clear</Text>
              </AnimatedPressable>
            </View>
            {recentSearches.slice(0, 8).map((search, index) => (
              <AnimatedPressable
                key={search + '-' + String(index)}
                onPress={() => handleRecentSearch(search)}
              >
                <View style={[styles.recentItem, { borderBottomColor: colors.surface.glassBorder }]}>
                  <Ionicons name="time-outline" size={18} color={colors.neutral.gray} />
                  <Text style={[styles.recentText, { color: colors.neutral.charcoal }]}>{search}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.neutral.gray} style={{ marginLeft: 'auto' }} />
                </View>
              </AnimatedPressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyHintContainer}>
            <Ionicons name="search-outline" size={48} color={colors.neutral.lightGray} />
            <Text style={[styles.emptyHintTitle, { color: colors.neutral.charcoal }]}>
              Search for products
            </Text>
            <Text style={[styles.emptyHintText, { color: colors.neutral.darkGray }]}>
              Compare prices across Tesco and Sainsbury&apos;s
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderProductCard = ({ item }: { item: CombinedProduct }) => {
    const nutriscoreGrade = item.nutrition?.nutriscore_grade || 'unknown';
    const novaGroup = item.nutrition?.nova_group;
    const savedQty = myListItems.find(i => i.barcode === item.barcode)?.quantity ?? 1;

    return (
      <GlassCard blur="subtle" padding="sm" onPress={() => handleProductPress(item)} style={styles.productCard}>
        <View style={styles.cardRow}>
          <View style={[styles.cardImageContainer, { backgroundColor: colors.surface.glassOverlay }]}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.cardImage} />
            ) : (
              <View style={styles.cardImagePlaceholder}>
                <Ionicons name="cube-outline" size={32} color={colors.neutral.gray} />
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.cardName, { color: colors.neutral.charcoal }]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.brand ? (
              <Text style={[styles.cardBrand, { color: colors.neutral.darkGray }]} numberOfLines={1}>
                {item.brand}
              </Text>
            ) : null}

              <View style={styles.retailerTagsRow}>
              {item.prices.map((price, idx) => (
                <View key={idx} style={[styles.retailerTag, { borderColor: colors.neutral.lightGray, backgroundColor: colors.surface.glassOverlay }]}>
                  <Text style={[styles.retailerTagText, { color: colors.neutral.darkGray }]}>{price.grocer_name}</Text>
                </View>
              ))}
            </View>

            {item.cheapest_price ? (
              <Text style={[styles.cardCheapestPrice, { color: colors.neutral.charcoal }]}>
                From £{parseFloat(item.cheapest_price).toFixed(2)}
              </Text>
            ) : null}

            <View style={styles.cardBadges}>
              {item.has_off_match ? (
                <>
                  <ScoreBadge type="nutri" value={nutriscoreGrade} size="sm" />
                  {novaGroup ? (
                    <ScoreBadge type="nova" value={novaGroup} size="sm" />
                  ) : null}
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.cardActionsColumn}>
            <AnimatedPressable onPress={() => toggleFavourite(item.barcode)} style={styles.starButton}>
              <Ionicons
                name={isFavourite(item.barcode) ? 'star' : 'star-outline'}
                size={22}
                color={isFavourite(item.barcode) ? '#f59e0b' : colors.neutral.gray}
              />
            </AnimatedPressable>

            <AnimatedPressable onPress={() => { handleSavePress(item); }}>
              <View
                style={[
                  styles.cardMyListButton,
                  {
                    borderColor: colors.primary.main,
                    backgroundColor: isSaved(item.barcode) ? colors.primary.main : 'transparent',
                  }
                ]}
              >
                <Ionicons
                  name={isSaved(item.barcode) ? "checkmark" : "bookmark-outline"}
                  size={14}
                  color={isSaved(item.barcode) ? colors.neutral.white : colors.primary.main}
                />
                <Text
                  style={[
                    styles.cardMyListButtonText,
                    { color: isSaved(item.barcode) ? colors.neutral.white : colors.primary.main }
                  ]}
                >
                  {isSaved(item.barcode) ? "Saved" : "Save"}
                </Text>
              </View>
            </AnimatedPressable>

            {isSaved(item.barcode) && (
              <View style={styles.inlineQtyStepper}>
                <AnimatedPressable
                  onPress={() => updateMyListQty(item.barcode, savedQty - 1)}
                  style={[styles.inlineQtyBtn, { borderColor: colors.primary.main }]}
                >
                  <Ionicons name="remove" size={11} color={colors.primary.main} />
                </AnimatedPressable>
                <Text style={[styles.inlineQtyValue, { color: colors.neutral.charcoal }]}>
                  {savedQty}
                </Text>
                <AnimatedPressable
                  onPress={() => updateMyListQty(item.barcode, savedQty + 1)}
                  style={[styles.inlineQtyBtn, { borderColor: colors.primary.main }]}
                >
                  <Ionicons name="add" size={11} color={colors.primary.main} />
                </AnimatedPressable>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    );
  };

  const typingSuggestions = useMemo(() => {
    if (!searchQuery.trim() || hasSearched) return [];
    const q = searchQuery.toLowerCase();
    return recentSearches.filter((s) => s.toLowerCase().includes(q)).slice(0, 5);
  }, [searchQuery, recentSearches, hasSearched]);

  const displayResults = useMemo(() => {
    if (!filters.showOnlyFavourites) return searchResults;
    return searchResults.filter((p) => isFavourite(p.barcode));
  }, [searchResults, filters.showOnlyFavourites, isFavourite]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== 'relevance') count++;
    if (filters.showOnlyWithNutrition) count++;
    if (filters.showOnlyMultiRetailer) count++;
    if (filters.showOnlyFavourites) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>Search</Text>
      </View>

      <View style={styles.searchWrapper}>
        <GlassSearchBar
          value={searchQuery}
          onChangeText={(text) => { setSearchQuery(text); if (!text.trim()) setHasSearched(false); }}
          onSubmit={handleSearch}
          onBarcodeScan={handleBarcodeScan}
          placeholder="Search products, brands, or barcodes..."
        />
        {typingSuggestions.length > 0 && (
          <View style={[styles.suggestionsDropdown, {
            backgroundColor: colors.surface.elevated,
            borderColor: colors.surface.glassBorder,
          }]}>
            {typingSuggestions.map((suggestion, idx) => (
              <AnimatedPressable
                key={suggestion + String(idx)}
                onPress={() => { setSearchQuery(suggestion); performSearch(suggestion); }}
              >
                <View style={[
                  styles.suggestionItem,
                  idx < typingSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.surface.glassBorder },
                ]}>
                  <Ionicons name="time-outline" size={16} color={colors.neutral.gray} />
                  <Text style={[styles.suggestionText, { color: colors.neutral.charcoal }]}>{suggestion}</Text>
                  <Ionicons name="return-up-back-outline" size={14} color={colors.neutral.gray} style={{ marginLeft: 'auto' }} />
                </View>
              </AnimatedPressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.filterBar}>
        <AnimatedPressable onPress={() => setShowFilterModal(true)}>
          <View
            style={[
              styles.filterButton,
              {
                backgroundColor: activeFiltersCount > 0 ? colors.primary.main : 'transparent',
                borderColor: colors.primary.main,
              }
            ]}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFiltersCount > 0 ? colors.neutral.white : colors.primary.main}
            />
            <Text style={[
              styles.filterButtonText,
              { color: activeFiltersCount > 0 ? colors.neutral.white : colors.primary.main }
            ]}>
              {activeFiltersCount > 0 ? 'Filters (' + String(activeFiltersCount) + ')' : 'Filters'}
            </Text>
          </View>
        </AnimatedPressable>

        {hasSearched && (
          <Text style={[styles.sortLabel, { color: colors.neutral.darkGray }]}>
            {filters.sortBy === 'relevance' ? 'Sorted by: Relevance' :
            filters.sortBy === 'price' ? 'Sorted by: Lowest Price' : 'Sorted by: Name'}
          </Text>
        )}
      </View>

      {hasSearched && displayResults.length > 0 ? (
        <View style={styles.resultsContainer}>
          <Text style={[styles.resultCount, { color: colors.neutral.darkGray }]}>
            {filters.showOnlyFavourites
              ? `${String(displayResults.length)} favourite${displayResults.length === 1 ? '' : 's'}`
              : `${String(totalCount)} products found from Tesco & Sainsbury's`}
          </Text>
          <FlatList
            data={displayResults}
            keyExtractor={(item) => item.barcode}
            renderItem={renderProductCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
       ) : (
        renderEmptyState()
      )}

      <ProductDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        product={selectedProduct}
        isSaved={isSaved}
        onSavePress={handleSavePress}
      />
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => { setScannerVisible(false); setIsBarcodeLoading(false); }}
        onBarcodeScanned={handleBarcodeResult}
        isLoading={isBarcodeLoading}
      />
      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...textFont.bold,
    fontSize: typography.fontSize['3xl'],
  },
  searchWrapper: {
    zIndex: 10,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 64,
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 20,
    ...glassShadows.float,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  suggestionText: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
    flex: 1,
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
  },
  filterButtonText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  sortLabel: {
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 120,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  noResultsCard: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  initialContainer: {
    flex: 1,
    padding: spacing.base,
  },
  sectionTitle: {
    ...textFont.bold,
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.md,
  },
  emptyHintContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyHintTitle: {
    ...textFont.semibold,
    fontSize: typography.fontSize.xl,
    marginTop: spacing.md,
  },
  emptyHintText: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
    textAlign: 'center',
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
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  recentText: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
    flex: 1,
    marginLeft: spacing.xs,
  },
  resultsContainer: {
    flex: 1,
  },
  resultCount: {
    fontSize: typography.fontSize.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  productCard: {
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
  },
  cardImageContainer: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 20,
  },
  cardBrand: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  retailerTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  retailerTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  retailerTagText: {
    fontSize: typography.fontSize.xs,
  },
  cardCheapestPrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.xs,
  },
  cardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  multiStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  multiStoreBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginLeft: 2,
  },
  cardActionsColumn: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.xs,
  },
  starButton: {
    padding: spacing.xs,
  },
  cardMyListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  cardMyListButtonText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  cardAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  cardAddButtonText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  detailContent: {
    flex: 1,
    padding: spacing.base,
  },
  detailImageCard: {
    marginBottom: spacing.md,
  },
  detailImageContainer: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
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
  },
  detailName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  detailBrand: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xs,
  },
  detailBarcode: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  pricesSection: {
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  retailerInfo: {
    flex: 1,
  },
  retailerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  promoText: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  cheapestBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  savingsText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  scoresSection: {
    marginBottom: spacing.lg,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  nutrientsSection: {
    marginBottom: spacing.lg,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
  },
  nutrientValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  noNutritionSection: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  noNutritionText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing['2xl'],
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionButtonText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  filterContent: {
    flex: 1,
    padding: spacing.base,
  },
  filterSectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sortOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  sortOptionText: {
    fontSize: typography.fontSize.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkboxLabel: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  filterActions: {
    flexDirection: 'row',
    padding: spacing.base,
    borderTopWidth: 1,
  },
  resetButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  applyButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },

  inlineQtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inlineQtyBtn: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineQtyValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    minWidth: 20,
    textAlign: 'center',
  },
});

export default FoodXScreen;
