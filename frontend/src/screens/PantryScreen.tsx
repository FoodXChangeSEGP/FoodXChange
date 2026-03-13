import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, typography, textFont, glassShadows, glass } from '@/theme';
import { GlassCard, GlassModal, AnimatedPressable, ScoreBadge, PriceTag, PlaceholderCard } from '@/components';
import {
  api,
  CombinedProduct,
} from '@/services/api';
import { useShoppingStore, useCartStore, useMyListStore, CartItem } from '@/store';

interface PantryScreenProps {
  onProductPress?: (product: CombinedProduct) => void;
}

export const PantryScreen: React.FC<PantryScreenProps> = ({ onProductPress }) => {
  const { colors, isDark } = useTheme();

  const { lists, setLists, activeListId, setActiveList } = useShoppingStore();

  const {
    items: cartItems,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    addItem,
  } = useCartStore();

  const { addItem: addToMyList, removeItem: removeFromMyList } = useMyListStore();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedRetailer, setExpandedRetailer] = useState<string | null>(null);

  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapFromCart, setSwapFromCart] = useState<{
    code: string;
    name: string;
    image_url?: string | null;
    cheapest_price?: string | null;
    nutriscore_grade?: string | null;
    nova_group?: number | null;
    quantity: number;
  } | null>(null);
  const [alternatives, setAlternatives] = useState<CombinedProduct[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const [retailerOverrides, setRetailerOverrides] = useState<
    Record<string, Record<string, { name: string; price: string; altCode: string }>>
  >({});
  const [retailerSwapContext, setRetailerSwapContext] = useState<{
    grocerId: string;
    grocerName: string;
    cartItemCode: string;
    cartItemName: string;
  } | null>(null);
  const [retailerSwapModalVisible, setRetailerSwapModalVisible] = useState(false);
  const [retailerAlternatives, setRetailerAlternatives] = useState<CombinedProduct[]>([]);
  const [loadingRetailerAlternatives, setLoadingRetailerAlternatives] = useState(false);

  const buildCartItemFromCombinedProduct = (product: CombinedProduct) => {
    const nutriGrade = product.nutrition?.nutriscore_grade || 'unknown';
    const validGrades = ['a', 'b', 'c', 'd', 'e', 'unknown'] as const;
    type NutriGrade = (typeof validGrades)[number];

    const novaGroup = product.nutrition?.nova_group;
    const validNovaGroup = (novaGroup && [1, 2, 3, 4].includes(novaGroup) ? novaGroup : null) as
      | 1
      | 2
      | 3
      | 4
      | null;

    return {
      id: parseInt(product.barcode) || Math.random(),
      code: product.barcode,
      product_name: product.name,
      brands: product.brand || '',
      image_url: product.image_url,
      nutriscore_grade: (validGrades.includes(nutriGrade as NutriGrade) ? nutriGrade : 'unknown') as NutriGrade,
      nutriscore_display: product.nutrition?.nutriscore_display || 'Unknown',
      nova_group: validNovaGroup,
      nova_display: product.nutrition?.nova_display || 'Unknown',
      traffic_light: product.nutrition?.traffic_light || {
        sugars: { value: null, level: 'unknown' as const },
        salt: { value: null, level: 'unknown' as const },
        fat: { value: null, level: 'unknown' as const },
        saturated_fat: { value: null, level: 'unknown' as const },
      },
      cheapest_price: product.cheapest_price,
      prices: product.prices,
    };
  };

  const handleSwapPress = useCallback(async (cartItem: CartItem) => {
    const p = cartItem.product;

    setSwapFromCart({
      code: p.code,
      name: p.product_name,
      image_url: p.image_url,
      cheapest_price: p.cheapest_price ?? null,
      nutriscore_grade: p.nutriscore_grade ?? null,
      nova_group: (p.nova_group as number | null) ?? null,
      quantity: cartItem.quantity,
    });

    setSwapModalVisible(true);
    setLoadingAlternatives(true);
    setAlternatives([]);

    try {
      const seed = (p.product_name || '').split(' ').slice(0, 3).join(' ').trim();
      const response = await api.grocers.search(seed, {
        page_size: 20,
        include_nutrition: true,
      });

      let altProducts = response.products.filter((x) => x.barcode !== p.code);

      const scored = altProducts.map((alt) => {
        let score = 0;

        const nutriScoreRank: Record<string, number> = {
          a: 5,
          b: 4,
          c: 3,
          d: 2,
          e: 1,
          unknown: 0,
        };

        const originalNutri = (p.nutriscore_grade || 'unknown').toLowerCase();
        const altNutri = (alt.nutrition?.nutriscore_grade || 'unknown').toLowerCase();

        const nutriDiff = (nutriScoreRank[altNutri] || 0) - (nutriScoreRank[originalNutri] || 0);
        score += nutriDiff * 20;

        const originalNova = (p.nova_group as number | undefined) || 4;
        const altNova = alt.nutrition?.nova_group || 4;
        const novaDiff = originalNova - altNova;
        score += novaDiff * 15;

        const originalPrice = parseFloat(p.cheapest_price || '999');
        const altPrice = parseFloat(alt.cheapest_price || '999');
        if (altPrice < originalPrice) score += 10;

        return { product: alt, score };
      });

      scored.sort((a, b) => b.score - a.score);
      setAlternatives(scored.slice(0, 10).map((s) => s.product));
    } catch (error) {
      console.error('Error finding alternatives:', error);
      Alert.alert('Error', 'Unable to find alternatives. Please try again.');
    } finally {
      setLoadingAlternatives(false);
    }
  }, []);

  const performSwap = useCallback(
    (alt: CombinedProduct) => {
      if (!swapFromCart) return;

      removeItem(swapFromCart.code);

      const newCartItem = buildCartItemFromCombinedProduct(alt);
      addItem(newCartItem, swapFromCart.quantity);

      setSwapModalVisible(false);
      setSwapFromCart(null);
      setAlternatives([]);

      Alert.alert('Swapped!', `${alt.name} has replaced your item in the cart.`);
    },
    [swapFromCart, removeItem, addItem],
  );

  const handleRetailerSwapPress = useCallback(async (
    grocerId: string,
    grocerName: string,
    cartItemCode: string,
    cartItemName: string,
  ) => {
    setRetailerSwapContext({ grocerId, grocerName, cartItemCode, cartItemName });
    setRetailerSwapModalVisible(true);
    setLoadingRetailerAlternatives(true);
    setRetailerAlternatives([]);

    try {
      const seed = cartItemName.split(' ').slice(0, 3).join(' ').trim();
      const response = await api.grocers.search(seed, { page_size: 20, include_nutrition: true });
      const atRetailer = response.products.filter(
        (x) => x.barcode !== cartItemCode && x.prices?.some((p) => p.grocer_id === grocerId),
      );
      setRetailerAlternatives(atRetailer.slice(0, 10));
    } catch {
      Alert.alert('Error', 'Unable to find alternatives. Please try again.');
    } finally {
      setLoadingRetailerAlternatives(false);
    }
  }, []);

  const performRetailerSwap = useCallback(async (alt: CombinedProduct) => {
    if (!retailerSwapContext) return;
    const { grocerId, cartItemCode } = retailerSwapContext;
    const priceAtRetailer = alt.prices?.find((p) => p.grocer_id === grocerId);
    if (!priceAtRetailer) return;

    // Save override so the Compare view shows the swapped item in that retailer's section
    setRetailerOverrides((prev) => ({
      ...prev,
      [grocerId]: {
        ...(prev[grocerId] ?? {}),
        [cartItemCode]: { name: alt.name, price: priceAtRetailer.price, altCode: alt.barcode },
      },
    }));

    // Also save the alternative to MyList so it appears in the Split view
    const originalQty = cartItems.find((ci) => ci.product.code === cartItemCode)?.quantity ?? 1;
    try {
      await addToMyList(alt.barcode, alt.name, originalQty);
    } catch {
      // Item may already be in MyList — that's fine
    }

    setRetailerSwapModalVisible(false);
    setRetailerSwapContext(null);
    setRetailerAlternatives([]);
  }, [retailerSwapContext, cartItems, addToMyList]);

  // Background sync for shopping lists (kept for backend)
  const fetchShoppingLists = useCallback(async () => {
    try {
      const fetchedLists = await api.shoppingLists.getAll();
      setLists(fetchedLists);
      if (fetchedLists.length > 0 && !activeListId) {
        setActiveList(fetchedLists[0].id);
      }
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
    } finally {
      setRefreshing(false);
    }
  }, [setLists, activeListId, setActiveList]);

  useEffect(() => {
    fetchShoppingLists();
  }, [fetchShoppingLists]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShoppingLists();
  };

  const handleRemoveCartItem = (productCode: string, productName: string) => {
    const removeFromBoth = () => {
      removeItem(productCode);
      removeFromMyList(productCode);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${productName} from your cart?`)) removeFromBoth();
      return;
    }
    Alert.alert('Remove Item', `Remove ${productName} from your cart?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removeFromBoth },
    ]);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Remove all items from your cart?')) clearCart();
      return;
    }
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  };

  const cartRetailerTotals = useMemo(() => {
    // Collect codes of alt items added via per-retailer swaps — exclude from totals
    const altCodes = new Set<string>();
    Object.values(retailerOverrides).forEach((overrides) => {
      Object.values(overrides).forEach((override) => altCodes.add(override.altCode));
    });

    const totals: Record<string, { name: string; total: number; items: number }> = {};
    let itemsWithPrice = 0;

    const nonAltItems = cartItems.filter((ci) => !altCodes.has(ci.product.code));

    nonAltItems.forEach((cartItem) => {
      const product = cartItem.product;
      const quantity = cartItem.quantity;

      if (product.prices && product.prices.length > 0) {
        product.prices.forEach((price) => {
          const grocerId = price.grocer_id;
          const grocerName = price.grocer_name;
          const override = retailerOverrides[grocerId]?.[product.code];
          const priceValue = override
            ? parseFloat(override.price) * quantity
            : parseFloat(price.price) * quantity;

          if (!totals[grocerId]) {
            totals[grocerId] = { name: grocerName, total: 0, items: 0 };
          }
          totals[grocerId].total += priceValue;
          totals[grocerId].items += 1;
        });
        itemsWithPrice++;
      }
    });

    // For overrides where the original item has no prices at the target retailer
    // (i.e. it was "Not Stocked"), add that retailer's entry manually
    Object.entries(retailerOverrides).forEach(([grocerId, overrides]) => {
      Object.entries(overrides).forEach(([originalCode, override]) => {
        const cartItem = nonAltItems.find((ci) => ci.product.code === originalCode);
        if (!cartItem) return;
        if (cartItem.product.prices?.some((p) => p.grocer_id === grocerId)) return; // already handled above

        const altItem = cartItems.find((ci) => ci.product.code === override.altCode);
        const grocerName =
          altItem?.product.prices?.find((p) => p.grocer_id === grocerId)?.grocer_name ?? grocerId;

        if (!totals[grocerId]) totals[grocerId] = { name: grocerName, total: 0, items: 0 };
        totals[grocerId].total += parseFloat(override.price) * cartItem.quantity;
        totals[grocerId].items += 1;
      });
    });

    // Like-for-like: items stocked at every retailer in the summary
    const allGrocerIds = Object.keys(totals);
    const likeForLike: Record<string, { total: number; count: number }> = {};

    if (allGrocerIds.length >= 2) {
      const lflItems = nonAltItems.filter((ci) =>
        allGrocerIds.every((gId) => {
          if (retailerOverrides[gId]?.[ci.product.code]) return true;
          return ci.product.prices?.some((p) => p.grocer_id === gId);
        }),
      );

      allGrocerIds.forEach((grocerId) => {
        const total = lflItems.reduce((sum, ci) => {
          const override = retailerOverrides[grocerId]?.[ci.product.code];
          if (override) return sum + parseFloat(override.price) * ci.quantity;
          const price = ci.product.prices?.find((p) => p.grocer_id === grocerId);
          return price ? sum + parseFloat(price.price) * ci.quantity : sum;
        }, 0);
        likeForLike[grocerId] = { total, count: lflItems.length };
      });
    }

    // Only count retailers that stock every item — partial coverage is misleading
    const fullCoverageRetailers = Object.values(totals).filter(
      (d) => d.items === nonAltItems.length,
    );
    const estimatedTotal = fullCoverageRetailers.length > 0
      ? Math.min(...fullCoverageRetailers.map((d) => d.total)).toFixed(2)
      : null; // null = no single store stocks everything

    return {
      byRetailer: totals,
      estimatedTotal,
      itemsWithPrice,
      totalItems: nonAltItems.length,
      likeForLike,
    };
  }, [cartItems, retailerOverrides]);

  const cheapestCartRetailer = useMemo(() => {
    const retailers = Object.entries(cartRetailerTotals.byRetailer);
    if (retailers.length === 0) return null;

    let cheapest = retailers[0];
    retailers.forEach(([id, data]) => {
      if (data.items === cartRetailerTotals.totalItems && data.total < cheapest[1].total) {
        cheapest = [id, data];
      }
    });

    return {
      id: cheapest[0],
      name: cheapest[1].name,
      total: cheapest[1].total.toFixed(2),
      items: cheapest[1].items,
    };
  }, [cartRetailerTotals]);

  const retailerProductLists = useMemo(() => {
    const altCodes = new Set(
      Object.values(retailerOverrides).flatMap((overrides) =>
        Object.values(overrides).map((o) => o.altCode),
      ),
    );
    const result: Record<string, Array<{ name: string; price: string | null; code: string }>> = {};
    Object.keys(cartRetailerTotals.byRetailer).forEach((grocerId) => {
      result[grocerId] = cartItems.filter((ci) => !altCodes.has(ci.product.code)).map((cartItem) => {
        const override = retailerOverrides[grocerId]?.[cartItem.product.code];
        if (override) {
          return { name: override.name, price: override.price, code: cartItem.product.code };
        }
        const priceEntry = cartItem.product.prices?.find((p) => p.grocer_id === grocerId);
        return {
          name: cartItem.product.product_name,
          price: priceEntry ? priceEntry.price : null,
          code: cartItem.product.code,
        };
      });
    });
    return result;
  }, [cartItems, cartRetailerTotals.byRetailer, retailerOverrides]);

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const lineTotal = item.product.cheapest_price
      ? (parseFloat(item.product.cheapest_price) * item.quantity).toFixed(2)
      : null;

    const handlePress = () => {
      if (!onProductPress) return;
      const combined: CombinedProduct = {
        barcode: item.product.code,
        name: item.product.product_name,
        brand: item.product.brands || null,
        description: '',
        categories: [],
        image_url: item.product.image_url,
        prices: item.product.prices || [],
        relevance_score: 0,
        retailer_count: item.product.prices?.length || 0,
        nutrition:
          item.product.nutriscore_grade !== 'unknown'
            ? {
                nutriscore_grade: item.product.nutriscore_grade,
                nutriscore_display: item.product.nutriscore_display,
                nova_group: item.product.nova_group,
                nova_display: item.product.nova_display,
                sugars_100g: null,
                salt_100g: null,
                fat_100g: null,
                saturated_fat_100g: null,
                traffic_light: item.product.traffic_light,
              }
            : null,
        has_off_match: item.product.nutriscore_grade !== 'unknown',
        cheapest_price: item.product.cheapest_price || null,
        cheapest_retailer: null,
        price_comparison: null,
        has_nutrition_data: item.product.nutriscore_grade !== 'unknown',
      };
      onProductPress(combined);
    };

    return (
      <GlassCard
        blur="subtle"
        padding="md"
        onPress={onProductPress ? handlePress : undefined}
        style={styles.cartItemCard}
      >
        <View style={styles.cartItemRow}>
          <View style={[styles.cartItemImage, { backgroundColor: colors.surface.glassOverlay }]}>
            {item.product.image_url ? (
              <Image source={{ uri: item.product.image_url }} style={styles.cartImage} />
            ) : (
              <Ionicons name="cube-outline" size={28} color={colors.neutral.gray} />
            )}
          </View>

          <View style={styles.cartItemInfo}>
            <Text style={[styles.cartItemName, { color: colors.neutral.charcoal }]} numberOfLines={2}>
              {item.product.product_name}
            </Text>
            {item.product.brands ? (
              <Text style={[styles.cartItemBrand, { color: colors.neutral.darkGray }]} numberOfLines={1}>
                {item.product.brands}
              </Text>
            ) : null}

              {item.product.cheapest_price ? (
              <View style={styles.cartPriceRow}>
                <PriceTag price={item.product.cheapest_price} size="sm" />
                {item.quantity > 1 && lineTotal ? (
                  <Text style={[styles.cartLineTotal, { color: colors.neutral.darkGray }]}>
                    {'\u00D7 ' + item.quantity + ' = \u00A3' + lineTotal}
                  </Text>
                ) : null}
              </View>
            ) : null}

              <View style={styles.cartScores}>
              <ScoreBadge type="nutri" value={item.product.nutriscore_grade} size="sm" />
              {item.product.nova_group ? (
                <ScoreBadge type="nova" value={item.product.nova_group} size="sm" />
              ) : null}
            </View>

              {item.product.prices && item.product.prices.length > 0 && (
              <View style={styles.retailerChips}>
                {item.product.prices.map((price) => (
                  <View
                    key={price.grocer_id}
                    style={[
                      styles.retailerChip,
                      {
                        backgroundColor: colors.primary.main + '15',
                        borderColor: colors.primary.main + '35',
                      },
                    ]}
                  >
                    <Text style={[styles.retailerChipText, { color: colors.primary.main }]}>
                      {price.grocer_name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.cartRightCol}>
              <View style={[styles.quantityStepper, { backgroundColor: colors.surface.glass, borderColor: colors.surface.glassBorder }]}>
              <AnimatedPressable
                onPress={() => updateQuantity(item.product.code, item.quantity - 1)}
                style={styles.quantityBtn}
              >
                <Ionicons name="remove" size={16} color={colors.neutral.charcoal} />
              </AnimatedPressable>
              <Text style={[styles.quantityText, { color: colors.neutral.charcoal }]}>
                {item.quantity}
              </Text>
              <AnimatedPressable
                onPress={() => updateQuantity(item.product.code, item.quantity + 1)}
                style={styles.quantityBtn}
              >
                <Ionicons name="add" size={16} color={colors.neutral.charcoal} />
              </AnimatedPressable>
            </View>

              <View style={styles.cartActions}>
              <AnimatedPressable
                style={[
                  styles.swapCircle,
                  {
                    borderColor: colors.primary.main,
                    backgroundColor: colors.surface.glass,
                  },
                ]}
                onPress={() => handleSwapPress(item)}
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.primary.main} />
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.trashBtn}
                onPress={() => handleRemoveCartItem(item.product.code, item.product.product_name)}
              >
                <Ionicons name="trash-outline" size={16} color={colors.neutral.gray} />
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </GlassCard>
    );
  };

  const renderPriceHero = () => {
    if (cartRetailerTotals.itemsWithPrice === 0) return null;

    const hasCheapest = !!cheapestCartRetailer;

    return (
      <GlassCard
        blur="medium"
        glow={hasCheapest}
        padding="none"
        style={styles.priceHeroCard}
      >
        <View style={styles.priceHeroInner}>
          <LinearGradient
            colors={[colors.primary.main, colors.accent.lime]}
            style={styles.priceHeroAccent}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          <View style={styles.priceHeroContent}>
              <View style={styles.priceHeroHeader}>
              <Ionicons name="pricetags" size={20} color={colors.accent.lime} />
              <Text style={[styles.priceHeroTitle, { color: colors.neutral.charcoal }]}>
                Price Summary
              </Text>
            </View>

              {cartRetailerTotals.estimatedTotal !== null && (
                <View style={[styles.estimatedRow, { backgroundColor: colors.surface.glassOverlay }]}>
                  <Text style={[styles.estimatedLabel, { color: colors.neutral.darkGray }]}>
                    Best Single Store
                  </Text>
                  <Text style={[styles.estimatedPrice, { color: colors.primary.main }]}>
                    {'\u00A3' + cartRetailerTotals.estimatedTotal}
                  </Text>
                </View>
              )}

              <Text style={[styles.breakdownTitle, { color: colors.neutral.darkGray }]}>
              By Retailer:
            </Text>

            {Object.entries(cartRetailerTotals.byRetailer).map(([grocerId, data]) => {
              const isExpanded = expandedRetailer === grocerId;
              const productList = retailerProductLists[grocerId] || [];
              const isBest = cheapestCartRetailer?.id === grocerId && data.items === cartRetailerTotals.totalItems;

              return (
                <View key={grocerId}>
                  <AnimatedPressable
                    onPress={() => setExpandedRetailer(isExpanded ? null : grocerId)}
                    style={[
                      styles.retailerRow,
                      { borderBottomColor: colors.surface.glassBorder },
                    ]}
                  >
                    <View style={styles.retailerInfo}>
                      <Text style={[styles.retailerName, { color: colors.neutral.charcoal }]}>
                        {data.name}
                      </Text>
                      <Text style={[styles.retailerItems, { color: colors.neutral.gray }]}>
                        {data.items}/{cartRetailerTotals.totalItems} items
                      </Text>
                    </View>
                    <View style={styles.retailerPriceContainer}>
                      <Text
                        style={[
                          styles.retailerTotal,
                          { color: isBest ? colors.primary.main : colors.neutral.charcoal },
                        ]}
                      >
                        {'\u00A3' + data.total.toFixed(2)}
                      </Text>
                      {isBest ? (
                        <View
                          style={[
                            styles.bestBadge,
                            {
                              backgroundColor: colors.primary.main,
                              ...glassShadows.glow,
                              shadowOpacity: 0.25,
                            },
                          ]}
                        >
                          <Text style={styles.bestBadgeText}>Best</Text>
                        </View>
                      ) : null}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.neutral.gray}
                        style={{ marginLeft: spacing.xs }}
                      />
                    </View>
                  </AnimatedPressable>

                  {cartRetailerTotals.likeForLike[grocerId] !== undefined && (
                    <View style={[styles.likeForLikeRow, { borderBottomColor: colors.surface.glassBorder }]}>
                      <Text style={[styles.likeForLikeLabel, { color: colors.neutral.gray }]}>
                        Like for Like
                      </Text>
                      <Text style={[styles.likeForLikePrice, { color: colors.neutral.darkGray }]}>
                        {'£' + cartRetailerTotals.likeForLike[grocerId].total.toFixed(2)}
                        <Text style={[styles.likeForLikeCount, { color: colors.neutral.gray }]}>
                          {' (' + cartRetailerTotals.likeForLike[grocerId].count + ' items)'}
                        </Text>
                      </Text>
                    </View>
                  )}

                  {isExpanded && (() => {
                    const stocked = productList.filter((p) => p.price);
                    const unstocked = productList.filter((p) => !p.price);
                    return (
                      <View style={[styles.retailerDropdown, { backgroundColor: colors.surface.glassOverlay }]}>
                        {stocked.map((product, idx) => (
                          <View
                            key={`s-${idx}`}
                            style={[
                              styles.retailerDropdownItem,
                              idx < stocked.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: colors.surface.glassBorder,
                              },
                            ]}
                          >
                            <View style={styles.retailerDropdownLeft}>
                              <Ionicons
                                name="checkmark-circle"
                                size={15}
                                color={colors.semantic.success}
                              />
                              <Text
                                style={[styles.retailerDropdownName, { color: colors.neutral.charcoal }]}
                                numberOfLines={1}
                              >
                                {product.name}
                              </Text>
                            </View>
                            <Text style={[styles.retailerDropdownPrice, { color: colors.primary.main }]}>
                              {'\u00A3' + parseFloat(product.price!).toFixed(2)}
                            </Text>
                          </View>
                        ))}

                        {unstocked.length > 0 && (
                          <>
                            <View
                              style={[
                                styles.notStockedHeader,
                                {
                                  borderTopColor: colors.surface.glassBorder,
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.04)'
                                    : 'rgba(0,0,0,0.03)',
                                },
                              ]}
                            >
                              <Ionicons
                                name="close-circle-outline"
                                size={14}
                                color={colors.neutral.gray}
                              />
                              <Text style={[styles.notStockedHeaderText, { color: colors.neutral.gray }]}>
                                {'Not Stocked \u00B7 ' + data.name}
                              </Text>
                            </View>
                            {unstocked.map((product, idx) => (
                              <View
                                key={`u-${idx}`}
                                style={[
                                  styles.retailerDropdownItem,
                                  idx < unstocked.length - 1 && {
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.surface.glassBorder,
                                  },
                                ]}
                              >
                                <View style={styles.retailerDropdownLeft}>
                                  <Text
                                    style={[styles.retailerDropdownName, { color: colors.neutral.gray }]}
                                    numberOfLines={1}
                                  >
                                    {product.name}
                                  </Text>
                                </View>
                                <AnimatedPressable
                                  onPress={() =>
                                    handleRetailerSwapPress(
                                      grocerId,
                                      data.name,
                                      product.code,
                                      product.name,
                                    )
                                  }
                                  style={[
                                    styles.retailerSwapBtn,
                                    {
                                      backgroundColor: colors.primary.main + '18',
                                      borderColor: colors.primary.main,
                                    },
                                  ]}
                                >
                                  <Ionicons name="swap-horizontal" size={14} color={colors.primary.main} />
                                </AnimatedPressable>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    );
                  })()}
                </View>
              );
            })}

              {Object.keys(cartRetailerTotals.byRetailer).length > 1 ? (
              <View style={[styles.savingsNote, { borderTopColor: colors.surface.glassBorder }]}>
                <Ionicons name="bulb-outline" size={16} color={colors.accent.orange} />
                <Text style={[styles.savingsNoteText, { color: colors.accent.orange }]}>
                  Compare prices above to save money!
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>
    );
  };

  const renderSwapModal = () => {
    if (!swapFromCart) return null;

    const originalNutri = (swapFromCart.nutriscore_grade || 'unknown').toLowerCase();
    const originalNova = swapFromCart.nova_group ?? null;

    const getHealthComparison = (alt: CombinedProduct) => {
      const altNutri = (alt.nutrition?.nutriscore_grade || 'unknown').toLowerCase();
      const altNova = alt.nutrition?.nova_group ?? null;

      const nutriScoreRank: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, unknown: 6 };
      const isHealthier =
        (nutriScoreRank[altNutri] || 6) < (nutriScoreRank[originalNutri] || 6) ||
        (altNova || 4) < (originalNova || 4);

      const originalPrice = parseFloat(swapFromCart.cheapest_price || '0');
      const altPrice = parseFloat(alt.cheapest_price || '0');
      const isCheaper = altPrice > 0 && originalPrice > 0 && altPrice < originalPrice;

      return { isHealthier, isCheaper };
    };

    return (
      <GlassModal
        visible={swapModalVisible}
        onClose={() => setSwapModalVisible(false)}
        title="Find Alternatives"
      >
        <GlassCard blur="subtle" padding="md" style={styles.swapOriginalCard}>
          <Text style={[styles.swapOriginalLabel, { color: colors.neutral.darkGray }]}>
            Swapping from:
          </Text>
          <View style={styles.swapOriginalRow}>
            {swapFromCart.image_url ? (
              <Image source={{ uri: swapFromCart.image_url }} style={styles.swapOriginalImage} />
            ) : (
              <View style={[styles.swapOriginalImagePlaceholder, { backgroundColor: colors.neutral.lightGray }]}>
                <Ionicons name="cube-outline" size={24} color={colors.neutral.gray} />
              </View>
            )}

            <View style={styles.swapOriginalInfo}>
              <Text
                style={[styles.swapOriginalName, { color: colors.neutral.charcoal }]}
                numberOfLines={2}
              >
                {swapFromCart.name}
              </Text>

              <View style={styles.swapOriginalMeta}>
                {swapFromCart.cheapest_price ? (
                  <PriceTag price={swapFromCart.cheapest_price} size="sm" />
                ) : null}
                <ScoreBadge type="nutri" value={originalNutri} size="sm" />
                {originalNova ? (
                  <ScoreBadge type="nova" value={originalNova} size="sm" />
                ) : null}
                {swapFromCart.quantity > 1 ? (
                  <View style={[styles.qtyBadge, { backgroundColor: colors.neutral.charcoal }]}>
                    <Text style={styles.qtyBadgeText}>{'\u00D7' + swapFromCart.quantity}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </GlassCard>

        {loadingAlternatives ? (
          <View style={styles.loadingAlternatives}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
              Finding better options...
            </Text>
          </View>
        ) : alternatives.length === 0 ? (
          <View style={styles.noAlternatives}>
            <Ionicons name="search-outline" size={48} color={colors.neutral.gray} />
            <Text style={[styles.noAlternativesText, { color: colors.neutral.charcoal }]}>
              No alternatives found
            </Text>
            <Text style={[styles.noAlternativesSubtext, { color: colors.neutral.gray }]}>
              Try a different product
            </Text>
          </View>
        ) : (
          <FlatList
            data={alternatives}
            keyExtractor={(altItem, index) => altItem.barcode || `alt_${index}`}
            contentContainerStyle={styles.alternativesList}
            renderItem={({ item: alt }) => {
              const { isHealthier, isCheaper } = getHealthComparison(alt);
              const altNutri = (alt.nutrition?.nutriscore_grade || 'unknown').toLowerCase();
              const altNova = alt.nutrition?.nova_group;

              return (
                <GlassCard blur="subtle" padding="sm" style={styles.alternativeCard}>
                  <View style={styles.alternativeRow}>
                    <View style={[styles.alternativeImageContainer, { backgroundColor: colors.neutral.lightGray }]}>
                      {alt.image_url ? (
                        <Image source={{ uri: alt.image_url }} style={styles.alternativeImage} />
                      ) : (
                        <View style={styles.alternativeImagePlaceholder}>
                          <Ionicons name="cube-outline" size={24} color={colors.neutral.gray} />
                        </View>
                      )}
                    </View>

                    <View style={styles.alternativeInfo}>
                      <Text
                        style={[styles.alternativeName, { color: colors.neutral.charcoal }]}
                        numberOfLines={2}
                      >
                        {alt.name}
                      </Text>

                      <View style={styles.alternativeTags}>
                        {isHealthier ? (
                          <View style={[styles.healthierTag, { backgroundColor: colors.semantic.success + '18' }]}>
                            <Ionicons name="leaf" size={12} color={colors.semantic.success} />
                            <Text style={[styles.tagText, { color: colors.semantic.success }]}>
                              Healthier
                            </Text>
                          </View>
                        ) : null}
                        {isCheaper ? (
                          <View style={[styles.cheaperTag, { backgroundColor: colors.accent.lime + '18' }]}>
                            <Ionicons name="trending-down" size={12} color={colors.accent.lime} />
                            <Text style={[styles.tagText, { color: colors.accent.lime }]}>
                              Cheaper
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.alternativeMeta}>
                        {alt.cheapest_price ? (
                          <PriceTag price={alt.cheapest_price} size="sm" />
                        ) : null}
                        <ScoreBadge type="nutri" value={altNutri} size="sm" />
                        {altNova ? (
                          <ScoreBadge type="nova" value={altNova} size="sm" />
                        ) : null}
                      </View>
                    </View>

                    <AnimatedPressable
                      style={[styles.alternativeSwapBtn, { backgroundColor: colors.primary.main }]}
                      onPress={() => performSwap(alt)}
                    >
                      <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                    </AnimatedPressable>
                  </View>
                </GlassCard>
              );
            }}
          />
        )}
      </GlassModal>
    );
  };

  const renderRetailerSwapModal = () => {
    if (!retailerSwapContext) return null;
    return (
      <GlassModal
        visible={retailerSwapModalVisible}
        onClose={() => setRetailerSwapModalVisible(false)}
        title={`Swap at ${retailerSwapContext.grocerName}`}
      >
        <GlassCard blur="subtle" padding="md" style={styles.swapOriginalCard}>
          <Text style={[styles.swapOriginalLabel, { color: colors.neutral.darkGray }]}>
            Finding alternative for:
          </Text>
          <Text
            style={[styles.swapOriginalName, { color: colors.neutral.charcoal }]}
            numberOfLines={2}
          >
            {retailerSwapContext.cartItemName}
          </Text>
        </GlassCard>

        {loadingRetailerAlternatives ? (
          <View style={styles.loadingAlternatives}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
              {'Finding options at ' + retailerSwapContext.grocerName + '...'}
            </Text>
          </View>
        ) : retailerAlternatives.length === 0 ? (
          <View style={styles.noAlternatives}>
            <Ionicons name="search-outline" size={48} color={colors.neutral.gray} />
            <Text style={[styles.noAlternativesText, { color: colors.neutral.charcoal }]}>
              {'No alternatives found at ' + retailerSwapContext.grocerName}
            </Text>
          </View>
        ) : (
          <FlatList
            data={retailerAlternatives}
            keyExtractor={(altItem, index) => altItem.barcode || `alt_${index}`}
            contentContainerStyle={styles.alternativesList}
            renderItem={({ item: alt }) => {
              const priceAtRetailer = alt.prices?.find(
                (p) => p.grocer_id === retailerSwapContext.grocerId,
              );
              const altNutri = (alt.nutrition?.nutriscore_grade || 'unknown').toLowerCase();
              const altNova = alt.nutrition?.nova_group;
              return (
                <GlassCard blur="subtle" padding="sm" style={styles.alternativeCard}>
                  <View style={styles.alternativeRow}>
                    <View
                      style={[
                        styles.alternativeImageContainer,
                        { backgroundColor: colors.neutral.lightGray },
                      ]}
                    >
                      {alt.image_url ? (
                        <Image source={{ uri: alt.image_url }} style={styles.alternativeImage} />
                      ) : (
                        <View style={styles.alternativeImagePlaceholder}>
                          <Ionicons name="cube-outline" size={24} color={colors.neutral.gray} />
                        </View>
                      )}
                    </View>

                    <View style={styles.alternativeInfo}>
                      <Text
                        style={[styles.alternativeName, { color: colors.neutral.charcoal }]}
                        numberOfLines={2}
                      >
                        {alt.name}
                      </Text>
                      <View style={styles.alternativeMeta}>
                        {priceAtRetailer ? (
                          <PriceTag price={priceAtRetailer.price} size="sm" />
                        ) : null}
                        <ScoreBadge type="nutri" value={altNutri} size="sm" />
                        {altNova ? <ScoreBadge type="nova" value={altNova} size="sm" /> : null}
                      </View>
                    </View>

                    <AnimatedPressable
                      style={[styles.alternativeSwapBtn, { backgroundColor: colors.primary.main }]}
                      onPress={() => performRetailerSwap(alt)}
                    >
                      <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                    </AnimatedPressable>
                  </View>
                </GlassCard>
              );
            }}
          />
        )}
      </GlassModal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>Cart</Text>
          {cartItems.length > 0 && (
            <View style={[styles.itemCountBadge, { backgroundColor: colors.primary.main + '20' }]}>
              <Text style={[styles.itemCountText, { color: colors.primary.main }]}>
                {getTotalItems()}
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item, index) => item.product.code || `item_${index}`}
        renderItem={renderCartItem}
        ListHeaderComponent={
          cartItems.length > 0 ? (
            <>
                  {renderPriceHero()}

                  {cartRetailerTotals.itemsWithPrice === 0 ? (
                <GlassCard blur="subtle" padding="md" style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Ionicons name="information-circle" size={20} color={colors.primary.main} />
                    <Text style={[styles.infoText, { color: colors.primary.main }]}>
                      Search for products in FoodX to see price comparisons across retailers!
                    </Text>
                  </View>
                </GlassCard>
              ) : null}

                  <AnimatedPressable style={styles.clearCartBtn} onPress={handleClearCart}>
                <Ionicons name="trash-outline" size={16} color={colors.neutral.gray} />
                <Text style={[styles.clearCartText, { color: colors.neutral.gray }]}>
                  Clear Cart
                </Text>
              </AnimatedPressable>

              <Text style={[styles.itemsHeader, { color: colors.neutral.charcoal }]}>
                Cart Items
              </Text>
            </>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <PlaceholderCard
              title="Your cart is empty"
              description="Search for products in the FoodX tab and add them to your cart"
              icon="cart-outline"
              color={colors.primary.main}
            />
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.main}
          />
        }
      />

      {renderSwapModal()}
      {renderRetailerSwapModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...textFont.bold,
    fontSize: typography.fontSize['2xl'],
    letterSpacing: typography.letterSpacing.tight,
  },
  itemCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  itemCountText: {
    ...textFont.bold,
    fontSize: typography.fontSize.sm,
  },

  listContent: {
    padding: spacing.md,
    paddingBottom: 120,
  },

  priceHeroCard: {
    marginBottom: spacing.md,
  },
  priceHeroInner: {
    flexDirection: 'row',
  },
  priceHeroAccent: {
    width: 4,
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
  },
  priceHeroContent: {
    flex: 1,
    padding: spacing.md,
  },
  priceHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  priceHeroTitle: {
    ...textFont.bold,
    fontSize: typography.fontSize.lg,
  },
  estimatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  estimatedLabel: {
    ...textFont.regular,
    fontSize: typography.fontSize.base,
  },
  estimatedPrice: {
    ...textFont.bold,
    fontSize: typography.fontSize['2xl'],
  },
  breakdownTitle: {
    ...textFont.medium,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  retailerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  retailerInfo: {
    flex: 1,
  },
  retailerName: {
    ...textFont.medium,
    fontSize: typography.fontSize.base,
  },
  retailerItems: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  retailerPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retailerTotal: {
    ...textFont.bold,
    fontSize: typography.fontSize.md,
  },
  bestBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  bestBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },
  likeForLikeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  likeForLikeLabel: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  likeForLikePrice: {
    ...textFont.medium,
    fontSize: typography.fontSize.xs,
  },
  likeForLikeCount: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
  },
  savingsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
  savingsNoteText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },

  retailerDropdown: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  retailerDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  retailerDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  retailerDropdownName: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.xs,
    flex: 1,
  },
  retailerDropdownPrice: {
    ...textFont.medium,
    fontSize: typography.fontSize.sm,
  },
  retailerSwapBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notStockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
  },
  notStockedHeaderText: {
    ...textFont.medium,
    fontSize: typography.fontSize.xs,
  },

  cartItemCard: {
    marginBottom: spacing.sm,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  cartImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  cartItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cartItemName: {
    ...textFont.medium,
    fontSize: typography.fontSize.base,
    marginBottom: 2,
  },
  cartItemBrand: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  cartPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  cartLineTotal: {
    fontSize: typography.fontSize.sm,
  },
  cartScores: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  retailerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: 4,
  },
  retailerChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
  },
  retailerChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },

  cartRightCol: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: glass.borderWidth,
    overflow: 'hidden',
  },
  quantityBtn: {
    padding: spacing.sm,
  },
  quantityText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    minWidth: 24,
    textAlign: 'center',
  },
  cartActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swapCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashBtn: {
    padding: spacing.xs,
  },

  infoCard: {
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },

  clearCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  clearCartText: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
  },

  itemsHeader: {
    ...textFont.bold,
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.sm,
  },

  emptyContainer: {
    padding: spacing.xl,
  },

  swapOriginalCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  swapOriginalLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  swapOriginalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swapOriginalImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  swapOriginalImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapOriginalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  swapOriginalName: {
    ...textFont.semibold,
    fontSize: typography.fontSize.base,
  },
  swapOriginalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  qtyBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  qtyBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
  },

  loadingAlternatives: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  noAlternatives: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  noAlternativesText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  noAlternativesSubtext: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
  },

  alternativesList: {
    padding: spacing.md,
  },
  alternativeCard: {
    marginBottom: spacing.sm,
  },
  alternativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alternativeImageContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  alternativeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  alternativeImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alternativeInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
  alternativeName: {
    ...textFont.semibold,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  alternativeTags: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  healthierTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  cheaperTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  tagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  alternativeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  alternativeSwapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: spacing.sm,
  },
});

export default PantryScreen;
