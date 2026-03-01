import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { RetailerPrice, CombinedProduct } from '@/services/api';
import {
  View,
  Text,
  ActivityIndicator,
  SectionList,
  FlatList,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import {
  useSafeAreaInsets,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMyListStore, MyListItem, UserList } from '@/store';
import { useTheme, spacing, typography, borderRadius } from '@/theme';
import { GlassCard, AnimatedPressable, PriceTag, ProductDetailModal, ScoreBadge, ShareToFriendModal } from '@/components';
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

// ── List Selector Modal ───────────────────────────────────────────────────────

interface ListSelectorModalProps {
  visible: boolean;
  lists: UserList[];
  activeListId: number | null;
  onSelect: (id: number) => void;
  onCreate: (name: string) => void;
  onDelete: (list: UserList) => void;
  onRename: (list: UserList) => void;
  onDuplicate: (list: UserList) => void;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}

const ListSelectorModal: React.FC<ListSelectorModalProps> = ({
  visible,
  lists,
  activeListId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onDuplicate,
  onClose,
  colors,
  isDark,
}) => {
  const [newListName, setNewListName] = useState('');

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewListName('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.sheetWrap}
      >
        <View
          style={[
            modalStyles.sheet,
            {
              backgroundColor: isDark ? '#1a1f2e' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {/* Handle bar */}
          <View
            style={[
              modalStyles.handle,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' },
            ]}
          />

          {/* Title */}
          <View style={modalStyles.sheetHeader}>
            <Text style={[modalStyles.sheetTitle, { color: colors.neutral.charcoal }]}>
              My Lists
            </Text>
            <AnimatedPressable onPress={onClose} style={modalStyles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.neutral.gray} />
            </AnimatedPressable>
          </View>

          {/* List of existing lists */}
          <ScrollView style={modalStyles.listScroll} showsVerticalScrollIndicator={false}>
            {lists.length === 0 ? (
              <Text style={[modalStyles.emptyHint, { color: colors.neutral.gray }]}>
                No lists yet. Create one below.
              </Text>
            ) : (
              lists.map((list) => {
                const isActive = list.id === activeListId;
                return (
                  <View
                    key={list.id}
                    style={[
                      modalStyles.listRow,
                      isActive && {
                        backgroundColor: isDark
                          ? 'rgba(74,222,128,0.1)'
                          : 'rgba(22,101,52,0.06)',
                        borderColor: colors.primary.main + '40',
                        borderWidth: 1,
                      },
                      !isActive && {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                        borderColor: 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <AnimatedPressable
                      onPress={() => {
                        onSelect(list.id);
                        onClose();
                      }}
                      style={modalStyles.listRowMain}
                    >
                      <Ionicons
                        name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isActive ? colors.primary.main : colors.neutral.gray}
                      />
                      <View style={modalStyles.listRowText}>
                        <Text
                          style={[
                            modalStyles.listRowName,
                            {
                              color: isActive
                                ? colors.primary.main
                                : colors.neutral.charcoal,
                              fontWeight: isActive ? '700' : '500',
                            },
                          ]}
                        >
                          {list.name}
                        </Text>
                        <Text style={[modalStyles.listRowCount, { color: colors.neutral.gray }]}>
                          {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                    </AnimatedPressable>

                    <View style={modalStyles.listRowActions}>
                      <AnimatedPressable
                        onPress={() => onRename(list)}
                        style={modalStyles.iconBtn}
                      >
                        <Ionicons name="pencil-outline" size={16} color={colors.neutral.darkGray} />
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => onDuplicate(list)}
                        style={modalStyles.iconBtn}
                      >
                        <Ionicons name="copy-outline" size={16} color={colors.neutral.darkGray} />
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => onDelete(list)}
                        style={modalStyles.iconBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* New list input */}
          <View
            style={[
              modalStyles.newListRow,
              {
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <TextInput
              style={[
                modalStyles.newListInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: colors.neutral.charcoal,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
              placeholder="New list name…"
              placeholderTextColor={colors.neutral.gray}
              value={newListName}
              onChangeText={setNewListName}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
              maxLength={60}
            />
            <AnimatedPressable
              onPress={handleCreate}
              style={[
                modalStyles.createBtn,
                {
                  backgroundColor: newListName.trim()
                    ? colors.primary.main
                    : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <Ionicons
                name="add"
                size={20}
                color={newListName.trim() ? '#ffffff' : colors.neutral.gray}
              />
            </AnimatedPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────

export const MyListScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    lists,
    activeListId,
    listsLoading,
    items,
    loading,
    fetchLists,
    createList,
    deleteList,
    renameList,
    duplicateList,
    setActiveList,
    fetchMyList,
    isSaved,
    removeItem: removeFromMyList,
    addItem: addToMyList,
  } = useMyListStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('split');
  const [selectedRetailerId, setSelectedRetailerId] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CombinedProduct | null>(null);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Reset retailer filter when active list changes
  useEffect(() => {
    setSelectedRetailerId(null);
  }, [activeListId]);

  const activeList = useMemo(
    () => lists.find(l => l.id === activeListId) ?? null,
    [lists, activeListId],
  );

  const handleProductPress = useCallback((product: CombinedProduct) => {
    setSelectedProduct(product);
    setProductModalVisible(true);
  }, []);

  const handleSavePress = useCallback(
    async (product: CombinedProduct) => {
      if (isSaved(product.barcode)) {
        await removeFromMyList(product.barcode);
      } else {
        await addToMyList(product.barcode, product.name, 1);
      }
    },
    [isSaved, removeFromMyList, addToMyList],
  );

  // ── Rename helper (uses Alert.prompt on iOS, web-compatible approach) ──────
  const handleRename = useCallback(
    (list: UserList) => {
      if (Platform.OS === 'web') {
        // web fallback
        const name = window.prompt('Rename list:', list.name);
        if (name && name.trim()) renameList(list.id, name.trim());
      } else {
        Alert.prompt(
          'Rename List',
          '',
          (text) => { if (text?.trim()) renameList(list.id, text.trim()); },
          'plain-text',
          list.name,
        );
      }
    },
    [renameList],
  );

  // ── Delete helper ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    (list: UserList) => {
      const doDelete = () => deleteList(list.id);
      if (Platform.OS === 'web') {
        if (window.confirm(`Delete "${list.name}" and all its items?`)) doDelete();
      } else {
        Alert.alert(
          'Delete List',
          `Delete "${list.name}" and all its items?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ],
        );
      }
    },
    [deleteList],
  );

  // ── Duplicate helper ───────────────────────────────────────────────────────
  const handleDuplicate = useCallback(
    (list: UserList) => {
      duplicateList(list.id);
    },
    [duplicateList],
  );

  // ── Retail sections ───────────────────────────────────────────────────────
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

  // ── Renderers ─────────────────────────────────────────────────────────────
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
      <GlassCard
        blur="subtle"
        padding="md"
        onPress={item.productData ? () => handleProductPress(item.productData!) : undefined}
      >
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

            {/* Nutri-Score & NOVA badges */}
            {item.productData?.nutrition && (
              <View style={styles.scoreBadgesRow}>
                <ScoreBadge
                  type="nutri"
                  value={item.productData.nutrition.nutriscore_grade}
                  size="sm"
                  showLabel
                />
                <ScoreBadge
                  type="nova"
                  value={item.productData.nutrition.nova_group}
                  size="sm"
                  showLabel
                />
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    ),
    [colors],
  );

  const zeroTopInsets = useMemo(
    () => ({ ...insets, top: 0 }),
    [insets],
  );

  const tabBarHeight = 44;

  const retailerFilterRow =
    activeTab === 'split' && availableRetailers.length > 0 ? (
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

  // ── No-lists empty state ──────────────────────────────────────────────────
  if (!listsLoading && lists.length === 0) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.surface.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }]}>
            My Lists
          </Text>
        </View>

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
                <Ionicons name="list-outline" size={48} color={colors.primary.main} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.neutral.charcoal }]}>
                No lists yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.neutral.darkGray }]}>
                Create a list to start saving products and comparing prices.
              </Text>
              <AnimatedPressable
                onPress={() => setShowListModal(true)}
                style={[styles.createFirstBtn, { backgroundColor: colors.primary.main }]}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.createFirstBtnText}>Create a list</Text>
              </AnimatedPressable>
            </View>
          </GlassCard>
        </View>

        <ListSelectorModal
          visible={showListModal}
          lists={lists}
          activeListId={activeListId}
          onSelect={setActiveList}
          onCreate={createList}
          onDelete={handleDelete}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onClose={() => setShowListModal(false)}
          colors={colors}
          isDark={isDark}
        />
        <ProductDetailModal
          visible={productModalVisible}
          onClose={() => setProductModalVisible(false)}
          product={selectedProduct}
          isSaved={isSaved}
          onSavePress={handleSavePress}
        />
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable
          onPress={() => setShowListModal(true)}
          style={styles.listSelectorBtn}
        >
          <Ionicons name="layers-outline" size={18} color={colors.neutral.darkGray} />
          <Text
            style={[styles.headerTitle, { color: colors.neutral.charcoal }]}
            numberOfLines={1}
          >
            {activeList?.name ?? 'My List'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.neutral.darkGray} />
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
        </AnimatedPressable>

        {/* Share list button */}
        {activeList && (
          <AnimatedPressable
            onPress={() => setShareVisible(true)}
            style={[
              styles.newListBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <Ionicons name="share-outline" size={18} color={colors.primary.main} />
          </AnimatedPressable>
        )}

        {/* New list shortcut */}
        <AnimatedPressable
          onPress={() => setShowListModal(true)}
          style={[
            styles.newListBtn,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.primary.main} />
        </AnimatedPressable>
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
        loading || listsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={[styles.loadingText, { color: colors.neutral.darkGray }]}>
              Loading list…
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
                  {activeList?.name ?? 'This list'} is empty
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: colors.neutral.darkGray }]}
                >
                  Save products from search to compare prices and add them to
                  your list.
                </Text>
              </View>
            </GlassCard>
          </View>
        ) : (
          <>
            {retailerFilterRow}
            {selectedRetailerId ? (
              <>
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
          <PantryScreen onProductPress={handleProductPress} />
        </SafeAreaInsetsContext.Provider>
      )}

      {/* List selector modal */}
      <ListSelectorModal
        visible={showListModal}
        lists={lists}
        activeListId={activeListId}
        onSelect={setActiveList}
        onCreate={createList}
        onDelete={handleDelete}
        onRename={handleRename}
        onDuplicate={handleDuplicate}
        onClose={() => setShowListModal(false)}
        colors={colors}
        isDark={isDark}
      />

      {/* Product detail modal */}
      <ProductDetailModal
        visible={productModalVisible}
        onClose={() => setProductModalVisible(false)}
        product={selectedProduct}
        isSaved={isSaved}
        onSavePress={handleSavePress}
      />

      {/* Share list modal */}
      {activeList && (
        <ShareToFriendModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          contentType="shopping_list"
          contentId={activeList.id}
          contentTitle={activeList.name}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

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
    gap: spacing.sm,
  },

  listSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: typography.letterSpacing.tight,
    flexShrink: 1,
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

  newListBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
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

  filterChipsScroll: { flexGrow: 0 },

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

  sectionSeparator: { height: spacing.sm },
  separator: { height: spacing.sm },

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

  cardInfo: { flex: 1 },

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

  scoreBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  promoText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
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

  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },

  createFirstBtnText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  removeButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },

  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingBottom: 34, // safe area bottom
    maxHeight: '75%',
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  sheetTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listScroll: {
    paddingHorizontal: spacing.base,
    maxHeight: 320,
  },

  emptyHint: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    paddingVertical: spacing.lg,
  },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xs,
    paddingRight: spacing.sm,
    overflow: 'hidden',
  },

  listRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },

  listRowText: {
    flex: 1,
  },

  listRowName: {
    fontSize: typography.fontSize.base,
  },

  listRowCount: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },

  listRowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  iconBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },

  newListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    marginHorizontal: spacing.base,
  },

  newListInput: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
  },

  createBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MyListScreen;
