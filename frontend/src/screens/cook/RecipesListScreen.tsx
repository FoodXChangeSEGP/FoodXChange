/**
 * RecipesListScreen — browse all public recipes with filters
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import type { Recipe, RecipeCategory } from '@/types/cook';

const CATEGORIES: { key: RecipeCategory | null; label: string }[] = [
  { key: null, label: 'All' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
  { key: 'soup', label: 'Soup' },
  { key: 'salad', label: 'Salad' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
];

export const RecipesListScreen: React.FC = () => {
  const { colors } = useTheme();
  const {
    recipes, recipesLoading, loadRecipes,
    categoryFilter, setCategoryFilter,
    searchQuery, setSearchQuery,
    toggleFavourite,
  } = useCookStore();

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const fetchRecipes = useCallback(() => {
    const params: Record<string, string> = {};
    if (categoryFilter) params.category = categoryFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();
    loadRecipes(params);
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface.card, borderColor: colors.surface.glassBorder }]}>
        <Ionicons name="search-outline" size={18} color={colors.neutral.gray} />
        <TextInput
          style={[styles.searchInput, { color: colors.neutral.charcoal }, textFont.regular]}
          placeholder="Search recipes..."
          placeholderTextColor={colors.neutral.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.neutral.gray} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
        {CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.key;
          return (
            <TouchableOpacity
              key={cat.key ?? 'all'}
              onPress={() => setCategoryFilter(cat.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary.main : colors.surface.card,
                  borderColor: active ? colors.primary.main : colors.surface.glassBorder,
                },
              ]}
            >
              <Text style={[
                styles.chipText,
                { color: active ? '#FFF' : colors.neutral.darkGray },
                active ? textFont.semibold : textFont.regular,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Recipe list */}
      {recipesLoading ? (
        <ActivityIndicator size="large" color={colors.primary.main} style={styles.loader} />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={setSelectedRecipe}
              onFavourite={toggleFavourite}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color={colors.neutral.gray} />
              <Text style={[styles.emptyText, { color: colors.neutral.darkGray }, textFont.medium]}>
                No recipes found
              </Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipeId={selectedRecipe.id}
          visible={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: 0,
  },
  chipsScroll: {
    maxHeight: 40,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  loader: {
    marginTop: spacing['2xl'],
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
  },
});
