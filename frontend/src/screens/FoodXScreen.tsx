/**
 * FoodX Search Screen
 * Product search with text queries and barcode scanning
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@/theme';
import { SearchBar, ProductCard, PlaceholderCard } from '@/components';
import { api, Product } from '@/services/api';
import { useSearchStore } from '@/store';

export const FoodXScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    addRecentSearch(searchQuery.trim());

    try {
      const results = await api.products.search(searchQuery.trim());
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search products. Please try again.');
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
    api.products.search(query)
      .then(results => setSearchResults(results))
      .catch(error => console.error('Search error:', error))
      .finally(() => setIsSearching(false));
  };

  const handleProductPress = (product: Product) => {
    // TODO: Navigate to product detail
    Alert.alert(
      product.name,
      `NOVA Score: ${product.nova_score}\nNutri-Score: ${product.nutri_score}\nCategory: ${product.category}`,
    );
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
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.productItem}>
              <ProductCard product={item} onPress={handleProductPress} />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
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
});

export default FoodXScreen;
