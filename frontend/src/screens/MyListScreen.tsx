import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { RetailerPrice } from '@/services/api';
import {
  View,
  Text,
  ActivityIndicator,
  SectionList,
  FlatList,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import {
  useSafeAreaInsets,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMyListStore, MyListItem } from '@/store';
import { useTheme, spacing, typography, borderRadius } from '@/theme';
import { GlassCard, AnimatedPressable, PriceTag } from '@/components';
import { PantryScreen } from './PantryScreen';

type ActiveTab = 'split' | 'compare';

type ProductAtRetailer = {
  item: MyListItem;
  price: RetailerPrice | null;
};

type RetailerSection = {
  title: string;
  retailerId: string;
  data: ProductAtRetailer[];
  totalCost: number;
  isCheapest?: boolean;
};

export const MyListScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { items, loading, fetchMyList } = useMyListStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('split');
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyList();
  }, [fetchMyList]);

  // All retailers that appear in any item's price list
  const availableRetailers = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      for (const price of item.productData?.prices ?? []) {
        if (!map.has(price.grocer_id)) {
          map.set(price.grocer_id, price.grocer_name);
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  // Items available at the selected retailer with that retailer's price
  const filteredByRetailer = useMemo<ProductAtRetailer[]>(() => {
    if (!selectedRetailerId) return [];
    return items
      .filter((item) =>
        item.productData?.prices?.some((p) => p.grocer_id === selectedRetailerId),
      )
      .map((item) => ({
        item,
        price: item.productData!.prices!.find((p) => p.grocer_id === selectedRetailerId)!,
      }));
  }, [items, selectedRetailerId]);

  const filteredTotal = useMemo(
    () =>
      filteredByRetailer.reduce(
        (sum, { item, price }) => sum + parseFloat(price!.price) * item.quantity,
        0,
      ),
    [filteredByRetailer],
  );

  const sections = useMemo<RetailerSection[]>(() => {
    const retailerMap = new Map<string, RetailerSection>();
    const unavailableItems: ProductAtRetailer[] = [];

    for (const item of items) {
      const prices = item.productData?.prices;
      if (!prices || prices.length === 0) {
        unavailableItems.push({ item, price: null });
        continue;
      }

      const cheapestPrice = prices.reduce((cheapest, current) =>
        parseFloat(current.price) < parseFloat(cheapest.price) ? current : cheapest,
      );

      const key = cheapestPrice.grocer_id;
      if (!retailerMap.has(key)) {
        retailerMap.set(key, {
          title: cheapestPrice.grocer_name,
          retailerId: cheapestPrice.grocer_id,
          data: [],
          totalCost: 0,
        });
      }
      const section = retailerMap.get(key)!;
      section.data.push({ item, price: cheapestPrice });
      section.totalCost += parseFloat(cheapestPrice.price) * item.quantity;
    }

    const sorted = Array.from(retailerMap.values()).sort(
      (a, b) => a.totalCost - b.totalCost,
    );

    if (sorted.length > 0) {
      sorted[0].isCheapest = true;
    }

    if (unavailableItems.length > 0) {
      sorted.push({
        title: 'Price Unavailable',
        retailerId: '__unavailable__',
        data: unavailableItems,
        totalCost: 0,
      });
    }

    return sorted;
  }, [items]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: RetailerSection }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: colors.surface.background },
        ]}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
            {section.title}
          </Text>
          {section.isCheapest && section.totalCost > 0 && (
            <View
              style={[
                styles.cheapestBadge,
                { backgroundColor: colors.primary.main },
              ]}
            >
              <Text style={styles.cheapestBadgeText}>Cheapest</Text>
            </View>
          )}
        </View>
        {section.totalCost > 0 && (
          <Text style={[styles.sectionTotal, { color: colors.primary.main }]}>
            £{section.totalCost.toFixed(2)}
          </Text>
        )}
      </View>
    ),
    [colors],
  );

  const renderItem = useCallback(
    ({ item: { item, price } }: { item: ProductAtRetailer }) => (
      <GlassCard blur="subtle" padding="md">
        <View style={styles.cardRow}>
          <View style={[styles.cardThumb, { backgroundColor: colors.surface.glassOverlay }]}>
            {item.productData?.image_url ? (
              <Image
                source={{ uri: item.productData.image_url }}
                style={styles.cardThumbImage}
              />
            ) : (
              <Ionicons name="cube-outline" size={24} color={colors.neutral.gray} />
            )}
          </View>

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

            {price ? (
              <View style={styles.priceRow}>
                <PriceTag price={parseFloat(price.price)} size="sm" />
                {price.is_on_sale && price.promotion_description ? (
                  <Text
                    style={[styles.promoText, { color: colors.accent.lime }]}
                  >
                    {price.promotion_description}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.metaText, { color: colors.neutral.gray }]}>
                Fetching prices...
              </Text>
            )}
          </View>
        </View>
      </GlassCard>
    ),
    [colors],
  );

  // Zero out the top inset so PantryScreen's own SafeAreaView doesn't double-pad
  const zeroTopInsets = useMemo(
    () => ({ ...insets, top: 0 }),
    [insets],
  );

  const tabBarHeight = 44;

  const retailerFilterRow = activeTab === 'split' && availableRetailers.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterChipsScroll}
      contentContainerStyle={styles.filterChips}
    >
      <AnimatedPressable
        onPress={() => setSelectedRetailerId(null)}
        style={[
          styles.filterChip,
          selectedRetailerId === null && { backgroundColor: colors.primary.main },
          selectedRetailerId !== null && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          },
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: selectedRetailerId === null ? '#FFFFFF' : colors.neutral.gray },
          ]}
        >
          All
        </Text>
      </AnimatedPressable>
      {availableRetailers.map((r) => {
        const isActive = selectedRetailerId === r.id;
        return (
          <AnimatedPressable
            key={r.id}
            onPress={() => setSelectedRetailerId(r.id)}
            style={[
              styles.filterChip,
              isActive
                ? { backgroundColor: colors.primary.main }
                : {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.05)',
                  },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: isActive ? '#FFFFFF' : colors.neutral.gray },
              ]}
            >
              {r.name}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  ) : null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
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
      </View>

      {/* Sub-tab switcher */}
      <View
        style={[
          styles.tabSwitcher,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.05)',
            height: tabBarHeight,
          },
        ]}
      >
        {(['split', 'compare'] as ActiveTab[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <AnimatedPressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabPill,
                isActive && { backgroundColor: colors.primary.main },
              ]}
            >
              <Ionicons
                name={
                  tab === 'split'
                    ? isActive
                      ? 'layers'
                      : 'layers-outline'
                    : isActive
                      ? 'git-compare'
                      : 'git-compare-outline'
                }
                size={15}
                color={isActive ? '#FFFFFF' : colors.neutral.gray}
              />
              <Text
                style={[
                  styles.tabPillText,
                  { color: isActive ? '#FFFFFF' : colors.neutral.gray },
                ]}
              >
                {tab === 'split' ? 'Split' : 'Compare'}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'split' ? (
        loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
              Loading My List...
            </Text>
          </View>
        ) : items.length === 0 ? (
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
                  Save products from search to compare prices and add them to
                  your cart.
                </Text>
              </View>
            </GlassCard>
          </View>
        ) : (
          <>
            {retailerFilterRow}
            {selectedRetailerId ? (
              <>
                {/* Retailer filter header */}
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: colors.surface.background },
                  ]}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
                      {availableRetailers.find((r) => r.id === selectedRetailerId)?.name ?? selectedRetailerId}
                    </Text>
                    <View style={[styles.cheapestBadge, { backgroundColor: colors.primary.main + '30' }]}>
                      <Text style={[styles.cheapestBadgeText, { color: colors.primary.main }]}>
                        {filteredByRetailer.length} available
                      </Text>
                    </View>
                  </View>
                  {filteredTotal > 0 && (
                    <Text style={[styles.sectionTotal, { color: colors.primary.main }]}>
                      £{filteredTotal.toFixed(2)}
                    </Text>
                  )}
                </View>
                {filteredByRetailer.length === 0 ? (
                  <View style={styles.emptyWrapper}>
                    <GlassCard blur="subtle" padding="lg">
                      <View style={styles.emptyContent}>
                        <Ionicons name="storefront-outline" size={40} color={colors.neutral.gray} />
                        <Text style={[styles.emptyTitle, { color: colors.neutral.charcoal }]}>
                          No items available
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: colors.neutral.darkGray }]}>
                          None of your saved products are stocked at this retailer.
                        </Text>
                      </View>
                    </GlassCard>
                  </View>
                ) : (
                  <FlatList<ProductAtRetailer>
                    data={filteredByRetailer}
                    keyExtractor={(par, index) =>
                      `${par.item.id}-${par.price?.grocer_id ?? 'na'}-${index}`
                    }
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                  />
                )}
              </>
            ) : (
              <SectionList<ProductAtRetailer, RetailerSection>
                sections={sections}
                keyExtractor={(productAtRetailer, index) =>
                  `${productAtRetailer.item.id}-${productAtRetailer.price?.grocer_id ?? 'na'}-${index}`
                }
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                SectionSeparatorComponent={() => (
                  <View style={styles.sectionSeparator} />
                )}
              />
            )}
          </>
        )
      ) : (
        <SafeAreaInsetsContext.Provider value={zeroTopInsets}>
          <PantryScreen />
        </SafeAreaInsetsContext.Provider>
      )}
    </View>
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

  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    padding: 3,
    gap: 3,
  },

  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
  },

  tabPillText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  filterChipsScroll: {
    flexGrow: 0,
  },

  filterChips: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    flexDirection: 'row',
  },

  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },

  filterChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },

  cheapestBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },

  cheapestBadgeText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  sectionTotal: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },

  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 120,
  },

  sectionSeparator: {
    height: spacing.sm,
  },

  separator: {
    height: spacing.sm,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  cardThumb: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },

  cardThumbImage: {
    width: 52,
    height: 52,
    resizeMode: 'contain',
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

  priceRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  promoText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
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
