import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, Product } from '@/services/api';
import {
  useTheme,
  spacing,
  typography,
  borderRadius,
  glassShadows,
  glass,
  getNovaColor,
  getNutriScoreColor,
} from '@/theme';
import { GlassCard, AnimatedPressable, ScoreBadge } from '@/components';

const nutriScoreRank = (score: string | null): number => {
  if (!score) return 999;
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  return map[score.toUpperCase()] ?? 999;
};

interface HealthComparison {
  winner: 'left' | 'right' | 'tie';
  summary: string;
  novaWinner: 'left' | 'right' | 'tie';
  nutriScoreWinner: 'left' | 'right' | 'tie';
}

const compareHealth = (
  left: Product | null,
  right: Product | null
): HealthComparison | null => {
  if (!left || !right) return null;

  const leftNova = left.nova_score ?? 999;
  const rightNova = right.nova_score ?? 999;
  const leftNutri = nutriScoreRank(left.nutri_score);
  const rightNutri = nutriScoreRank(right.nutri_score);

  let novaWinner: 'left' | 'right' | 'tie' = 'tie';
  if (leftNova < rightNova) novaWinner = 'left';
  else if (rightNova < leftNova) novaWinner = 'right';

  let nutriScoreWinner: 'left' | 'right' | 'tie' = 'tie';
  if (leftNutri < rightNutri) nutriScoreWinner = 'left';
  else if (rightNutri < leftNutri) nutriScoreWinner = 'right';

  let overall: 'left' | 'right' | 'tie' = 'tie';
  let summary = '';

  if (novaWinner === 'left' && nutriScoreWinner === 'left') {
    overall = 'left';
    summary = `${left.name} is healthier on both scores`;
  } else if (novaWinner === 'right' && nutriScoreWinner === 'right') {
    overall = 'right';
    summary = `${right.name} is healthier on both scores`;
  } else if (novaWinner === nutriScoreWinner && novaWinner !== 'tie') {
    overall = novaWinner;
    summary = `${novaWinner === 'left' ? left.name : right.name} is healthier overall`;
  } else if (novaWinner !== 'tie' && nutriScoreWinner !== 'tie') {
    summary = 'Mixed results - each product wins on one score';
  } else if (novaWinner !== 'tie') {
    overall = novaWinner;
    summary = `${novaWinner === 'left' ? left.name : right.name} is less processed (NOVA)`;
  } else if (nutriScoreWinner !== 'tie') {
    overall = nutriScoreWinner;
    summary = `${nutriScoreWinner === 'left' ? left.name : right.name} has better nutrition (Nutri-Score)`;
  } else {
    summary = 'Both products have similar health indicators';
  }

  return {
    winner: overall,
    summary,
    novaWinner,
    nutriScoreWinner,
  };
};

interface ProductSelectProps {
  label: string;
  products: Product[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const ProductSelect: React.FC<ProductSelectProps> = ({
  label,
  products,
  selectedId,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const selectedProduct = products.find((p) => p.id === selectedId);

  return (
    <GlassCard blur="subtle" padding="md" style={styles.pickerContainer}>
      <Text style={[styles.pickerLabel, { color: colors.neutral.darkGray }]}>
        {label}
      </Text>
      <AnimatedPressable
        style={[
          styles.selectBox,
          {
            backgroundColor: colors.surface.glassOverlay,
            borderColor: colors.surface.glassBorder,
          },
        ]}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text
          style={[
            styles.selectText,
            {
              color: selectedProduct
                ? colors.neutral.charcoal
                : colors.neutral.gray,
            },
          ]}
        >
          {selectedProduct?.name ?? 'Select product'}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.neutral.gray}
        />
      </AnimatedPressable>

      {open && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface.glass,
              borderColor: colors.surface.glassBorder,
            },
          ]}
        >
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <AnimatedPressable
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: colors.surface.glassBorder },
                ]}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    { color: colors.neutral.charcoal },
                  ]}
                >
                  {item.name}
                </Text>
              </AnimatedPressable>
            )}
          />
        </View>
      )}
    </GlassCard>
  );
};

export const CompareScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [leftProductId, setLeftProductId] = useState<number | null>(null);
  const [rightProductId, setRightProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.products
      .getAll()
      .then((res) => {
        const productsArray: any[] = Array.isArray(res)
          ? res
          : (res as any).results ?? Object.values(res);

        const cleaned: Product[] = productsArray.filter(
          (p): p is Product => p && typeof p === 'object' && typeof p.id === 'number'
        );

        setProducts(cleaned);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const leftProduct = products.find((p) => p.id === leftProductId) ?? null;
  const rightProduct = products.find((p) => p.id === rightProductId) ?? null;

  const healthComparison = useMemo(
    () => compareHealth(leftProduct, rightProduct),
    [leftProduct, rightProduct]
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.surface.background },
        ]}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
          Loading products…
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>
            Compare
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.neutral.darkGray }]}
          >
            Select two items to compare their nutritional indicators
          </Text>
        </View>

        <ProductSelect
          label="First Product"
          products={products}
          selectedId={leftProductId}
          onSelect={setLeftProductId}
        />
        <ProductSelect
          label="Second Product"
          products={products}
          selectedId={rightProductId}
          onSelect={setRightProductId}
        />

        {leftProduct && rightProduct && healthComparison && (
          <>
            <GlassCard
              blur="medium"
              glow={healthComparison.winner !== 'tie'}
              padding="none"
              style={styles.winnerBanner}
            >
              <LinearGradient
                colors={
                  healthComparison.winner === 'tie'
                    ? [colors.neutral.gray, colors.neutral.darkGray]
                    : [colors.primary.main, colors.primary.dark]
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.winnerContent}>
                <Ionicons
                  name={
                    healthComparison.winner === 'tie'
                      ? 'swap-horizontal'
                      : 'trophy'
                  }
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.winnerText}>{healthComparison.summary}</Text>
              </View>
            </GlassCard>

            <GlassCard blur="subtle" padding="lg" style={styles.comparisonCard}>
              <View style={styles.comparisonHeaderRow}>
                <Text style={styles.cellLabel} />
                <View style={styles.headerCellContainer}>
                  {healthComparison.winner === 'left' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary.main}
                    />
                  )}
                  <Text
                    style={[
                      styles.headerCell,
                      {
                        color:
                          healthComparison.winner === 'left'
                            ? colors.primary.main
                            : colors.neutral.charcoal,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {leftProduct.name}
                  </Text>
                </View>
                <View style={styles.headerCellContainer}>
                  {healthComparison.winner === 'right' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.primary.main}
                    />
                  )}
                  <Text
                    style={[
                      styles.headerCell,
                      {
                        color:
                          healthComparison.winner === 'right'
                            ? colors.primary.main
                            : colors.neutral.charcoal,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {rightProduct.name}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.comparisonRow,
                  { borderBottomColor: colors.surface.glassBorder },
                ]}
              >
                <Text
                  style={[styles.cellLabel, { color: colors.neutral.darkGray }]}
                >
                  NOVA Score
                </Text>
                <View
                  style={[
                    styles.scoreCellContainer,
                    healthComparison.novaWinner === 'left' && {
                      backgroundColor: colors.primary.main + '15',
                    },
                  ]}
                >
                  <ScoreBadge
                    type="nova"
                    value={leftProduct.nova_score}
                    size="md"
                  />
                </View>
                <View
                  style={[
                    styles.scoreCellContainer,
                    healthComparison.novaWinner === 'right' && {
                      backgroundColor: colors.primary.main + '15',
                    },
                  ]}
                >
                  <ScoreBadge
                    type="nova"
                    value={rightProduct.nova_score}
                    size="md"
                  />
                </View>
              </View>

              <View
                style={[
                  styles.comparisonRow,
                  { borderBottomColor: colors.surface.glassBorder },
                ]}
              >
                <Text
                  style={[styles.cellLabel, { color: colors.neutral.darkGray }]}
                >
                  Nutri-Score
                </Text>
                <View
                  style={[
                    styles.scoreCellContainer,
                    healthComparison.nutriScoreWinner === 'left' && {
                      backgroundColor: colors.primary.main + '15',
                    },
                  ]}
                >
                  <ScoreBadge
                    type="nutri"
                    value={leftProduct.nutri_score}
                    size="md"
                  />
                </View>
                <View
                  style={[
                    styles.scoreCellContainer,
                    healthComparison.nutriScoreWinner === 'right' && {
                      backgroundColor: colors.primary.main + '15',
                    },
                  ]}
                >
                  <ScoreBadge
                    type="nutri"
                    value={rightProduct.nutri_score}
                    size="md"
                  />
                </View>
              </View>

              <View style={styles.comparisonRow}>
                <Text
                  style={[styles.cellLabel, { color: colors.neutral.darkGray }]}
                >
                  Category
                </Text>
                <Text
                  style={[styles.cellValue, { color: colors.neutral.charcoal }]}
                >
                  {leftProduct.category}
                </Text>
                <Text
                  style={[styles.cellValue, { color: colors.neutral.charcoal }]}
                >
                  {rightProduct.category}
                </Text>
              </View>
            </GlassCard>

            <GlassCard blur="subtle" padding="md" style={styles.explanationCard}>
              <View style={styles.explanationRow}>
                <Ionicons
                  name="nutrition"
                  size={16}
                  color={colors.primary.main}
                />
                <Text
                  style={[
                    styles.explanationText,
                    { color: colors.neutral.darkGray },
                  ]}
                >
                  <Text
                    style={[styles.boldText, { color: colors.neutral.charcoal }]}
                  >
                    Nutri-Score:
                  </Text>{' '}
                  A (best) to E (worst) - measures overall nutritional quality
                </Text>
              </View>
              <View style={styles.explanationRow}>
                <Ionicons name="flask" size={16} color={colors.accent.orange} />
                <Text
                  style={[
                    styles.explanationText,
                    { color: colors.neutral.darkGray },
                  ]}
                >
                  <Text
                    style={[styles.boldText, { color: colors.neutral.charcoal }]}
                  >
                    NOVA Score:
                  </Text>{' '}
                  1 (unprocessed) to 4 (ultra-processed) - measures processing
                  level
                </Text>
              </View>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.md,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  pickerContainer: {
    marginBottom: spacing.lg,
  },
  pickerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  selectText: {
    fontSize: typography.fontSize.md,
    flex: 1,
  },
  dropdown: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  dropdownText: {
    fontSize: typography.fontSize.md,
  },
  winnerBanner: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderRadius: borderRadius.xl,
    position: 'relative',
  },
  winnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  winnerText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    flex: 1,
  },
  comparisonCard: {
    marginBottom: spacing.lg,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  headerCellContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerCell: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  cellLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  scoreCellContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  cellValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
  explanationCard: {
    gap: spacing.md,
  },
  explanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  explanationText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: typography.fontWeight.semibold,
  },
});

export default CompareScreen;
