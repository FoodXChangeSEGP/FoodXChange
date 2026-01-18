/**
 * Shopping List Screen (Pantry Tab)
 * Manages shopping lists with product titles, prices, and retailer comparison
 */

import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import { ShoppingListItem, PlaceholderCard } from '@/components';
import { api, ShoppingList, ShoppingListItem as ShoppingListItemType, RetailerComparison } from '@/services/api';
import { useShoppingStore } from '@/store';

export const PantryScreen: React.FC = () => {
  const { lists, setLists, activeListId, setActiveList } = useShoppingStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeList, setActiveListData] = useState<ShoppingList | null>(null);
  const [comparison, setComparison] = useState<RetailerComparison[]>([]);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');

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
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [setLists, activeListId, setActiveList]);

  const fetchActiveListDetails = useCallback(async () => {
    if (!activeListId) return;
    
    try {
      const list = await api.shoppingLists.getById(activeListId);
      setActiveListData(list);
      
      // Fetch price comparison
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
    if (activeListId) {
      fetchActiveListDetails();
    }
  }, [activeListId, fetchActiveListDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchShoppingLists();
    fetchActiveListDetails();
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
    
    Alert.alert(
      'Remove Item',
      `Remove ${item.product.name} from your list?`,
      [
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
      ]
    );
  };

  const getCheapestRetailer = () => {
    if (comparison.length === 0) return null;
    return comparison.find(c => c.is_cheapest);
  };

  const getTotalCost = () => {
    if (!activeList?.items) return '0.00';
    return activeList.items.reduce((sum, item) => {
      const price = item.product.lowest_price 
        ? parseFloat(item.product.lowest_price) 
        : 0;
      return sum + (price * item.quantity);
    }, 0).toFixed(2);
  };

  const renderListSelector = () => (
    <View style={styles.listSelector}>
      <FlatList
        data={lists}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.listTab,
              activeListId === item.id && styles.listTabActive,
            ]}
            onPress={() => setActiveList(item.id)}
          >
            <Text
              style={[
                styles.listTabText,
                activeListId === item.id && styles.listTabTextActive,
              ]}
            >
              {item.name}
            </Text>
            <Text style={styles.listTabCount}>{item.total_items}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addListButton}
            onPress={() => setShowNewListModal(true)}
          >
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Lists</Text>
        <Text style={styles.headerSubtitle}>
          Manage your shopping and compare prices
        </Text>
      </View>

      {/* List Selector */}
      {renderListSelector()}

      {lists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <PlaceholderCard
            title="No Shopping Lists"
            description="Create your first shopping list to start comparing prices"
            icon="cart-outline"
            color={colors.primary.dark}
          />
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowNewListModal(true)}
          >
            <Ionicons name="add" size={20} color={colors.neutral.white} />
            <Text style={styles.createButtonText}>Create List</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeList?.items || []}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ShoppingListItem
              item={item}
              onToggleCheck={handleToggleItem}
              onRemove={handleRemoveItem}
            />
          )}
          ListHeaderComponent={
            <>
              {/* Price Comparison */}
              {renderPriceComparison()}
              
              {/* List Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items</Text>
                  <Text style={styles.summaryValue}>
                    {activeList?.total_items || 0}
                  </Text>
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
              <Text style={styles.emptyListText}>
                This list is empty. Search for products to add items.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary.dark}
            />
          }
        />
      )}

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
              <TouchableOpacity
                style={styles.modalButtonCreate}
                onPress={handleCreateList}
              >
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
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  listTabActive: {
    backgroundColor: colors.primary.dark,
  },
  listTabText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
  },
  listTabTextActive: {
    color: colors.neutral.white,
    fontWeight: typography.fontWeight.medium,
  },
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
  listContent: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  comparisonCard: {
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  comparisonTitle: {
    marginLeft: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.neutral.white,
    opacity: 0.8,
  },
  comparisonRetailer: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
  },
  comparisonPrice: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.accent.lime,
    marginVertical: spacing.xs,
  },
  comparisonMeta: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.white,
    opacity: 0.7,
  },
  summaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
  },
  summaryPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
  itemsHeader: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    padding: spacing.base,
    justifyContent: 'center',
  },
  emptyListContainer: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyListText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  createButtonText: {
    color: colors.neutral.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.neutral.lightGray,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.neutral.charcoal,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButtonCancel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginRight: spacing.sm,
  },
  modalButtonCancelText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
  },
  modalButtonCreate: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  modalButtonCreateText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.white,
  },
});

export default PantryScreen;
