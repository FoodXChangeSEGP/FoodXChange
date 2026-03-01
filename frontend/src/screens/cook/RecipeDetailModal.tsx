/**
 * RecipeDetailModal — full-screen modal showing recipe ingredients, steps, etc.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont, shadows } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import { ShareToFriendModal } from '@/components/ShareToFriendModal';

interface RecipeDetailModalProps {
  recipeId: number;
  visible: boolean;
  onClose: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22C55E',
  medium: '#FBBF24',
  hard: '#EF4444',
};

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipeId, visible, onClose,
}) => {
  const { colors } = useTheme();
  const { selectedRecipe, selectedRecipeLoading, loadRecipe, clearSelectedRecipe, toggleFavourite } = useCookStore();
  const [shareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    if (visible && recipeId) {
      loadRecipe(recipeId);
    }
    return () => clearSelectedRecipe();
  }, [visible, recipeId]);

  const recipe = selectedRecipe;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.surface.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.surface.glassBorder }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={28} color={colors.neutral.charcoal} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }, textFont.semibold]} numberOfLines={1}>
            Recipe Detail
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {recipe && (
              <TouchableOpacity
                onPress={() => setShareVisible(true)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="share-outline" size={24} color={colors.primary.main} />
              </TouchableOpacity>
            )}
            {recipe && (
              <TouchableOpacity
                onPress={() => toggleFavourite(recipe as any)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={recipe.is_favourited ? 'heart' : 'heart-outline'}
                  size={26}
                  color={recipe.is_favourited ? '#EF4444' : colors.neutral.gray}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {selectedRecipeLoading || !recipe ? (
          <ActivityIndicator size="large" color={colors.primary.main} style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Image */}
            {recipe.image_url ? (
              <Image source={{ uri: recipe.image_url }} style={styles.heroImage} />
            ) : null}

            {/* Title & meta */}
            <View style={styles.section}>
              <Text style={[styles.title, { color: colors.neutral.charcoal }, textFont.bold]}>
                {recipe.title}
              </Text>
              {recipe.created_by_username && (
                <Text style={[styles.author, { color: colors.neutral.darkGray }, textFont.regular]}>
                  by {recipe.created_by_username}
                </Text>
              )}

              <View style={styles.metaRow}>
                <MetaBadge icon="time-outline" text={`${recipe.total_time_minutes} min`} color={colors.neutral.darkGray} />
                <MetaBadge
                  icon="speedometer-outline"
                  text={recipe.difficulty}
                  color={DIFFICULTY_COLORS[recipe.difficulty]}
                />
                <MetaBadge icon="people-outline" text={`${recipe.servings} servings`} color={colors.neutral.darkGray} />
                {recipe.calories_per_serving && (
                  <MetaBadge icon="flame-outline" text={`${recipe.calories_per_serving} kcal`} color={colors.neutral.darkGray} />
                )}
              </View>

              {recipe.description ? (
                <Text style={[styles.description, { color: colors.neutral.charcoal }, textFont.regular]}>
                  {recipe.description}
                </Text>
              ) : null}
            </View>

            {/* Ingredients */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <View style={[styles.section, styles.sectionCard, { backgroundColor: colors.surface.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }, textFont.bold]}>
                  Ingredients
                </Text>
                {recipe.ingredients.map((ing) => (
                  <View key={ing.id} style={styles.ingredientRow}>
                    <Ionicons name="ellipse" size={6} color={colors.primary.main} style={{ marginTop: 6 }} />
                    <Text style={[styles.ingredientText, { color: colors.neutral.charcoal }, textFont.regular]}>
                      {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Steps */}
            {recipe.steps && recipe.steps.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }, textFont.bold]}>
                  Method
                </Text>
                {recipe.steps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.primary.main }]}>
                      <Text style={[styles.stepNumberText, textFont.bold]}>{step.step_number}</Text>
                    </View>
                    <Text style={[styles.stepText, { color: colors.neutral.charcoal }, textFont.regular]}>
                      {step.instruction}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Source */}
            {recipe.source_url ? (
              <View style={styles.section}>
                <Text style={[styles.sourceLabel, { color: colors.neutral.gray }, textFont.regular]}>
                  Source: {recipe.source_url}
                </Text>
              </View>
            ) : null}

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <View style={[styles.section, styles.tagsRow]}>
                {recipe.tags.map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: colors.primary.main + '15' }]}>
                    <Text style={[styles.tagText, { color: colors.primary.dark }, textFont.medium]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {recipe && (
        <ShareToFriendModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          contentType="recipe"
          contentId={recipe.id}
          contentTitle={recipe.title}
        />
      )}
    </Modal>
  );
};

const MetaBadge: React.FC<{ icon: any; text: string; color: string }> = ({ icon, text, color }) => (
  <View style={styles.metaItem}>
    <Ionicons name={icon} size={14} color={color} />
    <Text style={[styles.metaText, { color }, textFont.medium]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    flex: 1,
    textAlign: 'center',
  },
  loader: { marginTop: spacing['3xl'] },
  content: { paddingBottom: spacing['4xl'] },
  heroImage: { width: '100%', height: 220, resizeMode: 'cover' },
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  sectionCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    letterSpacing: -0.3,
  },
  author: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    textTransform: 'capitalize',
  },
  description: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ingredientText: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: typography.fontSize.sm,
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    lineHeight: 22,
  },
  sourceLabel: {
    fontSize: typography.fontSize.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
  },
});
