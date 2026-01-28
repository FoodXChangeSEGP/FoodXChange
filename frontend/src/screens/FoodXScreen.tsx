/**
 * FoodX Search Screen
 * Product search with text queries and barcode scanning
 * Uses Open Food Facts API for UK product data
 */

import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/theme';
import { SearchBar, OFFProductCard, PlaceholderCard } from '@/components';
import { api, OFFProduct } from '@/services/api';
import { useSearchStore } from '@/store';

export const FoodXScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultCount, setResultCount] = useState(0);
  
  // Healthy swap modal state
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OFFProduct | null>(null);
  const [alternatives, setAlternatives] = useState<OFFProduct[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    addRecentSearch(searchQuery.trim());

    try {
      // Use Open Food Facts search API
      const response = await api.off.search(searchQuery.trim(), { limit: 20 });
      setSearchResults(response.results);
      setResultCount(response.count);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search products. Please try again.');
      setSearchResults([]);
      setResultCount(0);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, addRecentSearch]);

  const handleBarcodeScan = () => {
    // TODO: Implement barcode scanning with expo-camera
    Alert.alert(
      'Barcode Scanner',
      'Barcode scanning will be available in a future update.\n\nThis feature will allow you to scan product barcodes to instantly find nutrition information and compare prices.',
      [{ text: 'OK' }]
    );
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    // Trigger search with the selected query
    setIsSearching(true);
    setHasSearched(true);
    api.off.search(query, { limit: 20 })
      .then(response => {
        setSearchResults(response.results);
        setResultCount(response.count);
      })
      .catch(error => {
        console.error('Search error:', error);
        setSearchResults([]);
        setResultCount(0);
      })
      .finally(() => setIsSearching(false));
  };

  const handleProductPress = (product: OFFProduct) => {
    // Show product details
    Alert.alert(
      product.product_name,
      `Brand: ${product.brands || 'Unknown'}\n` +
      `Nutri-Score: ${product.nutriscore_grade.toUpperCase()}\n` +
      `NOVA Group: ${product.nova_group || 'Unknown'}\n` +
      `Barcode: ${product.code}`,
      [
        { text: 'Close' },
        { 
          text: 'Find Healthier',
          onPress: () => handleSwapPress(product),
        },
      ]
    );
  };

  const handleSwapPress = async (product: OFFProduct) => {
    setSelectedProduct(product);
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
            Try a different search term or scan a barcode
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
        {recentSearches.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Searches</Text>
              <TouchableOpacity onPress={clearRecentSearches}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.slice(0, 5).map((search, index) => (
              <TouchableOpacity
                key={`${search}-${index}`}
                style={styles.recentItem}
                onPress={() => handleRecentSearch(search)}
              >
                <Ionicons name="time-outline" size={20} color={colors.neutral.gray} />
                <Text style={styles.recentText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FoodX Search</Text>
        <Text style={styles.headerSubtitle}>Find healthy, affordable food</Text>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmit={handleSearch}
        onBarcodeScan={handleBarcodeScan}
        placeholder="Search products, brands, or barcodes..."
      />

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
          <Text style={styles.filterChipTextActive}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>NOVA 1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>Nutri-Score A</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip}>
          <Text style={styles.filterChipText}>On Sale</Text>
        </TouchableOpacity>
      </View>

      {/* Results or Empty State */}
      {hasSearched && searchResults.length > 0 ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultCount}>
            {resultCount} products found
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
          />
        </View>
      ) : (
        renderEmptyState()
      )}

      {/* Healthy Swap Modal */}
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

          {selectedProduct && (
            <View style={styles.originalProductSection}>
              <Text style={styles.sectionLabel}>Original Product</Text>
              <OFFProductCard product={selectedProduct} compact />
            </View>
          )}

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
                    <OFFProductCard product={alt} onPress={handleProductPress} />
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.white,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },
  filterChipActive: {
    backgroundColor: colors.primary.dark,
    borderColor: colors.primary.dark,
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
  filterChipTextActive: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.white,
    fontWeight: typography.fontWeight.medium,
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
