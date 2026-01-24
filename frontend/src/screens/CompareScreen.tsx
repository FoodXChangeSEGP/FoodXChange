import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, Product } from '@/services/api';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '@/theme';

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
      const productsArray: Product[] = (
        Array.isArray(res) ? res : Object.values(res)
      ).filter(
        (p): p is Product =>
          p !== null &&
          typeof p === 'object' &&
          typeof (p as any).id === 'number'
      );

      setProducts(productsArray);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);


  const leftProduct = products.find(p => p.id === leftProductId);
  const rightProduct = products.find(p => p.id === rightProductId);

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
        {leftProduct && rightProduct && (
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeaderRow}>
              <Text style={styles.cellLabel} />
              <Text style={styles.headerCell}>{leftProduct.name}</Text>
              <Text style={styles.headerCell}>{rightProduct.name}</Text>
            </View>

            <View style={styles.comparisonRow}>
              <Text style={styles.cellLabel}>NOVA Score</Text>
              <Text style={styles.cellValue}>
                {leftProduct.nova_score_display}
              </Text>
              <Text style={styles.cellValue}>
                {rightProduct.nova_score_display}
              </Text>
            </View>

            <View style={styles.comparisonRow}>
              <Text style={styles.cellLabel}>Nutri-Score</Text>
              <Text style={styles.cellValue}>
                {leftProduct.nutri_score_display}
              </Text>
              <Text style={styles.cellValue}>
                {rightProduct.nutri_score_display}
              </Text>
            </View>

            <View style={[styles.comparisonRow, styles.lastRow]}>
              <Text style={styles.cellLabel}>Category</Text>
              <Text style={styles.cellValue}>{leftProduct.category}</Text>
              <Text style={styles.cellValue}>{rightProduct.category}</Text>
            </View>
          </View>
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