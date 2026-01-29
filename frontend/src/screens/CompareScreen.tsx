import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { api, Product } from '@/services/api';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '@/theme';

// Utility functions for health comparison
const nutriScoreRank = (score: string): number => {
  const ranks: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  return ranks[score?.toUpperCase()] ?? 6;
};

const getNovaColor = (score: number): string => {
  return colors.nova[score as keyof typeof colors.nova] || colors.neutral.gray;
};

const getNutriScoreColor = (score: string): string => {
  return colors.nutriScore[score?.toUpperCase() as keyof typeof colors.nutriScore] || colors.neutral.gray;
};

interface HealthComparison {
  winner: 'left' | 'right' | 'tie';
  nutriScoreWinner: 'left' | 'right' | 'tie';
  novaWinner: 'left' | 'right' | 'tie';
  summary: string;
}

const compareHealth = (left: Product, right: Product): HealthComparison => {
  // Compare Nutri-Score (A is best, E is worst)
  const leftNutri = nutriScoreRank(left.nutri_score);
  const rightNutri = nutriScoreRank(right.nutri_score);
  const nutriScoreWinner = leftNutri < rightNutri ? 'left' : leftNutri > rightNutri ? 'right' : 'tie';
  
  // Compare NOVA (1 is best, 4 is worst)
  const novaWinner = left.nova_score < right.nova_score ? 'left' : 
                     left.nova_score > right.nova_score ? 'right' : 'tie';
  
  // Determine overall winner
  let winner: 'left' | 'right' | 'tie' = 'tie';
  let summary = '';
  
  if (nutriScoreWinner === novaWinner) {
    winner = nutriScoreWinner;
    if (winner === 'tie') {
      summary = 'Both products have similar health profiles';
    } else {
      summary = `${winner === 'left' ? left.name : right.name} is the healthier choice`;
    }
  } else if (nutriScoreWinner === 'tie') {
    winner = novaWinner;
    summary = novaWinner === 'tie' 
      ? 'Both products have similar health profiles'
      : `${novaWinner === 'left' ? left.name : right.name} is less processed`;
  } else if (novaWinner === 'tie') {
    winner = nutriScoreWinner;
    summary = `${nutriScoreWinner === 'left' ? left.name : right.name} has better nutritional value`;
  } else {
    // Mixed results - consider both factors
    // Nutri-Score is generally more comprehensive, so weight it slightly higher
    const leftScore = (5 - left.nova_score) + (6 - leftNutri) * 1.2;
    const rightScore = (5 - right.nova_score) + (6 - rightNutri) * 1.2;
    
    if (Math.abs(leftScore - rightScore) < 0.5) {
      winner = 'tie';
      summary = 'Trade-off: different health strengths';
    } else if (leftScore > rightScore) {
      winner = 'left';
      summary = `${left.name} is slightly healthier overall`;
    } else {
      winner = 'right';
      summary = `${right.name} is slightly healthier overall`;
    }
  }
  
  return { winner, nutriScoreWinner, novaWinner, summary };
};

const ProductSelect = ({
  label,
  products,
  selectedId,
  onSelect,
}: {
  label: string;
  products: Product[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) => {
  const [open, setOpen] = useState(false);

  const selectedProduct = products.find(p => p.id === selectedId);

  return (
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerLabel}>{label}</Text>

      <Pressable
        style={styles.selectBox}
        onPress={() => setOpen(prev => !prev)}
      >
        <Text style={styles.selectText}>
          {selectedProduct?.name ?? 'Select product'}
        </Text>
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.dropdownText}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
};

export const CompareScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [leftProductId, setLeftProductId] = useState<number | null>(null);
  const [rightProductId, setRightProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  api.products
    .getAll()
    .then(res => {
      console.log('RAW /products RESPONSE:', res);

      const productsArray: any[] = Array.isArray(res)
        ? res
        : (res as any).results ?? Object.values(res);

      console.log('NORMALISED ARRAY LENGTH:', productsArray.length);
      console.log('FIRST ITEM:', productsArray[0]);

      const cleaned: Product[] = productsArray.filter(
        (p): p is Product => p && typeof p === 'object' && typeof p.id === 'number'
      );

      console.log('CLEANED LENGTH:', cleaned.length);

      setProducts(cleaned);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    console.log('PRODUCTS:', products);
  }, [products]);


  const leftProduct = products.find(p => p.id === leftProductId);
  const rightProduct = products.find(p => p.id === rightProductId);

  // Compute health comparison when both products selected
  const healthComparison = useMemo(() => {
    if (leftProduct && rightProduct) {
      return compareHealth(leftProduct, rightProduct);
    }
    return null;
  }, [leftProduct, rightProduct]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.dark} />
        <Text style={styles.loadingText}>Loading products…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Compare Products</Text>
          <Text style={styles.headerSubtitle}>
            Select two items to compare their nutritional indicators
          </Text>
        </View>

        {/* Product selectors */}
        <ProductSelect
          label="First product"
          products={products}
          selectedId={leftProductId}
          onSelect={setLeftProductId}
        />

        <ProductSelect
          label="Second product"
          products={products}
          selectedId={rightProductId}
          onSelect={setRightProductId}
        />

        {/* Comparison */}
        {leftProduct && rightProduct && healthComparison && (
          <>
            {/* Health Winner Banner */}
            <View style={[
              styles.winnerBanner, 
              { backgroundColor: healthComparison.winner === 'tie' 
                ? colors.neutral.lightGray 
                : colors.nutriScore.A 
              }
            ]}>
              <Ionicons 
                name={healthComparison.winner === 'tie' ? 'swap-horizontal' : 'trophy'} 
                size={24} 
                color={colors.neutral.white} 
              />
              <Text style={styles.winnerText}>{healthComparison.summary}</Text>
            </View>

            <View style={styles.comparisonCard}>
              <View style={styles.comparisonHeaderRow}>
                <Text style={styles.cellLabel} />
                <View style={styles.headerCellContainer}>
                  {healthComparison.winner === 'left' && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.nutriScore.A} />
                  )}
                  <Text style={[
                    styles.headerCell,
                    healthComparison.winner === 'left' && styles.winnerHeaderCell
                  ]} numberOfLines={2}>
                    {leftProduct.name}
                  </Text>
                </View>
                <View style={styles.headerCellContainer}>
                  {healthComparison.winner === 'right' && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.nutriScore.A} />
                  )}
                  <Text style={[
                    styles.headerCell,
                    healthComparison.winner === 'right' && styles.winnerHeaderCell
                  ]} numberOfLines={2}>
                    {rightProduct.name}
                  </Text>
                </View>
              </View>

              {/* NOVA Score Row */}
              <View style={styles.comparisonRow}>
                <Text style={styles.cellLabel}>NOVA Score</Text>
                <View style={[
                  styles.scoreCellContainer,
                  healthComparison.novaWinner === 'left' && styles.winnerCell
                ]}>
                  <View style={[styles.scoreBadge, { backgroundColor: getNovaColor(leftProduct.nova_score) }]}>
                    <Text style={styles.scoreBadgeText}>{leftProduct.nova_score}</Text>
                  </View>
                  {healthComparison.novaWinner === 'left' && (
                    <Ionicons name="arrow-down" size={12} color={colors.nutriScore.A} />
                  )}
                </View>
                <View style={[
                  styles.scoreCellContainer,
                  healthComparison.novaWinner === 'right' && styles.winnerCell
                ]}>
                  <View style={[styles.scoreBadge, { backgroundColor: getNovaColor(rightProduct.nova_score) }]}>
                    <Text style={styles.scoreBadgeText}>{rightProduct.nova_score}</Text>
                  </View>
                  {healthComparison.novaWinner === 'right' && (
                    <Ionicons name="arrow-down" size={12} color={colors.nutriScore.A} />
                  )}
                </View>
              </View>

              {/* Nutri-Score Row */}
              <View style={styles.comparisonRow}>
                <Text style={styles.cellLabel}>Nutri-Score</Text>
                <View style={[
                  styles.scoreCellContainer,
                  healthComparison.nutriScoreWinner === 'left' && styles.winnerCell
                ]}>
                  <View style={[styles.scoreBadge, { backgroundColor: getNutriScoreColor(leftProduct.nutri_score) }]}>
                    <Text style={styles.scoreBadgeText}>{leftProduct.nutri_score}</Text>
                  </View>
                  {healthComparison.nutriScoreWinner === 'left' && (
                    <Ionicons name="arrow-up" size={12} color={colors.nutriScore.A} />
                  )}
                </View>
                <View style={[
                  styles.scoreCellContainer,
                  healthComparison.nutriScoreWinner === 'right' && styles.winnerCell
                ]}>
                  <View style={[styles.scoreBadge, { backgroundColor: getNutriScoreColor(rightProduct.nutri_score) }]}>
                    <Text style={styles.scoreBadgeText}>{rightProduct.nutri_score}</Text>
                  </View>
                  {healthComparison.nutriScoreWinner === 'right' && (
                    <Ionicons name="arrow-up" size={12} color={colors.nutriScore.A} />
                  )}
                </View>
              </View>

              {/* Category Row */}
              <View style={[styles.comparisonRow, styles.lastRow]}>
                <Text style={styles.cellLabel}>Category</Text>
                <Text style={styles.cellValue}>{leftProduct.category}</Text>
                <Text style={styles.cellValue}>{rightProduct.category}</Text>
              </View>
            </View>

            {/* Health Explanation */}
            <View style={styles.explanationCard}>
              <View style={styles.explanationRow}>
                <Ionicons name="nutrition" size={16} color={colors.nutriScore.A} />
                <Text style={styles.explanationText}>
                  <Text style={styles.boldText}>Nutri-Score:</Text> A (best) to E (worst) - measures overall nutritional quality
                </Text>
              </View>
              <View style={styles.explanationRow}>
                <Ionicons name="flask" size={16} color={colors.nova[1]} />
                <Text style={styles.explanationText}>
                  <Text style={styles.boldText}>NOVA Score:</Text> 1 (unprocessed) to 4 (ultra-processed) - measures processing level
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },

  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },

  header: {
    marginBottom: spacing.lg,
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

  pickerContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },

  pickerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.darkGray,
    marginBottom: spacing.xs,
  },

  selectBox: {
    backgroundColor: colors.neutral.offWhite,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
  },

  selectText: {
    fontSize: typography.fontSize.base,
    color: colors.primary.dark,
  },

  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    maxHeight: 220,
    ...shadows.md,
  },

  dropdownItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },

  dropdownText: {
    fontSize: typography.fontSize.base,
    color: colors.primary.dark,
  },

  comparisonCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.lg,
  },

  comparisonHeaderRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },

  comparisonRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
  },

  lastRow: {
    borderBottomWidth: 0,
  },

  cellLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.darkGray,
  },

  cellValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary.dark,
    textAlign: 'center',
  },

  headerCell: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
    textAlign: 'center',
  },

  headerCellContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },

  winnerHeaderCell: {
    color: colors.nutriScore.A,
  },

  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },

  winnerText: {
    color: colors.neutral.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    flexShrink: 1,
  },

  scoreCellContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },

  winnerCell: {
    backgroundColor: colors.nutriScore.A + '15',
  },

  scoreBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 28,
    alignItems: 'center',
  },

  scoreBadgeText: {
    color: colors.neutral.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  explanationCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },

  explanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  explanationText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    lineHeight: 18,
  },

  boldText: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.offWhite,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
  },
});

export default CompareScreen;