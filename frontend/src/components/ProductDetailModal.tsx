import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, typography, getTrafficLightColor } from '@/theme';
import { GlassCard, GlassModal, AnimatedPressable, ScoreBadge, PriceTag } from '@/components/ui';
import type { CombinedProduct } from '@/services/api';

interface ProductDetailModalProps {
  visible: boolean;
  onClose: () => void;
  product: CombinedProduct | null;
  isSaved: (barcode: string) => boolean;
  onSavePress: (product: CombinedProduct) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  visible,
  onClose,
  product,
  isSaved,
  onSavePress,
}) => {
  const { colors } = useTheme();

  if (!product) return null;

  const nutriscoreGrade = product.nutrition?.nutriscore_grade || 'unknown';
  const novaGroup = product.nutrition?.nova_group;
  const ingredientsText = product.nutrition?.ingredients_text;

  return (
    <GlassModal visible={visible} onClose={onClose} title="Product Details">
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product image */}
        <GlassCard blur="medium" padding="none" style={styles.imageCard}>
          <View style={styles.imageContainer}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cube-outline" size={64} color={colors.neutral.gray} />
              </View>
            )}
          </View>
        </GlassCard>

        {/* Name, brand, barcode */}
        <Text style={[styles.name, { color: colors.neutral.charcoal }]}>{product.name}</Text>
        {product.brand ? (
          <Text style={[styles.brand, { color: colors.neutral.darkGray }]}>{product.brand}</Text>
        ) : null}
        <Text style={[styles.barcode, { color: colors.neutral.gray }]}>
          {'Barcode: ' + product.barcode}
        </Text>

        {/* Prices */}
        <GlassCard blur="subtle" padding="md" style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>Available At</Text>
          {product.prices?.map((price, index) => (
            <View key={index} style={styles.priceRow}>
              <View style={styles.retailerInfo}>
                <Text style={[styles.retailerName, { color: colors.neutral.charcoal }]}>
                  {price.grocer_name}
                </Text>
                {price.is_on_sale && price.promotion_description ? (
                  <Text style={[styles.promoText, { color: colors.accent.lime }]}>
                    {price.promotion_description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.priceInfo}>
                <PriceTag
                  price={parseFloat(price.price)}
                  size={product.cheapest_retailer === price.grocer_id ? 'lg' : 'md'}
                />
                {price.unit_price && price.unit_measure ? (
                  <Text style={[styles.unitPrice, { color: colors.neutral.darkGray }]}>
                    {'£' + price.unit_price + '/' + price.unit_measure}
                  </Text>
                ) : null}
                {product.cheapest_retailer === price.grocer_id && product.retailer_count > 1 ? (
                  <Text style={[styles.cheapestLabel, { color: colors.accent.lime }]}>Cheapest</Text>
                ) : null}
              </View>
            </View>
          ))}
          {product.price_comparison ? (
            <View style={styles.savingsRow}>
              <Ionicons name="pricetag" size={16} color={colors.accent.lime} />
              <Text style={[styles.savingsText, { color: colors.accent.lime }]}>
                {'Save £' +
                  product.price_comparison.potential_savings +
                  ' (' +
                  product.price_comparison.savings_percent +
                  '%)'}
              </Text>
            </View>
          ) : null}
        </GlassCard>

        {/* Health scores and nutrients (only when OFF matched) */}
        {product.has_off_match && product.nutrition ? (
          <>
            <GlassCard blur="subtle" padding="md" style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>Health Scores</Text>
              <View style={styles.scoresRow}>
                <ScoreBadge type="nutri" value={nutriscoreGrade} size="lg" showLabel glow />
                {novaGroup ? (
                  <ScoreBadge type="nova" value={novaGroup} size="lg" showLabel glow />
                ) : null}
              </View>
            </GlassCard>

            <GlassCard blur="subtle" padding="md" style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
                Nutrients per 100g
              </Text>
              {(
                [
                  { key: 'sugars', label: 'Sugars' },
                  { key: 'fat', label: 'Fat' },
                  { key: 'saturated_fat', label: 'Saturated Fat' },
                  { key: 'salt', label: 'Salt' },
                ] as const
              ).map(({ key, label }) => {
                const entry = product.nutrition!.traffic_light[key];
                return (
                  <View key={key} style={styles.nutrientRow}>
                    <View style={styles.nutrientInfo}>
                      <View
                        style={[
                          styles.trafficDot,
                          { backgroundColor: getTrafficLightColor(entry.level) },
                        ]}
                      />
                      <Text style={[styles.nutrientLabel, { color: colors.neutral.charcoal }]}>
                        {label}
                      </Text>
                    </View>
                    <Text style={[styles.nutrientValue, { color: colors.neutral.charcoal }]}>
                      {entry.value ? entry.value + 'g' : 'N/A'}
                    </Text>
                  </View>
                );
              })}
            </GlassCard>
          </>
        ) : !ingredientsText ? (
          // No nutrition scores and no ingredients at all
          <GlassCard blur="subtle" padding="lg" style={[styles.section, styles.noNutrition]}>
            <Ionicons name="nutrition-outline" size={24} color={colors.neutral.gray} />
            <Text style={[styles.noNutritionText, { color: colors.neutral.gray }]}>
              Nutrition data not available for this product barcode
            </Text>
          </GlassCard>
        ) : null}

        {/* Ingredients — shown whenever available, independent of OFF match */}
        {ingredientsText ? (
          <GlassCard blur="subtle" padding="md" style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              Ingredients
            </Text>
            <Text style={[styles.ingredientsText, { color: colors.neutral.darkGray }]}>
              {ingredientsText}
            </Text>
          </GlassCard>
        ) : null}

        {/* Save button */}
        <View style={styles.actions}>
          <AnimatedPressable
            onPress={() => {
              onSavePress(product);
              onClose();
            }}
          >
            <LinearGradient
              colors={[colors.primary.main, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Ionicons
                name={isSaved(product.barcode) ? 'checkmark' : 'bookmark-outline'}
                size={20}
                color={colors.neutral.white}
              />
              <Text style={[styles.saveButtonText, { color: colors.neutral.white }]}>
                {isSaved(product.barcode) ? 'Saved to My List' : 'Save to My List'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </GlassModal>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: spacing.base,
  },
  imageCard: {
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  image: {
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
  name: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  brand: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xs,
  },
  barcode: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
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
  cheapestLabel: {
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
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
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
  trafficDot: {
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
  ingredientsText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.fontSize.sm * 1.6,
  },
  noNutrition: {
    alignItems: 'center',
  },
  noNutritionText: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.md,
    marginBottom: spacing['2xl'],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
});
