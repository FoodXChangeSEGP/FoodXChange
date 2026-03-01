/**
 * MyRecipesScreen — user's own recipes with add button
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import { AddRecipeScreen } from './AddRecipeScreen';
import type { Recipe } from '@/types/cook';

export const MyRecipesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { myRecipes, recipesLoading, loadMyRecipes, toggleFavourite, deleteRecipe } = useCookStore();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadMyRecipes();
  }, []);

  const handleDelete = useCallback(async (recipe: Recipe) => {
    await deleteRecipe(recipe.id);
  }, [deleteRecipe]);

  if (showAdd) {
    return <AddRecipeScreen onBack={() => { setShowAdd(false); loadMyRecipes(); }} />;
  }

  return (
    <View style={styles.container}>
      {/* Add button */}
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: colors.neutral.charcoal }, textFont.semibold]}>
          Your Collection
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary.main }]}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={[styles.addBtnText, textFont.semibold]}>Add Recipe</Text>
        </TouchableOpacity>
      </View>

      {recipesLoading ? (
        <ActivityIndicator size="large" color={colors.primary.main} style={styles.loader} />
      ) : (
        <FlatList
          data={myRecipes}
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
              <Ionicons name="book-outline" size={48} color={colors.neutral.gray} />
              <Text style={[styles.emptyText, { color: colors.neutral.darkGray }, textFont.medium]}>
                No recipes yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.neutral.gray }, textFont.regular]}>
                Tap "Add Recipe" to create your first one
              </Text>
            </View>
          }
        />
      )}

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  heading: {
    fontSize: typography.fontSize.md,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  addBtnText: {
    fontSize: typography.fontSize.sm,
    color: '#FFF',
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
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
  },
  emptyHint: {
    fontSize: typography.fontSize.sm,
  },
});
