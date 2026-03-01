/**
 * FavouritesScreen — user's favourited recipes
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, typography, textFont } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import type { Recipe } from '@/types/cook';

export const FavouritesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { myFavourites, recipesLoading, loadMyFavourites, toggleFavourite } = useCookStore();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    loadMyFavourites();
  }, []);

  return (
    <View style={styles.container}>
      {recipesLoading ? (
        <ActivityIndicator size="large" color={colors.primary.main} style={styles.loader} />
      ) : (
        <FlatList
          data={myFavourites}
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
              <Ionicons name="heart-outline" size={48} color={colors.neutral.gray} />
              <Text style={[styles.emptyText, { color: colors.neutral.darkGray }, textFont.medium]}>
                No favourites yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.neutral.gray }, textFont.regular]}>
                Tap the heart on any recipe to save it here
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
