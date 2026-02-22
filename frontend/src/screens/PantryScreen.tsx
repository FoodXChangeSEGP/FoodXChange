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
import { useShoppingStore, useCartStore, CartItem } from '@/store';

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
    Alert.alert('Remove Item', `Remove ${productName} from your cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeItem(productCode),
      },
    ]);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: clearCart,
      },
    ]);
  };

  const cartRetailerTotals = useMemo(() => {
    const totals: Record<string, { name: string; total: number; items: number }> = {};
    let estimatedTotal = 0;
    let itemsWithPrice = 0;

    cartItems.forEach((cartItem) => {
      const product = cartItem.product;
      const quantity = cartItem.quantity;

      if (product.prices && product.prices.length > 0) {
        product.prices.forEach((price) => {
          const grocerId = price.grocer_id;
          const grocerName = price.grocer_name;
          const priceValue = parseFloat(price.price) * quantity;

          if (!totals[grocerId]) {
            totals[grocerId] = { name: grocerName, total: 0, items: 0 };
          }
          totals[grocerId].total += priceValue;
          totals[grocerId].items += 1;
        });
        itemsWithPrice++;
      }

      if (product.cheapest_price) {
        estimatedTotal += parseFloat(product.cheapest_price) * quantity;
      }
    });

    return {
      byRetailer: totals,
      estimatedTotal: estimatedTotal.toFixed(2),
      itemsWithPrice,
      totalItems: cartItems.length,
    };
  }, [cartItems]);

  const cheapestCartRetailer = useMemo(() => {
    const retailers = Object.entries(cartRetailerTotals.byRetailer);
    if (retailers.length === 0) return null;

    let cheapest = retailers[0];
    retailers.forEach(([id, data]) => {
      if (data.items === cartItems.length && data.total < cheapest[1].total) {
        cheapest = [id, data];
      }
    });

    return {
      id: cheapest[0],
      name: cheapest[1].name,
      total: cheapest[1].total.toFixed(2),
      items: cheapest[1].items,
    };
  }, [cartRetailerTotals, cartItems.length]);

  const retailerProductLists = useMemo(() => {
    const result: Record<string, Array<{ name: string; price: string | null }>> = {};
    Object.keys(cartRetailerTotals.byRetailer).forEach((grocerId) => {
      result[grocerId] = cartItems.map((cartItem) => {
        const priceEntry = cartItem.product.prices?.find((p) => p.grocer_id === grocerId);
        return {
          name: cartItem.product.product_name,
          price: priceEntry ? priceEntry.price : null,
        };
      });
    });
    return result;
  }, [cartItems, cartRetailerTotals.byRetailer]);

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

              <View style={[styles.estimatedRow, { backgroundColor: colors.surface.glassOverlay }]}>
              <Text style={[styles.estimatedLabel, { color: colors.neutral.darkGray }]}>
                Estimated Total
              </Text>
              <Text style={[styles.estimatedPrice, { color: colors.primary.main }]}>
                {'\u00A3' + cartRetailerTotals.estimatedTotal}
              </Text>
            </View>

              <Text style={[styles.breakdownTitle, { color: colors.neutral.darkGray }]}>
              By Retailer:
            </Text>

            {Object.entries(cartRetailerTotals.byRetailer).map(([grocerId, data]) => {
              const isExpanded = expandedRetailer === grocerId;
              const productList = retailerProductLists[grocerId] || [];
              const isBest = cheapestCartRetailer?.id === grocerId && data.items === cartItems.length;

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
                        {data.items}/{cartItems.length} items
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

                  {isExpanded && (
                    <View style={[styles.retailerDropdown, { backgroundColor: colors.surface.glassOverlay }]}>
                      {productList.map((product, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.retailerDropdownItem,
                            idx < productList.length - 1 && {
                              borderBottomWidth: 1,
                              borderBottomColor: colors.surface.glassBorder,
                            },
                          ]}
                        >
                          <View style={styles.retailerDropdownLeft}>
                            <Ionicons
                              name={product.price ? 'checkmark-circle' : 'close-circle-outline'}
                              size={15}
                              color={product.price ? colors.semantic.success : colors.neutral.gray}
                            />
                            <Text
                              style={[
                                styles.retailerDropdownName,
                                { color: product.price ? colors.neutral.charcoal : colors.neutral.gray },
                              ]}
                              numberOfLines={1}
                            >
                              {product.name}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.retailerDropdownPrice,
                              { color: product.price ? colors.primary.main : colors.neutral.gray },
                            ]}
                          >
                            {product.price
                              ? '\u00A3' + parseFloat(product.price).toFixed(2)
                              : 'Not listed'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
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
            keyExtractor={(altItem) => altItem.barcode}
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
        keyExtractor={(item) => item.product.code}
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
