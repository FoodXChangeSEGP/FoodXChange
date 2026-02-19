/**
 * FoodX Search Screen
 * Product search with text queries and barcode scanning
 *
 * Uses UK Grocers (Tesco, Sainsbury's) as PRIMARY data source,
 * then enriches with Open Food Facts nutrition data only when barcode matches.
 *
 * Features:
 * - Product search with filtering and sorting
 * - Add to cart functionality
 * - Product detail modal with nutritional info
 *
 */

import React, {useEffect, useState, useCallback, useMemo } from 'react';

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
import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  getTrafficLightColor,
} from '@/theme';
import { SearchBar, PlaceholderCard } from '@/components';
import { api, CombinedProduct, GrocerSearchOptions, OFFProduct } from '@/services/api';
import { useSearchStore, useCartStore, useMyListStore } from '@/store';
import { MyListScreen } from './MyListScreen';
import { useFocusEffect } from 'expo-router';

// Filter options - simplified for grocer search
type SortOption = 'relevance' | 'price' | 'name';

interface FilterState {
  sortBy: SortOption;
  showOnlyWithNutrition: boolean;
  showOnlyMultiRetailer: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  sortBy: 'relevance',
  showOnlyWithNutrition: false,
  showOnlyMultiRetailer: false,
};

export const FoodXScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CombinedProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'search' | 'mylist'>('search');
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Product detail modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CombinedProduct | null>(
    null
  );

  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useSearchStore();
  const { addItem, isInCart } = useCartStore();
  const { addItem: addToMyList, removeItem: removeFromMyList, isSaved } = useMyListStore();



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

        // Apply client-side filters
        let results = response.products;

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
    Alert.alert(
      'Barcode Scanner',
      'Barcode scanning will be available in a future update.\n\nThis feature will allow you to scan product barcodes to instantly find nutrition information and compare prices.',
      [{ text: 'OK' }]
    );
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  const handleProductPress = (product: CombinedProduct) => {
    setSelectedProduct(product);
    setDetailModalVisible(true);
  };

  const handleAddToCart = (product: CombinedProduct) => {
    // Convert CombinedProduct to a format the cart can use
    const nutriGrade = product.nutrition?.nutriscore_grade || 'unknown';
    const validGrades = ['a', 'b', 'c', 'd', 'e', 'unknown'] as const;
    type NutriGrade = (typeof validGrades)[number];

    const novaGroup = product.nutrition?.nova_group;
    const validNovaGroup = (novaGroup && [1, 2, 3, 4].includes(novaGroup)
      ? novaGroup
      : null) as 1 | 2 | 3 | 4 | null;

    const cartItem = {
      id: parseInt(product.barcode) || Math.random(),
      code: product.barcode,
      product_name: product.name,
      brands: product.brand || '',
      image_url: product.image_url,
      nutriscore_grade: (validGrades.includes(nutriGrade as NutriGrade)
        ? nutriGrade
        : 'unknown') as NutriGrade,
      nutriscore_display: product.nutrition?.nutriscore_display || 'Unknown',
      nova_group: validNovaGroup,
      nova_display: product.nutrition?.nova_display || 'Unknown',
      traffic_light: product.nutrition?.traffic_light || {
        sugars: { value: null, level: 'unknown' as const },
        salt: { value: null, level: 'unknown' as const },
        fat: { value: null, level: 'unknown' as const },
        saturated_fat: { value: null, level: 'unknown' as const },
      },
      // Store price info for cart totals
      cheapest_price: product.cheapest_price,
      prices: product.prices,
    };

    addItem(cartItem, 1);
    Alert.alert('Added to Cart', product.name + ' has been added to your cart.');
  };

  // Quick add to cart without showing alert (for use on cards)
  const handleQuickAddToCart = useCallback(
    (product: CombinedProduct, event?: any) => {
      // Stop propagation to prevent opening detail modal
      if (event) {
        event.stopPropagation?.();
      }

      const nutriGrade = product.nutrition?.nutriscore_grade || 'unknown';
      const validGrades = ['a', 'b', 'c', 'd', 'e', 'unknown'] as const;
      type NutriGrade = (typeof validGrades)[number];

      const novaGroup = product.nutrition?.nova_group;
      const validNovaGroup = (novaGroup && [1, 2, 3, 4].includes(novaGroup)
        ? novaGroup
        : null) as 1 | 2 | 3 | 4 | null;

      const cartItem = {
        id: parseInt(product.barcode) || Math.random(),
        code: product.barcode,
        product_name: product.name,
        brands: product.brand || '',
        image_url: product.image_url,
        nutriscore_grade: (validGrades.includes(nutriGrade as NutriGrade)
          ? nutriGrade
          : 'unknown') as NutriGrade,
        nutriscore_display: product.nutrition?.nutriscore_display || 'Unknown',
        nova_group: validNovaGroup,
        nova_display: product.nutrition?.nova_display || 'Unknown',
        traffic_light: product.nutrition?.traffic_light || {
          sugars: { value: null, level: 'unknown' as const },
          salt: { value: null, level: 'unknown' as const },
          fat: { value: null, level: 'unknown' as const },
          saturated_fat: { value: null, level: 'unknown' as const },
        },
        cheapest_price: product.cheapest_price,
        prices: product.prices,
      };

      addItem(cartItem, 1);
    },
    [addItem]
  );

  /*const handleAddToMyList = useCallback(async (product: CombinedProduct, event?: any) => {
    if (event) {
      event.stopPropagation?.();
    }

    try {
      await api.mylist.add(parseInt(product.barcode));
      Alert.alert('Added to My List', product.name + ' has been added.');
    } catch (error) {
      console.error('Error adding to MyList:', error);
      Alert.alert('Error', 'Unable to add to My List.');
    }
  }, []);*/

  const handleAddToMyList = useCallback(
    async (product: CombinedProduct, event?: any) => {
      if (event) event.stopPropagation?.();

      if (isSaved(product.barcode)) {
        await removeFromMyList(product.barcode);
      } else {
        await addToMyList(product.barcode, product.name, 1);
      }
    },
    [addToMyList, removeFromMyList, isSaved]
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

  const renderProductDetailModal = () => {
    if (!selectedProduct) return null;

    const nutriscoreGrade = selectedProduct.nutrition?.nutriscore_grade || 'unknown';
    const novaGroup = selectedProduct.nutrition?.nova_group;

    const nutriColor =
      {
        a: colors.nutriScore.A,
        b: colors.nutriScore.B,
        c: colors.nutriScore.C,
        d: colors.nutriScore.D,
        e: colors.nutriScore.E,
        unknown: colors.neutral.gray,
      }[nutriscoreGrade] || colors.neutral.gray;

    const novaColor = novaGroup
      ? colors.nova[novaGroup as keyof typeof colors.nova]
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
            <Text style={styles.detailName}>{selectedProduct.name}</Text>
            {selectedProduct.brand ? (
              <Text style={styles.detailBrand}>{selectedProduct.brand}</Text>
            ) : null}
            <Text style={styles.detailBarcode}>{'Barcode: ' + selectedProduct.barcode}</Text>

            {/* Retailer Prices Section */}
            <View style={styles.pricesSection}>
              <Text style={styles.sectionTitle}>Available At</Text>
              {selectedProduct.prices.map((price, index) => (
                <View key={index} style={styles.priceRow}>
                  <View style={styles.retailerInfo}>
                    <Text style={styles.retailerName}>{price.grocer_name}</Text>
                    {price.is_on_sale && price.promotion_description ? (
                      <Text style={styles.promoText}>{price.promotion_description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.priceInfo}>
                    <Text
                      style={[
                        styles.priceValue,
                        selectedProduct.cheapest_retailer === price.grocer_id &&
                          styles.cheapestPrice,
                      ]}
                    >
                      {'£' + price.price}
                    </Text>
                    {price.unit_price && price.unit_measure ? (
                      <Text style={styles.unitPrice}>
                        {'£' + price.unit_price + '/' + price.unit_measure}
                      </Text>
                    ) : null}
                    {selectedProduct.cheapest_retailer === price.grocer_id &&
                    selectedProduct.retailer_count > 1 ? (
                      <Text style={styles.cheapestBadge}>Cheapest</Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {selectedProduct.price_comparison ? (
                <View style={styles.savingsRow}>
                  <Ionicons name="pricetag" size={16} color={colors.accent.lime} />
                  <Text style={styles.savingsText}>
                    {'Save £' +
                      selectedProduct.price_comparison.potential_savings +
                      ' (' +
                      selectedProduct.price_comparison.savings_percent +
                      '%)'}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Nutrition Section - Only show if we have OFF data */}
            {selectedProduct.has_off_match && selectedProduct.nutrition ? (
              <>
                {/* Scores */}
                <View style={styles.scoresSection}>
                  <Text style={styles.sectionTitle}>Health Scores</Text>
                  <View style={styles.scoresRow}>
                    <View style={[styles.scoreBadgeLarge, { backgroundColor: nutriColor }]}>
                      <Text style={styles.scoreBadgeLabel}>Nutri-Score</Text>
                      <Text style={styles.scoreBadgeValue}>
                        {nutriscoreGrade.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.scoreBadgeLarge, { backgroundColor: novaColor }]}>
                      <Text style={styles.scoreBadgeLabel}>NOVA Group</Text>
                      <Text style={styles.scoreBadgeValue}>{novaGroup || '?'}</Text>
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
                          {
                            backgroundColor: getTrafficLightColor(
                              selectedProduct.nutrition.traffic_light.sugars.level
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.nutrientLabel}>Sugars</Text>
                    </View>
                    <Text style={styles.nutrientValue}>
                      {selectedProduct.nutrition.traffic_light.sugars.value
                        ? selectedProduct.nutrition.traffic_light.sugars.value + 'g'
                        : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.nutrientRow}>
                    <View style={styles.nutrientInfo}>
                      <View
                        style={[
                          styles.trafficLightDot,
                          {
                            backgroundColor: getTrafficLightColor(
                              selectedProduct.nutrition.traffic_light.fat.level
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.nutrientLabel}>Fat</Text>
                    </View>
                    <Text style={styles.nutrientValue}>
                      {selectedProduct.nutrition.traffic_light.fat.value
                        ? selectedProduct.nutrition.traffic_light.fat.value + 'g'
                        : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.nutrientRow}>
                    <View style={styles.nutrientInfo}>
                      <View
                        style={[
                          styles.trafficLightDot,
                          {
                            backgroundColor: getTrafficLightColor(
                              selectedProduct.nutrition.traffic_light.saturated_fat.level
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.nutrientLabel}>Saturated Fat</Text>
                    </View>
                    <Text style={styles.nutrientValue}>
                      {selectedProduct.nutrition.traffic_light.saturated_fat.value
                        ? selectedProduct.nutrition.traffic_light.saturated_fat.value + 'g'
                        : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.nutrientRow}>
                    <View style={styles.nutrientInfo}>
                      <View
                        style={[
                          styles.trafficLightDot,
                          {
                            backgroundColor: getTrafficLightColor(
                              selectedProduct.nutrition.traffic_light.salt.level
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.nutrientLabel}>Salt</Text>
                    </View>
                    <Text style={styles.nutrientValue}>
                      {selectedProduct.nutrition.traffic_light.salt.value
                        ? selectedProduct.nutrition.traffic_light.salt.value + 'g'
                        : 'N/A'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noNutritionSection}>
                <Ionicons name="nutrition-outline" size={24} color={colors.neutral.gray} />
                <Text style={styles.noNutritionText}>
                  Nutrition data not available for this product barcode
                </Text>
              </View>
            )}

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
                  {isInCart(selectedProduct.barcode) ? 'Add More' : 'Add to Cart'}
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
            {(['relevance', 'price', 'name'] as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.sortOption,
                  filters.sortBy === option && styles.sortOptionActive,
                ]}
                onPress={() => setFilters((prev) => ({ ...prev, sortBy: option }))}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    filters.sortBy === option && styles.sortOptionTextActive,
                  ]}
                >
                  {option === 'relevance'
                    ? 'Relevance'
                    : option === 'price'
                    ? 'Lowest Price'
                    : 'Name A-Z'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filter Options */}
          <Text style={styles.filterSectionTitle}>Filter Options</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                showOnlyWithNutrition: !prev.showOnlyWithNutrition,
              }))
            }
          >
            <Ionicons
              name={filters.showOnlyWithNutrition ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.showOnlyWithNutrition ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={styles.checkboxLabel}>Only show products with nutrition data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() =>
              setFilters((prev) => ({
                ...prev,
                showOnlyMultiRetailer: !prev.showOnlyMultiRetailer,
              }))
            }
          >
            <Ionicons
              name={filters.showOnlyMultiRetailer ? 'checkbox' : 'square-outline'}
              size={24}
              color={filters.showOnlyMultiRetailer ? colors.primary.dark : colors.neutral.gray}
            />
            <Text style={styles.checkboxLabel}>Only show products at multiple retailers</Text>
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

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.dark} />
          <Text style={styles.emptyText}>Searching Tesco & Sainsbury&apos;s...</Text>
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
          {['Milk', 'Bread', 'Eggs', 'Cheese', 'Chicken', 'Fruit'].map((category) => (
            <TouchableOpacity
              key={category}
              style={styles.categoryCard}
              onPress={() => handleRecentSearch(category)}
            >
              <Ionicons name="grid-outline" size={24} color={colors.primary.dark} />
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

        {/* Info Card */}
        <PlaceholderCard
          title="Compare UK Prices"
          description="Search products to compare prices at Tesco and Sainsbury's with verified nutrition info"
          icon="pricetag-outline"
          color={colors.accent.lime}
        />
      </View>
    );
  };

  // Render a product card for CombinedProduct
  const renderProductCard = ({ item }: { item: CombinedProduct }) => {
    const nutriscoreGrade = item.nutrition?.nutriscore_grade || 'unknown';
    const novaGroup = item.nutrition?.nova_group;

    const nutriColor =
      {
        a: colors.nutriScore.A,
        b: colors.nutriScore.B,
        c: colors.nutriScore.C,
        d: colors.nutriScore.D,
        e: colors.nutriScore.E,
        unknown: colors.neutral.gray,
      }[nutriscoreGrade] || colors.neutral.gray;

    const novaColor = novaGroup
      ? colors.nova[novaGroup as keyof typeof colors.nova]
      : colors.neutral.gray;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View style={styles.cardImageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="cube-outline" size={32} color={colors.neutral.gray} />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.cardContent}>
          <Text style={styles.cardName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.brand ? (
            <Text style={styles.cardBrand} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}

          {/* Retailer Price Row */}
          <View style={styles.cardPriceRow}>
            {item.prices.slice(0, 2).map((price, idx) => (
              <View key={idx} style={styles.cardRetailerPrice}>
                <Text style={styles.cardRetailerName}>{price.grocer_name}</Text>
                <Text
                  style={[
                    styles.cardPrice,
                    item.cheapest_retailer === price.grocer_id && styles.cheapestPriceCard,
                  ]}
                >
                  {'£' + price.price}
                </Text>
              </View>
            ))}
          </View>

          {/* Badges Row */}
          <View style={styles.cardBadges}>
            {item.has_off_match ? (
              <>
                <View style={[styles.cardBadge, { backgroundColor: nutriColor }]}>
                  <Text style={styles.cardBadgeText}>{nutriscoreGrade.toUpperCase()}</Text>
                </View>
                {novaGroup ? (
                  <View style={[styles.cardBadge, { backgroundColor: novaColor }]}>
                    <Text style={styles.cardBadgeText}>{'N' + novaGroup}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            {item.retailer_count > 1 ? (
              <View style={[styles.cardBadge, { backgroundColor: colors.accent.lime }]}>
                <Ionicons name="git-compare-outline" size={12} color={colors.neutral.white} />
                <Text style={styles.cardBadgeText}>{item.retailer_count + ' stores'}</Text>
              </View>
            ) : null}
          </View>

          {/* Action Buttons Row - Add to Cart only */}
          <View style={styles.cardActions}>
            {/* Add to MyList */}
            <TouchableOpacity
              style={[
                styles.cardMyListButton,
                isSaved(item.barcode) && styles.cardMyListButtonActive
              ]}
              onPress={(e) => handleAddToMyList(item, e)}
            >
              <Ionicons
                name={isSaved(item.barcode) ? "checkmark" : "bookmark-outline"}
                size={14}
                color={isSaved(item.barcode) ? colors.neutral.white : colors.primary.dark}
              />
              <Text
                style={[
                  styles.cardMyListButtonText,
                  isSaved(item.barcode) && styles.cardMyListButtonTextActive
                ]}
              >
                {isSaved(item.barcode) ? "Saved" : "Save"}
              </Text>
            </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardAddButton, isInCart(item.barcode) && styles.cardAddButtonActive]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleQuickAddToCart(item);
              }}
            >
              <Ionicons
                name={isInCart(item.barcode) ? 'checkmark' : 'add'}
                size={14}
                color={isInCart(item.barcode) ? colors.neutral.white : colors.primary.dark}
              />
              <Text
                style={[
                  styles.cardAddButtonText,
                  isInCart(item.barcode) && styles.cardAddButtonTextActive,
                ]}
              >
                {isInCart(item.barcode) ? 'Added' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== 'relevance') count++;
    if (filters.showOnlyWithNutrition) count++;
    if (filters.showOnlyMultiRetailer) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FoodX Search</Text>
        <Text style={styles.headerSubtitle}>Find healthy, affordable food (UK)</Text>
      </View>

      {/* Internal Tabs */}
      <View style={styles.internalTabs}>
        <TouchableOpacity
          style={[
            styles.internalTabButton,
            activeTab === 'search' && styles.internalTabButtonActive,
          ]}
          onPress={() => setActiveTab('search')}
        >
          <Text
            style={[
              styles.internalTabText,
              activeTab === 'search' && styles.internalTabTextActive,
            ]}
          >
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.internalTabButton,
            activeTab === 'mylist' && styles.internalTabButtonActive,
          ]}
          onPress={() => setActiveTab('mylist')}
        >
          <Text
            style={[
              styles.internalTabText,
              activeTab === 'mylist' && styles.internalTabTextActive,
            ]}
          >
            My List
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'search' ? (
        <>
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
              filters.sortBy === 'price' ? 'Sorted by: Lowest Price' : 'Sorted by: Name'}
            </Text>
          </View>

          {/* Results or Empty State */}
          {hasSearched && searchResults.length > 0 ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultCount}>
                {String(totalCount) + ' products found from Tesco & Sainsbury\'s'}
              </Text>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.barcode}
                renderItem={renderProductCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            </View>
           ) : (
            renderEmptyState()
          )}
          </>
      ) : (
        <MyListScreen />
      )}

      {/* Modals */}
      {renderProductDetailModal()}
      {renderFilterModal()}
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
  // Product Card Styles
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardImageContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral.lightGray,
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
    color: colors.neutral.charcoal,
    lineHeight: 20,
  },
  cardBrand: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginTop: 2,
  },
  cardPriceRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  cardRetailerPrice: {
    flex: 1,
    alignItems: 'flex-start',
  },
  cardRetailerName: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.gray,
  },
  cardPrice: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  cheapestPriceCard: {
    color: colors.accent.lime,
  },
  cardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  cardBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
    marginLeft: 2,
  },
  // Detail Modal - Price Section
  pricesSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },
  retailerInfo: {
    flex: 1,
  },
  retailerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
  },
  promoText: {
    fontSize: typography.fontSize.sm,
    color: colors.accent.lime,
    marginTop: 2,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  cheapestPrice: {
    color: colors.accent.lime,
  },
  unitPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
  cheapestBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.accent.lime,
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
    color: colors.accent.lime,
  },
  noNutritionSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  noNutritionText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Card Action Buttons (Add only)
  cardActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  cardAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary.dark,
    backgroundColor: colors.neutral.white,
  },
  cardAddButtonActive: {
    backgroundColor: colors.primary.dark,
    borderColor: colors.primary.dark,
  },
  cardAddButtonText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary.dark,
  },
  cardAddButtonTextActive: {
    color: colors.neutral.white,
  },
  // Swap Modal Styles
  swapSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginTop: 2,
  },
  originalProductCard: {
    backgroundColor: colors.neutral.white,
    margin: spacing.base,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  originalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginBottom: spacing.sm,
  },
  originalProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.lightGray,
  },
  originalImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  originalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  originalName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
  },
  originalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  originalPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginRight: spacing.xs,
  },
  miniBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  miniBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
  },
  loadingAlternatives: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
  },
  noAlternatives: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  noAlternativesText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
  },
  noAlternativesSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.gray,
  },
  alternativesList: {
    padding: spacing.base,
  },
  alternativeCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  alternativeImageContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral.lightGray,
  },
  alternativeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  alternativeImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alternativeInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  alternativeName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
    lineHeight: 18,
  },
  alternativeTags: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  healthierTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  healthierTagText: {
    marginLeft: 2,
    fontSize: typography.fontSize.xs,
    color: colors.nutriScore.A,
    fontWeight: typography.fontWeight.medium,
  },
  cheaperTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cheaperTagText: {
    marginLeft: 2,
    fontSize: typography.fontSize.xs,
    color: colors.accent.lime,
    fontWeight: typography.fontWeight.medium,
  },
  alternativeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  alternativePrice: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  alternativeAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.dark,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: spacing.sm,
  },
  internalTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: colors.neutral.lightGray,
    borderRadius: borderRadius.full,
    padding: 4,
  },

  internalTabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },

  internalTabButtonActive: {
    backgroundColor: colors.primary.dark,
  },

  internalTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary.dark,
  },

  internalTabTextActive: {
    color: colors.neutral.white,
  },

  cardMyListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary.dark,
    backgroundColor: colors.neutral.white,
  },

  cardMyListButtonText: {
    marginLeft: 4,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary.dark,
  },

  cardMyListButtonActive: {
    backgroundColor: colors.primary.dark,
    borderColor: colors.primary.dark,
  },


  cardMyListButtonTextActive: {
    color: colors.neutral.white,
  },

  
});



export default FoodXScreen;
