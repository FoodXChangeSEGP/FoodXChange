/**
 * RecipeCard — compact card used in recipe lists
 */
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont, shadows } from '@/theme';
import type { Recipe } from '@/types/cook';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
  onFavourite?: (recipe: Recipe) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22C55E',
  medium: '#FBBF24',
  hard: '#EF4444',
};

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress, onFavourite }) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface.card }]}
      onPress={() => onPress(recipe)}
      activeOpacity={0.85}
    >
      {recipe.image_url ? (
        <Image source={{ uri: recipe.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.neutral.lightGray }]}>
          <Ionicons name="restaurant-outline" size={32} color={colors.neutral.gray} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.neutral.charcoal }, textFont.semibold]} numberOfLines={1}>
            {recipe.title}
          </Text>
          {onFavourite && (
            <TouchableOpacity onPress={() => onFavourite(recipe)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={recipe.is_favourited ? 'heart' : 'heart-outline'}
                size={22}
                color={recipe.is_favourited ? '#EF4444' : colors.neutral.gray}
              />
            </TouchableOpacity>
          )}
        </View>

        {recipe.description ? (
          <Text style={[styles.desc, { color: colors.neutral.darkGray }, textFont.regular]} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.neutral.gray} />
            <Text style={[styles.metaText, { color: colors.neutral.darkGray }, textFont.regular]}>
              {recipe.total_time_minutes}m
            </Text>
          </View>
          <View style={[styles.diffBadge, { backgroundColor: DIFFICULTY_COLORS[recipe.difficulty] + '20' }]}>
            <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[recipe.difficulty] }, textFont.medium]}>
              {recipe.difficulty}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={colors.neutral.gray} />
            <Text style={[styles.metaText, { color: colors.neutral.darkGray }, textFont.regular]}>
              {recipe.servings}
            </Text>
          </View>
          {recipe.calories_per_serving && (
            <View style={styles.metaItem}>
              <Ionicons name="flame-outline" size={14} color={colors.neutral.gray} />
              <Text style={[styles.metaText, { color: colors.neutral.darkGray }, textFont.regular]}>
                {recipe.calories_per_serving} kcal
              </Text>
            </View>
          )}
        </View>

        {recipe.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.primary.main + '15' }]}>
                <Text style={[styles.tagText, { color: colors.primary.dark }, textFont.medium]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  image: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  desc: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.fontSize.xs,
  },
  diffBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  diffText: {
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: 10,
  },
});
