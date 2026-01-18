/**
 * ProductCard Component
 * Displays a product with price, NOVA score, and Nutri-Score
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import type { Product } from '@/services/api';

interface ProductCardProps {
  product: Product;
  onPress?: (product: Product) => void;
  showPrice?: boolean;
}

const getNovaColor = (score: number): string => {
  return colors.nova[score as keyof typeof colors.nova] || colors.neutral.gray;
};

const getNutriScoreColor = (score: string): string => {
  return colors.nutriScore[score as keyof typeof colors.nutriScore] || colors.neutral.gray;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  showPrice = true,
}) => {
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
          {product.name}
        </Text>
        <Text style={styles.category}>{product.category}</Text>

        {/* Scores */}
        <View style={styles.scoresContainer}>
          <View
            style={[
              styles.scoreTag,
              { backgroundColor: getNovaColor(product.nova_score) },
            ]}
          >
            <Text style={styles.scoreText}>NOVA {product.nova_score}</Text>
          </View>
          <View
            style={[
              styles.scoreTag,
              { backgroundColor: getNutriScoreColor(product.nutri_score) },
            ]}
          >
            <Text style={styles.scoreText}>{product.nutri_score}</Text>
          </View>
        </View>

        {/* Price */}
        {showPrice && product.lowest_price && (
          <Text style={styles.price}>
            From £{product.lowest_price}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.neutral.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 32,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
  },
  category: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginBottom: spacing.sm,
  },
  scoresContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  scoreTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  scoreText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
  },
  price: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
});

export default ProductCard;
