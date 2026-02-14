/**
 * Shopping List Screen (Pantry Tab)
 * Manages shopping lists with product titles, prices, and retailer comparison
 * Now integrated with local cart store for grocer products
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import { ShoppingListItem, PlaceholderCard } from '@/components';
import {
  api,
  ShoppingList,
  ShoppingListItem as ShoppingListItemType,
  RetailerComparison,
  OFFProduct,
} from '@/services/api';
import { useShoppingStore, useCartStore, CartItem } from '@/store';

export const PantryScreen: React.FC = () => {
  const { lists, setLists, activeListId, setActiveList } = useShoppingStore();
  const cartItems = useCartStore((s) => s.items);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeList, setActiveListData] = useState<ShoppingList | null>(null);
  const [comparison, setComparison] = useState<RetailerComparison[]>([]);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [viewMode, setViewMode] = useState<'cart' | 'lists'>('cart');

  // Swap modal state (cart item swaps)
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSourceItem, setSwapSourceItem] = useState<CartItem | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<OFFProduct[]>([]);
  const [loadingSwap, setLoadingSwap] = useState(false);

  const fetchShoppingLists = useCallback(async () => {
    try {
      const fetchedLists = await api.shoppingLists.getAll();
      setLists(fetchedLists);

      if (fetchedLists.length > 0 && !activeListId) {
        setActiveList(fetchedLists[0].id);
      }
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      // Don't show error for unauthenticated users
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [setLists, activeListId, setActiveList]);

  const fetchActiveListDetails = useCallback(async () => {
    if (!activeListId) return;

    try {
      const list = await api.shoppingLists.getById(activeListId);
      setActiveListData(list);

      const priceComparison = await api.shoppingLists.comparePrices(activeListId);
      setComparison(priceComparison);
    } catch (error) {
      console.error('Error fetching list details:', error);
    }
  }, [activeListId]);

  useEffect(() => {
    fetchShoppingLists();
  }, [fetchShoppingLists]);

  useEffect(() => {
    if (activeListId && viewMode === 'lists') {
      fetchActiveListDetails();
    }
  }, [activeListId, fetchActiveListDetails, viewMode]);

  const onRefresh = () => {
    setRefreshing(true);
    if (viewMode === 'lists') {
      fetchShoppingLists();
      fetchActiveListDetails();
    } else {
      setRefreshing(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      const newList = await api.shoppingLists.create({
        name: newListName.trim(),
      });
      setLists([...lists, newList]);
      setActiveList(newList.id);
      setShowNewListModal(false);
      setNewListName('');
    } catch (error) {
      console.error('Error creating list:', error);
      Alert.alert('Error', 'Could not create shopping list');
    }
  };

  const handleToggleItem = async (item: ShoppingListItemType) => {
    // TODO: Implement toggle item checked state
    console.log('Toggle item:', item.id);
  };

  const handleRemoveItem = async (item: ShoppingListItemType) => {
    if (!activeListId) return;

    Alert.alert('Remove Item', `Remove ${item.product.name} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.shoppingLists.removeItem(activeListId, item.id);
            fetchActiveListDetails();
          } catch (error) {
            console.error('Error removing item:', error);
          }
        },
      },
    ]);
  };

  const handleRemoveCartItem = (productCode: string, productName: string) => {
    Alert.alert('Remove Item', `Remove ${productName} from your cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeItem(String(productCode)),
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

  const openSwapForCartItem = useCallback(
    async (cartItem: CartItem) => {
      setSwapSourceItem(cartItem);
      setSwapModalVisible(true);
      setLoadingSwap(true);
      setSwapAlternatives([]);

      const code = cartItem.product.code;
      const q = cartItem.product.product_name;

      try {
        // Preferred: barcode-based swap
        const res = await api.off.getHealthySwap({ code, limit: 10 });
        setSwapAlternatives(res.alternatives || []);
      } catch (err) {
        // Fallback: name-based swap
        try {
          const res2 = await api.off.getHealthySwap({ q, limit: 10 });
          setSwapAlternatives(res2.alternatives || []);
        } catch (err2) {
          console.error('Swap failed:', err2);
          Alert.alert('Swap Error', 'Unable to find alternatives right now.');
          setSwapModalVisible(false);
          setSwapSourceItem(null);
        }
      } finally {
        setLoadingSwap(false);
      }
    },
    [setSwapSourceItem, setSwapModalVisible]
  );

  const getCheapestRetailer = () => {
    if (comparison.length === 0) return null;
    return comparison.find((c) => c.is_cheapest);
  };

  const getTotalCost = () => {
    if (!activeList?.items) return '0.00';
    return activeList.items
      .reduce((sum, item) => {
        const price = item.product.lowest_price ? parseFloat(item.product.lowest_price) : 0;
        return sum + price * item.quantity;
      }, 0)
      .toFixed(2);
  };

  // Render cart item
  const renderCartItem = ({ item }: { item: CartItem }) => {
    const novaColor = item.product.nova_group
      ? colors.nova[item.product.nova_group as keyof typeof colors.nova]
      : colors.neutral.gray;

    const nutriColor =
      colors.nutriScore[item.product.nutriscore_grade?.toUpperCase() as keyof typeof colors.nutriScore] ||
      colors.neutral.gray;

    const lineTotal = item.product.cheapest_price
      ? (parseFloat(item.product.cheapest_price) * item.quantity).toFixed(2)
      : null;

    return (
      <View style={styles.cartItem}>
        {/* Product Image */}
        <View style={styles.cartItemImage}>
          {item.product.image_url ? (
            <Image source={{ uri: item.product.image_url }} style={styles.cartImage} />
          ) : (
            <Ionicons name="cube-outline" size={28} color={colors.neutral.gray} />
          )}
        </View>

        {/* Product Info */}
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName} numberOfLines={2}>
            {item.product.product_name}
          </Text>

          {item.product.brands ? (
            <Text style={styles.cartItemBrand} numberOfLines={1}>
              {item.product.brands}
            </Text>
          ) : null}

          {/* Price Info */}
          {item.product.cheapest_price ? (
            <View style={styles.cartPriceRow}>
              <Text style={styles.cartItemPrice}>{'£' + item.product.cheapest_price}</Text>
              {item.quantity > 1 && lineTotal ? (
                <Text style={styles.cartLineTotal}>{'× ' + item.quantity + ' = £' + lineTotal}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Scores */}
          <View style={styles.cartScores}>
            <View style={[styles.scoreBadgeSm, { backgroundColor: nutriColor }]}>
              <Text style={styles.scoreBadgeTextSm}>{item.product.nutriscore_grade?.toUpperCase() || '?'}</Text>
            </View>
            {item.product.nova_group && (
              <View style={[styles.scoreBadgeSm, { backgroundColor: novaColor }]}>
                <Text style={styles.scoreBadgeTextSm}>N{item.product.nova_group}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quantity Controls */}
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(String(item.product.code), item.quantity - 1)}
          >
            <Ionicons name="remove" size={18} color={colors.neutral.charcoal} />
          </TouchableOpacity>

          <Text style={styles.quantityText}>{item.quantity}</Text>

          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(String(item.product.code), item.quantity + 1)}
          >
            <Ionicons name="add" size={18} color={colors.neutral.charcoal} />
          </TouchableOpacity>
        </View>

        {/* Swap Button */}
        <TouchableOpacity style={styles.swapButton} onPress={() => openSwapForCartItem(item)}>
          <Ionicons name="swap-horizontal" size={18} color={colors.primary.dark} />
        </TouchableOpacity>

        {/* Remove Button */}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveCartItem(String(item.product.code), item.product.product_name)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.neutral.gray} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderViewModeToggle = () => (
    <View style={styles.viewModeContainer}>
      <TouchableOpacity
        style={[styles.viewModeTab, viewMode === 'cart' && styles.viewModeTabActive]}
        onPress={() => setViewMode('cart')}
      >
        <Ionicons
          name="cart"
          size={18}
          color={viewMode === 'cart' ? colors.neutral.white : colors.neutral.darkGray}
        />
        <Text style={[styles.viewModeText, viewMode === 'cart' && styles.viewModeTextActive]}>
          Cart ({getTotalItems()})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.viewModeTab, viewMode === 'lists' && styles.viewModeTabActive]}
        onPress={() => setViewMode('lists')}
      >
        <Ionicons
          name="list"
          size={18}
          color={viewMode === 'lists' ? colors.neutral.white : colors.neutral.darkGray}
        />
        <Text style={[styles.viewModeText, viewMode === 'lists' && styles.viewModeTextActive]}>
          Saved Lists
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderListSelector = () => (
    <View style={styles.listSelector}>
      <FlatList
        data={lists}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.listTab, activeListId === item.id && styles.listTabActive]}
            onPress={() => setActiveList(item.id)}
          >
            <Text style={[styles.listTabText, activeListId === item.id && styles.listTabTextActive]}>
              {item.name}
            </Text>
            <Text style={styles.listTabCount}>{item.total_items}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addListButton} onPress={() => setShowNewListModal(true)}>
            <Ionicons name="add" size={20} color={colors.primary.dark} />
          </TouchableOpacity>
        }
      />
    </View>
  );

  const renderPriceComparison = () => {
    const cheapest = getCheapestRetailer();
    if (!cheapest) return null;

    return (
      <View style={styles.comparisonCard}>
        <View style={styles.comparisonHeader}>
          <Ionicons name="pricetags" size={20} color={colors.accent.lime} />
          <Text style={styles.comparisonTitle}>Best Price</Text>
        </View>
        <Text style={styles.comparisonRetailer}>{cheapest.retailer.name}</Text>
        <Text style={styles.comparisonPrice}>£{cheapest.total_cost}</Text>
        <Text style={styles.comparisonMeta}>
          {cheapest.available_items}/{cheapest.total_items} items available
        </Text>
      </View>
    );
  };

  // Calculate cart totals by retailer
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

  const renderSwapModal = () => {
    if (!swapSourceItem) return null;
  
    const original = swapSourceItem.product;
  
    return (
      <Modal
        visible={swapModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSwapModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Swap Item</Text>
              <Text style={styles.modalSubtitle}>Choose a healthier alternative</Text>
            </View>
            <TouchableOpacity onPress={() => setSwapModalVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
            </TouchableOpacity>
          </View>
  
          <View style={styles.originalSwapCard}>
            <Text style={styles.originalLabel}>Swapping from:</Text>
            <Text style={styles.originalName} numberOfLines={2}>
              {original.product_name}
            </Text>
            {original.brands ? (
              <Text style={styles.originalBrand} numberOfLines={1}>
                {original.brands}
              </Text>
            ) : null}
          </View>
  
          {loadingSwap ? (
            <View style={styles.loadingAlternatives}>
              <ActivityIndicator size="large" color={colors.primary.dark} />
              <Text style={styles.loadingText}>Finding alternatives...</Text>
            </View>
          ) : swapAlternatives.length === 0 ? (
            <View style={styles.noAlternatives}>
              <Ionicons name="search-outline" size={48} color={colors.neutral.gray} />
              <Text style={styles.noAlternativesText}>No alternatives found</Text>
              <Text style={styles.noAlternativesSubtext}>Try again later</Text>
            </View>
          ) : (
            <FlatList
              data={swapAlternatives}
              keyExtractor={(p) => String(p.code)}
              contentContainerStyle={styles.alternativesList}
              renderItem={({ item: alt }) => (
                <TouchableOpacity
                  style={styles.alternativeCard}
                  onPress={async () => {
                    try {
                      // 1) Find UK-priced match via grocer search (no barcode endpoint needed)
                      const res = await api.grocers.search(alt.product_name, {
                        page_size: 5,
                        include_nutrition: true,
                      });
  
                      const priced = res?.products?.[0];
                      if (!priced) {
                        Alert.alert(
                          'No UK price match',
                          'We found a healthier alternative, but couldn’t match it to Tesco/Sainsbury’s pricing.'
                        );
                        return;
                      }
  
                      // 2) Convert CombinedProduct -> cart product shape
                      const cartProduct = {
                        code: String(priced.barcode),
                        product_name: priced.name,
                        brands: priced.brand || '',
                        image_url: priced.image_url,
  
                        // Nutrition (prefer grocer-enriched, fallback to OFF)
                        nutriscore_grade:
                          priced.nutrition?.nutriscore_grade || alt.nutriscore_grade || 'unknown',
                        nova_group:
                          priced.nutrition?.nova_group ?? alt.nova_group ?? null,
                        traffic_light:
                          priced.nutrition?.traffic_light || {
                            sugars: { value: null, level: 'unknown' as const },
                            salt: { value: null, level: 'unknown' as const },
                            fat: { value: null, level: 'unknown' as const },
                            saturated_fat: { value: null, level: 'unknown' as const },
                          },
  
                        // ✅ Price data used by cart UI + totals
                        cheapest_price: priced.cheapest_price ?? null,
                        prices: priced.prices ?? [],
                      };
  
                      // 3) Add new priced item (same quantity), then remove original
                      addItem(cartProduct as any, swapSourceItem.quantity);
                      removeItem(String(original.code));
  
                      setSwapModalVisible(false);
                      setSwapSourceItem(null);
  
                      Alert.alert('Swapped!', `${alt.product_name} added with UK prices.`);
                    } catch (e) {
                      Alert.alert('Swap Error', 'Unable to find UK pricing for this alternative.');
                    }
                  }}
                >
                  <View style={styles.alternativeLeft}>
                    {alt.image_url ? (
                      <Image source={{ uri: alt.image_url }} style={styles.altImage} />
                    ) : (
                      <View style={styles.altImagePlaceholder}>
                        <Ionicons name="leaf-outline" size={22} color={colors.neutral.gray} />
                      </View>
                    )}
                  </View>
  
                  <View style={styles.alternativeInfo}>
                    <Text style={styles.alternativeName} numberOfLines={2}>
                      {alt.product_name}
                    </Text>
                    {alt.brands ? (
                      <Text style={styles.alternativeBrand} numberOfLines={1}>
                        {alt.brands}
                      </Text>
                    ) : null}
  
                    <View style={styles.altBadges}>
                      <View style={styles.altBadge}>
                        <Text style={styles.altBadgeText}>
                          {(alt.nutriscore_grade || 'unknown').toUpperCase()}
                        </Text>
                      </View>
                      {alt.nova_group ? (
                        <View style={styles.altBadge}>
                          <Text style={styles.altBadgeText}>{'N' + alt.nova_group}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
  
                  <Ionicons name="chevron-forward" size={18} color={colors.neutral.gray} />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    );
  };
  
  const renderCartView = () => (
    <FlatList
      data={cartItems}
      keyExtractor={(item) => String(item.product.code)}
      renderItem={renderCartItem}
      ListHeaderComponent={
        cartItems.length > 0 ? (
          <>
            {cartRetailerTotals.itemsWithPrice > 0 ? (
              <View style={styles.priceSummaryCard}>
                <View style={styles.priceSummaryHeader}>
                  <Ionicons name="pricetags" size={22} color={colors.accent.lime} />
                  <Text style={styles.priceSummaryTitle}>Price Summary</Text>
                </View>

                <View style={styles.estimatedTotalRow}>
                  <Text style={styles.estimatedLabel}>Estimated Total (cheapest)</Text>
                  <Text style={styles.estimatedPrice}>£{cartRetailerTotals.estimatedTotal}</Text>
                </View>

                <Text style={styles.retailerBreakdownTitle}>By Retailer:</Text>
                {Object.entries(cartRetailerTotals.byRetailer).map(([grocerId, data]) => (
                  <View key={grocerId} style={styles.retailerRow}>
                    <View style={styles.retailerInfo}>
                      <Text style={styles.retailerName}>{data.name}</Text>
                      <Text style={styles.retailerItems}>
                        {data.items}/{cartItems.length} items
                      </Text>
                    </View>
                    <View style={styles.retailerPriceContainer}>
                      <Text
                        style={[
                          styles.retailerTotal,
                          cheapestCartRetailer?.id === grocerId && styles.cheapestRetailerTotal,
                        ]}
                      >
                        £{data.total.toFixed(2)}
                      </Text>
                      {cheapestCartRetailer?.id === grocerId && data.items === cartItems.length ? (
                        <View style={styles.cheapestBadge}>
                          <Text style={styles.cheapestBadgeText}>Best</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}

                {Object.keys(cartRetailerTotals.byRetailer).length > 1 ? (
                  <View style={styles.savingsNote}>
                    <Ionicons name="bulb-outline" size={16} color={colors.accent.orange} />
                    <Text style={styles.savingsNoteText}>Compare prices above to save money!</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items in cart</Text>
                <Text style={styles.summaryValue}>{getTotalItems()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Unique products</Text>
                <Text style={styles.summaryValue}>{cartItems.length}</Text>
              </View>
              {cartRetailerTotals.itemsWithPrice > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items with prices</Text>
                  <Text style={styles.summaryValue}>{cartRetailerTotals.itemsWithPrice}</Text>
                </View>
              ) : null}
            </View>

            {cartRetailerTotals.itemsWithPrice === 0 ? (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color={colors.primary.dark} />
                <Text style={styles.infoText}>
                  Search for products in FoodX to see price comparisons across retailers!
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.clearCartButton} onPress={handleClearCart}>
              <Ionicons name="trash-outline" size={18} color={colors.neutral.gray} />
              <Text style={styles.clearCartText}>Clear Cart</Text>
            </TouchableOpacity>

            <Text style={styles.itemsHeader}>Cart Items</Text>
          </>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyListContainer}>
          <Ionicons name="cart-outline" size={64} color={colors.neutral.gray} />
          <Text style={styles.emptyListTitle}>Your cart is empty</Text>
          <Text style={styles.emptyListText}>Search for products in the FoodX tab and add them to your cart</Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.dark} />}
    />
  );

  const renderSavedListsView = () => {
    if (lists.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <PlaceholderCard
            title="No Shopping Lists"
            description="Create your first shopping list to start comparing prices"
            icon="list-outline"
            color={colors.primary.dark}
          />
          <TouchableOpacity style={styles.createButton} onPress={() => setShowNewListModal(true)}>
            <Ionicons name="add" size={20} color={colors.neutral.white} />
            <Text style={styles.createButtonText}>Create List</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={activeList?.items || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ShoppingListItem item={item} onToggleCheck={handleToggleItem} onRemove={handleRemoveItem} />
        )}
        ListHeaderComponent={
          <>
            {renderPriceComparison()}

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items</Text>
                <Text style={styles.summaryValue}>{activeList?.total_items || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Total</Text>
                <Text style={styles.summaryPrice}>£{getTotalCost()}</Text>
              </View>
            </View>

            <Text style={styles.itemsHeader}>Items</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyListContainer}>
            <Ionicons name="basket-outline" size={48} color={colors.neutral.gray} />
            <Text style={styles.emptyListText}>This list is empty. Search for products to add items.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.dark} />}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.dark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping</Text>
        <Text style={styles.headerSubtitle}>Manage your cart and shopping lists</Text>
      </View>

      {renderViewModeToggle()}
      {viewMode === 'lists' && renderListSelector()}
      {viewMode === 'cart' ? renderCartView() : renderSavedListsView()}

      {/* Swap Modal */}
      {renderSwapModal()}

      {/* New List Modal */}
      <Modal
        visible={showNewListModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Shopping List</Text>
            <TextInput
              style={styles.modalInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              placeholderTextColor={colors.neutral.gray}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setShowNewListModal(false);
                  setNewListName('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonCreate} onPress={handleCreateList}>
                <Text style={styles.modalButtonCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.offWhite },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.neutral.offWhite,
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

  listSelector: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
    backgroundColor: colors.neutral.white,
  },
  listTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.base,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.offWhite,
  },
  listTabActive: { backgroundColor: colors.primary.dark },
  listTabText: { fontSize: typography.fontSize.base, color: colors.neutral.charcoal },
  listTabTextActive: { color: colors.neutral.white, fontWeight: typography.fontWeight.medium },
  listTabCount: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.neutral.gray,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  addListButton: {
    marginLeft: spacing.sm,
    marginRight: spacing.base,
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
    borderStyle: 'dashed',
  },

  listContent: { padding: spacing.base, paddingBottom: spacing['3xl'] },

  comparisonCard: {
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  comparisonTitle: { marginLeft: spacing.sm, fontSize: typography.fontSize.base, color: colors.neutral.white, opacity: 0.8 },
  comparisonRetailer: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.neutral.white },
  comparisonPrice: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: colors.accent.lime, marginVertical: spacing.xs },
  comparisonMeta: { fontSize: typography.fontSize.sm, color: colors.neutral.white, opacity: 0.7 },

  summaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  summaryLabel: { fontSize: typography.fontSize.base, color: colors.neutral.darkGray },
  summaryValue: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.neutral.charcoal },
  summaryPrice: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.primary.dark },

  itemsHeader: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.neutral.charcoal, marginBottom: spacing.sm },

  emptyContainer: { flex: 1, padding: spacing.base, justifyContent: 'center' },
  emptyListContainer: { alignItems: 'center', padding: spacing['2xl'] },
  emptyListText: { fontSize: typography.fontSize.base, color: colors.neutral.darkGray, textAlign: 'center', marginTop: spacing.md },
  emptyListTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.neutral.charcoal, marginTop: spacing.md, textAlign: 'center' },

  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    gap: spacing.sm,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral.offWhite,
    gap: spacing.xs,
  },
  viewModeTabActive: { backgroundColor: colors.primary.dark },
  viewModeText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.neutral.darkGray },
  viewModeTextActive: { color: colors.neutral.white },

  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cartItemImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  cartImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  cartItemInfo: { flex: 1, marginRight: spacing.sm },
  cartItemName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.neutral.charcoal, marginBottom: 2 },
  cartItemBrand: { fontSize: typography.fontSize.xs, color: colors.neutral.gray, marginBottom: spacing.xs },
  cartScores: { flexDirection: 'row', gap: spacing.xs },
  scoreBadgeSm: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.sm },
  scoreBadgeTextSm: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: colors.neutral.white },

  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.offWhite,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  quantityButton: { padding: spacing.sm },
  quantityText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
    minWidth: 24,
    textAlign: 'center',
  },

  swapButton: { padding: spacing.xs, marginRight: spacing.xs },
  removeButton: { padding: spacing.xs },

  clearCartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, marginBottom: spacing.md, gap: spacing.xs },
  clearCartText: { fontSize: typography.fontSize.sm, color: colors.neutral.gray },

  infoCard: { flexDirection: 'row', backgroundColor: colors.primary.light + '20', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  infoText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.primary.dark, lineHeight: 18 },

  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary.dark, borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  createButtonText: { color: colors.neutral.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, marginLeft: spacing.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.base },
  modalContent: { width: '100%', backgroundColor: colors.neutral.white, borderRadius: borderRadius.xl, padding: spacing.xl },
  modalTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.neutral.charcoal, marginBottom: spacing.lg },
  modalInput: { borderWidth: 1, borderColor: colors.neutral.lightGray, borderRadius: borderRadius.lg, padding: spacing.md, fontSize: typography.fontSize.base, color: colors.neutral.charcoal, marginBottom: spacing.lg },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  modalButtonCancel: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginRight: spacing.sm },
  modalButtonCancelText: { fontSize: typography.fontSize.base, color: colors.neutral.darkGray },
  modalButtonCreate: { backgroundColor: colors.primary.dark, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
  modalButtonCreateText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.neutral.white },

  // Price summary
  priceSummaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.lime,
  },
  priceSummaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  priceSummaryTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.neutral.charcoal, marginLeft: spacing.sm },
  estimatedTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.neutral.offWhite, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  estimatedLabel: { fontSize: typography.fontSize.base, color: colors.neutral.darkGray },
  estimatedPrice: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.accent.lime },

  retailerBreakdownTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.neutral.darkGray, marginBottom: spacing.sm },
  retailerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.neutral.lightGray },
  retailerInfo: { flex: 1 },
  retailerName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium, color: colors.neutral.charcoal },
  retailerItems: { fontSize: typography.fontSize.sm, color: colors.neutral.gray, marginTop: 2 },
  retailerPriceContainer: { flexDirection: 'row', alignItems: 'center' },
  retailerTotal: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.neutral.charcoal },
  cheapestRetailerTotal: { color: colors.accent.lime },
  cheapestBadge: { backgroundColor: colors.accent.lime, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.sm, marginLeft: spacing.xs },
  cheapestBadgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: colors.neutral.white },
  savingsNote: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.neutral.lightGray },
  savingsNoteText: { marginLeft: spacing.xs, fontSize: typography.fontSize.sm, color: colors.accent.orange, fontStyle: 'italic' },

  cartPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  cartItemPrice: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, color: colors.primary.dark },
  cartLineTotal: { fontSize: typography.fontSize.sm, color: colors.neutral.darkGray, marginLeft: spacing.xs },

  // Swap modal styles
  modalContainer: { flex: 1, backgroundColor: colors.neutral.offWhite },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.lightGray,
    backgroundColor: colors.neutral.white,
  },
  modalSubtitle: { fontSize: typography.fontSize.sm, color: colors.neutral.darkGray, marginTop: 2 },
  closeButton: { padding: spacing.xs },

  originalSwapCard: {
    backgroundColor: colors.neutral.white,
    margin: spacing.base,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  originalLabel: { fontSize: typography.fontSize.sm, color: colors.neutral.darkGray, marginBottom: spacing.sm },
  originalName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.neutral.charcoal },
  originalBrand: { fontSize: typography.fontSize.sm, color: colors.neutral.gray, marginTop: 2 },

  loadingAlternatives: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.base, color: colors.neutral.darkGray },
  noAlternatives: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  noAlternativesText: { marginTop: spacing.md, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.neutral.charcoal },
  noAlternativesSubtext: { marginTop: spacing.xs, fontSize: typography.fontSize.sm, color: colors.neutral.gray },

  alternativesList: { padding: spacing.base },
  alternativeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  alternativeLeft: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.neutral.lightGray,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  altImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  altImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  alternativeInfo: { flex: 1 },
  alternativeName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.neutral.charcoal },
  alternativeBrand: { fontSize: typography.fontSize.sm, color: colors.neutral.gray, marginTop: 2 },

  altBadges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  altBadge: { backgroundColor: colors.primary.dark, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: borderRadius.sm },
  altBadgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: colors.neutral.white },
});

export default PantryScreen;
