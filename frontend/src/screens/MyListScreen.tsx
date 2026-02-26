import React, { useEffect, useCallback } from 'react';
import { CombinedProduct, RetailerPrice, api } from '@/services/api';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMyListStore, useCartStore, MyListItem } from '@/store';
import { useTheme, spacing, typography, borderRadius, glassShadows } from '@/theme';
import { GlassCard, AnimatedPressable, PlaceholderCard, GradientButton, PriceTag } from '@/components';

interface MyListScreenProps {
  onProductPress?: (product: CombinedProduct) => void;
  onAddToCart?: (item: MyListItem) => void;
  onAddAll?: (items: MyListItem[]) => void;
}

export const MyListScreen: React.FC<MyListScreenProps> = ({
  onProductPress,
  onAddToCart,
  onAddAll,
}) => {
  const { colors, isDark } = useTheme();
  const { items, loading, fetchMyList, removeItem } = useMyListStore();
  const cartStore = useCartStore();

  useEffect(() => {
    fetchMyList();
  }, [fetchMyList]);

  const handleProductPress = useCallback(
    (item: MyListItem) => {
      if (!item.productData) return;
      if (onProductPress) {
        onProductPress(item.productData);
      }
    },
    [onProductPress],
  );

  const handleAddToCart = useCallback(
    (item: MyListItem) => {
      if (onAddToCart) {
        onAddToCart(item);
        return;
      }
      if (item.productData) {
        cartStore.addItem(item.productData as any, item.quantity);
        Alert.alert('Added to Cart', `${item.name} has been added to your cart.`);
      } else {
        Alert.alert('Unavailable', 'Price data is not available for this item yet.');
      }
    },
    [onAddToCart, cartStore],
  );

  const handleAddAll = useCallback(() => {
    if (onAddAll) {
      onAddAll(items);
      return;
    }
    let addedCount = 0;
    for (const item of items) {
      if (item.productData) {
        cartStore.addItem(item.productData as any, item.quantity);
        addedCount++;
      }
    }
    Alert.alert(
      'Added to Cart',
      `${addedCount} of ${items.length} items added to your cart.`,
    );
  }, [onAddAll, items, cartStore]);

  const handleRemove = useCallback(
    (item: MyListItem) => {
      Alert.alert('Remove Item', `Remove "${item.name}" from your list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeItem(item.barcode),
        },
      ]);
    },
    [removeItem],
  );

  const renderItem = useCallback(
    ({ item }: { item: MyListItem }) => (
      <GlassCard
        blur="subtle"
        padding="md"
      >
        <View style={styles.cardRow}>
          <View style={styles.cardInfo}>
            <Text
              style={[styles.productName, { color: colors.neutral.charcoal }]}
              numberOfLines={2}
            >
              {item.name ?? 'Unknown Product'}
            </Text>

            <Text style={[styles.metaText, { color: colors.neutral.darkGray }]}>
              Qty: {item.quantity}
            </Text>

            {item.productData?.prices && item.productData.prices.length > 0 && (
              <View style={styles.retailerTagsRow}>
                {item.productData.prices.map((price: RetailerPrice, idx: number) => (
                  <View
                    key={idx}
                    style={[
                      styles.retailerTag,
                      {
                        borderColor: colors.neutral.lightGray,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      },
                    ]}
                  >
                    <Text style={[styles.retailerTagText, { color: colors.neutral.darkGray }]}>
                      {price.grocer_name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {item.cheapest_price ? (
              <View style={styles.priceRow}>
                <PriceTag
                  price={item.cheapest_price}
                  retailer={item.cheapest_retailer ?? undefined}
                  isCheapest
                  size="sm"
                />
              </View>
            ) : (
              <Text style={[styles.metaText, { color: colors.neutral.gray }]}>
                Fetching prices...
              </Text>
            )}

            <AnimatedPressable
              onPress={() => handleAddToCart(item)}
              style={[
                styles.addToCartButton,
                {
                  borderColor: colors.primary.main,
                  backgroundColor: isDark
                    ? 'rgba(34,197,94,0.1)'
                    : 'rgba(34,197,94,0.06)',
                },
              ]}
            >
              <Ionicons
                name="cart-outline"
                size={14}
                color={colors.primary.main}
              />
              <Text
                style={[styles.addToCartText, { color: colors.primary.main }]}
              >
                Add to Cart
              </Text>
            </AnimatedPressable>
          </View>

          <AnimatedPressable
            onPress={() => handleRemove(item)}
            style={[
              styles.removeButton,
              { backgroundColor: colors.semantic.error },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
          </AnimatedPressable>
        </View>
      </GlassCard>
    ),
    [colors, isDark, handleProductPress, handleAddToCart, handleRemove],
  );

  if (loading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.loadingContainer, { backgroundColor: colors.surface.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
          Loading My List...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.surface.background }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>
            My List
          </Text>
          {items.length > 0 && (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: colors.primary.main },
              ]}
            >
              <Text style={styles.countBadgeText}>{items.length}</Text>
            </View>
          )}
        </View>

        {items.length > 0 && (
          <AnimatedPressable onPress={handleAddAll}>
            <LinearGradient
              colors={[colors.primary.main, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addAllGradient}
            >
              <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
              <Text style={styles.addAllText}>Add All</Text>
            </LinearGradient>
          </AnimatedPressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <GlassCard blur="subtle" padding="lg">
            <View style={styles.emptyContent}>
              <View
                style={[
                  styles.emptyIconWrap,
                  {
                    backgroundColor: isDark
                      ? 'rgba(74,222,128,0.12)'
                      : 'rgba(22,101,52,0.08)',
                  },
                ]}
              >
                <Ionicons
                  name="basket-outline"
                  size={48}
                  color={colors.primary.main}
                />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.neutral.charcoal }]}
              >
                Your list is empty
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.neutral.darkGray }]}
              >
                Save products from search to compare prices and add them to your cart later.
              </Text>
            </View>
          </GlassCard>
        </View>
      ) : (
        <FlatList<MyListItem>
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
    fontSize: typography.fontSize.sm,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },

  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },

  countBadgeText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },

  addAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },

  addAllText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },

  separator: {
    height: spacing.md,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  cardInfo: {
    flex: 1,
  },

  productName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.fontSize.base * typography.lineHeight.tight,
  },

  metaText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },

  retailerTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  retailerTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },

  retailerTagText: {
    fontSize: typography.fontSize.xs,
  },

  priceRow: {
    marginTop: spacing.sm,
  },

  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },

  addToCartText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  removeButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyWrapper: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing['2xl'],
  },

  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },

  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },

  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.relaxed,
    paddingHorizontal: spacing.md,
  },
});

export default MyListScreen;
