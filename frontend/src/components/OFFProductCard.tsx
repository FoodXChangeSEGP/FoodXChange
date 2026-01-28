/**
 * OFFProductCard Component
 * Displays an Open Food Facts product with Nutri-Score, NOVA score, and traffic lights
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import type { OFFProduct } from '@/services/api';

interface OFFProductCardProps {
  product: OFFProduct;
  onPress?: (product: OFFProduct) => void;
  onSwapPress?: (product: OFFProduct) => void;
  compact?: boolean;
}

const getNutriScoreColor = (grade: string): string => {
  const colorMap: Record<string, string> = {
    a: colors.nutriScore.A,
    b: colors.nutriScore.B,
    c: colors.nutriScore.C,
    d: colors.nutriScore.D,
    e: colors.nutriScore.E,
    unknown: colors.neutral.gray,
  };
  return colorMap[grade] || colors.neutral.gray;
};

const getNovaColor = (group: number | null): string => {
  if (group === null) return colors.neutral.gray;
  return colors.nova[group as keyof typeof colors.nova] || colors.neutral.gray;
};

const getTrafficLightColor = (level: string): string => {
  const colorMap: Record<string, string> = {
    green: '#22C55E',
    amber: '#F59E0B',
    red: '#EF4444',
    unknown: colors.neutral.lightGray,
  };
  return colorMap[level] || colors.neutral.lightGray;
};

export const OFFProductCard: React.FC<OFFProductCardProps> = ({
  product,
  onPress,
  onSwapPress,
  compact = false,
}) => {
  const nutriColor = getNutriScoreColor(product.nutriscore_grade);
  const novaColor = getNovaColor(product.nova_group);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={() => onPress?.(product)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View style={styles.compactImageContainer}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.compactImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>🥗</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={2}>
            {product.product_name}
          </Text>
          {product.brands && (
            <Text style={styles.compactBrand} numberOfLines={1}>
              {product.brands}
            </Text>
          )}
          
          {/* Scores */}
          <View style={styles.scoresRow}>
            <View style={[styles.scoreBadge, { backgroundColor: nutriColor }]}>
              <Text style={styles.scoreText}>
                {product.nutriscore_grade.toUpperCase()}
              </Text>
            </View>
            {product.nova_group && (
              <View style={[styles.scoreBadge, { backgroundColor: novaColor }]}>
                <Text style={styles.scoreText}>NOVA {product.nova_group}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(product)}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>🥗</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>
          {product.product_name}
        </Text>
        {product.brands && (
          <Text style={styles.brand} numberOfLines={1}>
            {product.brands}
          </Text>
        )}

        {/* Scores */}
        <View style={styles.scoresContainer}>
          <View style={[styles.scoreBadge, { backgroundColor: nutriColor }]}>
            <Text style={styles.scoreText}>
              Nutri-Score {product.nutriscore_grade.toUpperCase()}
            </Text>
          </View>
          {product.nova_group && (
            <View style={[styles.scoreBadge, { backgroundColor: novaColor }]}>
              <Text style={styles.scoreText}>NOVA {product.nova_group}</Text>
            </View>
          )}
        </View>

        {/* Traffic Lights */}
        <View style={styles.trafficLightContainer}>
          {product.traffic_light.sugars.value && (
            <View style={styles.trafficLightItem}>
              <View
                style={[
                  styles.trafficLightDot,
                  { backgroundColor: getTrafficLightColor(product.traffic_light.sugars.level) },
                ]}
              />
              <Text style={styles.trafficLightLabel}>Sugar</Text>
            </View>
          )}
          {product.traffic_light.salt.value && (
            <View style={styles.trafficLightItem}>
              <View
                style={[
                  styles.trafficLightDot,
                  { backgroundColor: getTrafficLightColor(product.traffic_light.salt.level) },
                ]}
              />
              <Text style={styles.trafficLightLabel}>Salt</Text>
            </View>
          )}
          {product.traffic_light.fat.value && (
            <View style={styles.trafficLightItem}>
              <View
                style={[
                  styles.trafficLightDot,
                  { backgroundColor: getTrafficLightColor(product.traffic_light.fat.level) },
                ]}
              />
              <Text style={styles.trafficLightLabel}>Fat</Text>
            </View>
          )}
          {product.traffic_light.saturated_fat.value && (
            <View style={styles.trafficLightItem}>
              <View
                style={[
                  styles.trafficLightDot,
                  { backgroundColor: getTrafficLightColor(product.traffic_light.saturated_fat.level) },
                ]}
              />
              <Text style={styles.trafficLightLabel}>Sat Fat</Text>
            </View>
          )}
        </View>
      </View>

      {/* Swap Button */}
      {onSwapPress && (
        <TouchableOpacity
          style={styles.swapButton}
          onPress={() => onSwapPress(product)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.primary.dark} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.md,
  },
  compactContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...shadows.sm,
  },
  imageContainer: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  compactImageContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: colors.neutral.lightGray,
  },
  compactImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: colors.neutral.lightGray,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.neutral.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 28,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
  },
  compactName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
    marginBottom: 2,
  },
  brand: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginBottom: spacing.sm,
  },
  compactBrand: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.gray,
    marginBottom: spacing.xs,
  },
  scoresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  scoresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  scoreText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
  },
  trafficLightContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  trafficLightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs,
  },
  trafficLightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  trafficLightLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.darkGray,
  },
  swapButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.neutral.lightGray,
    marginLeft: spacing.sm,
  },
});

export default OFFProductCard;
