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
  ScrollView,
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
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [hasSearched, setHasSearched] = useState(false);

  const { recentSearches, addRecentSearch, clearRecentSearches } = useSearchStore();

  // ============================
  // LIVE DROPDOWN SEARCH
  // ============================

  const handleLiveSearch = async (text: string) => {
    setSearchQuery(text);
    setSelectedProduct(null);

    if (!text.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await api.products.search(text);

      const array = Array.isArray(res)
        ? res
        : (res as any).results ?? Object.values(res);

      setSuggestions(array.slice(0, 6));
    } catch (err) {
      console.log('Live search error:', err);
    }
  };

  // ============================
  // FULL SEARCH (SUBMIT)
  // ============================

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    addRecentSearch(searchQuery.trim());
    setSuggestions([]);

    try {
      const res = await api.products.search(searchQuery.trim());

      const array = Array.isArray(res)
        ? res
        : (res as any).results ?? Object.values(res);

      // 🔧 FIX lowest_price so ProductCard doesn't crash
      const fixedResults = array.map((product: any) => ({
        ...product,
        lowest_price:
          typeof product.lowest_price === 'object'
            ? product.lowest_price?.price
            : product.lowest_price,
      }));

      setSearchResults(fixedResults);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Unable to search products. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, addRecentSearch]);


  // ============================
  // SELECT PRODUCT FROM DROPDOWN
  // ============================

  const handleSelectProduct = async (id: number) => {
    try {
      setIsSearching(true);

      const fullProduct = await api.products.getById(id);

      setSelectedProduct(fullProduct);
      setSuggestions([]);
      setSearchResults([]);
      setHasSearched(false);
      setSearchQuery(fullProduct.name);
    } catch (err) {
      console.log('Fetch product error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcodeScan = () => {
    Alert.alert(
      'Barcode Scanner',
      'Barcode scanning will be available in a future update.'
    );
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    handleLiveSearch(query);
    handleSearch();
  };

  // ============================
  // EMPTY STATE UI
  // ============================

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
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.initialContainer}>
        <Text style={styles.sectionTitle}>Browse Categories</Text>

        <View style={styles.categoriesGrid}>
          {['Dairy', 'Bakery', 'Beverages', 'Snacks', 'Fresh', 'Pantry'].map((category) => (
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

        <PlaceholderCard
          title="Scan a Barcode"
          description="Instantly find product info and compare prices"
          icon="barcode-outline"
          color={colors.accent.lime}
        />
      </View>
    );
  };

  // ============================
  // MAIN RENDER
  // ============================

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>FoodX Search</Text>
        <Text style={styles.headerSubtitle}>Find healthy, affordable food</Text>
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={handleLiveSearch}
        onSubmit={handleSearch}
        onBarcodeScan={handleBarcodeScan}
        placeholder="Search products..."
      />

      {/* DROPDOWN SUGGESTIONS */}
      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.dropdownItem}
              onPress={() => handleSelectProduct(item.id)}
            >
              <Text style={styles.dropdownText}>{item.name}</Text>
              <Text style={styles.dropdownSub}>
                NOVA {item.nova_score_display} • Nutri {item.nutri_score_display}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* FULL PRODUCT DETAIL */}
      {selectedProduct && (
        <ScrollView style={styles.productDetailCard}>

          <Text style={styles.productName}>
            {selectedProduct.name}
          </Text>

          <Text>Category: {selectedProduct.category}</Text>
          <Text>NOVA: {selectedProduct.nova_score_display}</Text>
          <Text>Nutri-Score: {selectedProduct.nutri_score_display}</Text>

          <Text style={styles.priceTitle}>Prices</Text>

          {selectedProduct.prices?.map(p => (
            <View key={p.id} style={styles.priceRow}>
              <Text>{p.retailer.name}</Text>
              <Text>
                £{p.sale_price ?? p.price}
              </Text>
            </View>
          ))}

        </ScrollView>
      )}

      {/* SEARCH RESULT LIST */}
      {hasSearched && searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.productItem}>
              <ProductCard product={item} />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        !selectedProduct && renderEmptyState()
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

  dropdown: {
    backgroundColor: colors.neutral.white,
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
    maxHeight: 220,
  },

  dropdownItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },

  dropdownText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },

  dropdownSub: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginTop: 2,
  },

  productDetailCard: {
    margin: spacing.base,
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
  },

  productName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
  },

  priceTitle: {
    marginTop: spacing.md,
    fontWeight: typography.fontWeight.bold,
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
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
  },

  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.md,
  },

  emptyText: {
    marginTop: spacing.sm,
    color: colors.neutral.darkGray,
  },

  initialContainer: {
    flex: 1,
    padding: spacing.base,
  },

  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },

  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    marginTop: spacing.xs,
  },

  recentSection: {
    marginTop: spacing.lg,
  },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  clearText: {
    color: colors.primary.dark,
  },

  recentItem: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },

  recentText: {
    marginLeft: spacing.sm,
  },
});

export default FoodXScreen;
