/**
 * ChatScreen — Individual conversation view with message bubbles.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import { useMessagingStore } from '@/store/useMessagingStore';
import { useAuthStore } from '@/store';
import { useMyListStore } from '@/store';
import { api } from '@/services/api';
import type { Conversation, DirectMessage, SharedListData } from '@/types/community';

interface ChatScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversation, onBack }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const tabBarClearance = 68 + Math.max(insets.bottom, 12) + 8;
  const { messages, messagesLoading, loadMessages, sendMessage, clearMessages } = useMessagingStore();
  const { lists, fetchLists, fetchMyList, setActiveList } = useMyListStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [loadingListId, setLoadingListId] = useState<number | null>(null);
  // Track which shared-list message cards are expanded (keyed by message id)
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  // Track saving state per message id
  const [savingListId, setSavingListId] = useState<number | null>(null);
  // Save-to-list picker
  const [pendingListData, setPendingListData] = useState<SharedListData | null>(null);
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [savingToListId, setSavingToListId] = useState<number | null>(null);
  // Track which messages have been saved: msgId → { listId, barcodes }
  const [savedMessages, setSavedMessages] = useState<Record<number, { listId: number; barcodes: string[] }>>({});
  const [removingMsgId, setRemovingMsgId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    clearMessages();
    loadMessages(conversation.id);
    const interval = setInterval(() => loadMessages(conversation.id), 5000);
    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Load lists when picker opens
  useEffect(() => {
    if (showListPicker) fetchLists();
  }, [showListPicker]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(conversation.id, trimmed);
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, sending, conversation.id, sendMessage]);

  const handleShareList = useCallback(async (listId: number, listName: string) => {
    setLoadingListId(listId);
    try {
      await setActiveList(listId);
      await fetchMyList();
      const currentItems = useMyListStore.getState().items;
      const payload: SharedListData = {
        list_id: listId,
        name: listName,
        item_count: currentItems.length,
        items: currentItems.map((i) => ({ barcode: i.barcode, name: i.name, quantity: i.quantity })),
      };
      await sendMessage(conversation.id, '', payload);
      setShowListPicker(false);
    } catch {
      // silently fail — user stays in picker
    } finally {
      setLoadingListId(null);
    }
  }, [conversation.id, sendMessage, setActiveList, fetchMyList]);

  // Opens the save-to picker for a received shared list
  const handleSaveList = useCallback((msgId: number, listData: SharedListData) => {
    setSavingListId(msgId);
    setPendingListData(listData);
    fetchLists();
    setShowSavePicker(true);
  }, [fetchLists]);

  // Actually saves items to the chosen list (or a new one)
  const handleConfirmSave = useCallback(async (targetListId: number | 'new') => {
    if (!pendingListData) return;
    const msgId = savingListId!;
    const itemsToSave = pendingListData.items; // snapshot before any async work
    let listId: number;
    let listName: string;
    if (targetListId === 'new') {
      const created = await useMyListStore.getState().createList(pendingListData.name);
      if (!created) {
        Alert.alert('Error', 'Could not create the list. Please try again.');
        return;
      }
      listId = created.id;
      listName = created.name;
    } else {
      listId = targetListId;
      listName = lists.find((l) => l.id === listId)?.name ?? pendingListData.name;
    }
    setSavingToListId(listId);
    try {
      // Ensure the target list is active so fetchMyList targets it
      const store = useMyListStore.getState();
      if (store.activeListId !== listId) {
        await store.setActiveList(listId);
      }
      // Add all items in parallel — backend handles duplicates via get_or_create
      await Promise.all(
        itemsToSave.map((item) => api.mylist.add(item.barcode, item.name, listId, item.quantity))
      );
      // Force-fetch so the newly added items appear in split/compare view
      await useMyListStore.getState().fetchMyList();
      // Refresh list metadata (item_count badge etc.)
      await useMyListStore.getState().fetchLists();
      // Record which barcodes were saved so the toggle can remove them
      setSavedMessages((prev) => ({
        ...prev,
        [msgId]: { listId, barcodes: itemsToSave.map((i) => i.barcode) },
      }));
      setShowSavePicker(false);
      setPendingListData(null);
      setSavingListId(null);
      Alert.alert('Saved!', `Items added to "${listName}".`);
    } catch {
      Alert.alert('Error', 'Could not save items. Please try again.');
    } finally {
      setSavingToListId(null);
    }
  }, [pendingListData, savingListId, lists]);

  // Removes previously saved items and clears the saved state for that message
  const handleRemoveSaved = useCallback(async (msgId: number) => {
    const saved = savedMessages[msgId];
    if (!saved) return;
    setRemovingMsgId(msgId);
    try {
      const store = useMyListStore.getState();
      if (store.activeListId !== saved.listId) {
        await store.setActiveList(saved.listId);
      } else {
        await store.fetchMyList();
      }
      for (const barcode of saved.barcodes) {
        await useMyListStore.getState().removeItem(barcode);
      }
      setSavedMessages((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    } catch {
      Alert.alert('Error', 'Could not remove items. Please try again.');
    } finally {
      setRemovingMsgId(null);
    }
  }, [savedMessages]);

  const renderMessage = useCallback(({ item }: { item: DirectMessage }) => {
    const isMe = item.sender === user?.id;

    if (item.shared_list_data) {
      const listData = item.shared_list_data;
      const isExpanded = !!expandedCards[item.id];
      const PREVIEW_COUNT = 4;
      const overflow = listData.items.length - PREVIEW_COUNT;
      const visibleItems = isExpanded ? listData.items : listData.items.slice(0, PREVIEW_COUNT);
      const textColor = isMe ? '#fff' : colors.neutral.charcoal;
      const mutedColor = isMe ? 'rgba(255,255,255,0.70)' : colors.neutral.gray;
      const itemColor = isMe ? 'rgba(255,255,255,0.85)' : colors.neutral.darkGray;

      return (
        <View style={[styles.bubbleRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
          <View style={[
            styles.listCard,
            isMe
              ? { backgroundColor: colors.primary.main + 'ee', borderBottomRightRadius: 4 }
              : {
                  backgroundColor: isDark ? 'rgba(30,41,59,0.90)' : 'rgba(226,232,240,0.95)',
                  borderBottomLeftRadius: 4,
                },
          ]}>
            {/* Header */}
            <View style={styles.listCardHeader}>
              <Text style={{ fontSize: 16 }}>🛒</Text>
              <Text style={[styles.listCardTitle, { color: textColor }, textFont.semibold]}>
                {listData.name}
              </Text>
            </View>

            {/* Item count */}
            <Text style={[styles.listCardCount, { color: mutedColor }, textFont.regular]}>
              {listData.item_count} item{listData.item_count !== 1 ? 's' : ''}
            </Text>

            {/* Items */}
            {visibleItems.map((li, idx) => (
              <Text
                key={idx}
                style={[styles.listCardItem, { color: itemColor }, textFont.regular]}
                numberOfLines={1}
              >
                · {li.name}{li.quantity > 1 ? ` ×${li.quantity}` : ''}
              </Text>
            ))}

            {/* Expand / collapse toggle */}
            {overflow > 0 && (
              <TouchableOpacity
                onPress={() => setExpandedCards((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.listCardMore, { color: mutedColor }, textFont.semibold]}>
                  {isExpanded ? 'Show less ▲' : `+${overflow} more ▼`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Save to My Lists / Remove toggle — shown only for recipient */}
            {!isMe && (() => {
              const isSaved = !!savedMessages[item.id];
              const isLoading = savingListId === item.id || removingMsgId === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    isSaved
                      ? { borderColor: colors.accent.error, backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)' }
                      : { borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' },
                    isLoading && { opacity: 0.6 },
                  ]}
                  onPress={() => isSaved ? handleRemoveSaved(item.id) : handleSaveList(item.id, listData)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isSaved ? colors.accent.error : colors.primary.main} />
                  ) : isSaved ? (
                    <Text style={[styles.saveBtnText, { color: colors.accent.error }, textFont.semibold]}>
                      ✓ Saved — Remove
                    </Text>
                  ) : (
                    <Text style={[styles.saveBtnText, { color: colors.primary.main }, textFont.semibold]}>
                      + Save to My Lists
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}

            {/* Timestamp */}
            <Text style={[styles.bubbleTime, { color: mutedColor, marginTop: 6 }, textFont.regular]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.bubbleRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
        <View style={[
          styles.bubble,
          isMe
            ? { backgroundColor: colors.primary.main, borderBottomRightRadius: 4 }
            : {
                backgroundColor: isDark ? 'rgba(30,41,59,0.70)' : 'rgba(226,232,240,0.80)',
                borderBottomLeftRadius: 4,
              },
        ]}>
          <Text style={[
            styles.bubbleText,
            { color: isMe ? '#FFFFFF' : colors.neutral.charcoal },
            textFont.regular,
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.bubbleTime,
            { color: isMe ? 'rgba(255,255,255,0.7)' : colors.neutral.gray },
            textFont.regular,
          ]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }, [user?.id, colors, isDark, expandedCards, savingListId, savedMessages, removingMsgId, handleSaveList, handleRemoveSaved]);

  const inputBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';
  const pickerBg = isDark ? '#0f172a' : '#ffffff';
  const pickerBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const mutedCol = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface.background, paddingBottom: tabBarClearance }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.surface.glassBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: colors.primary.main }, textFont.semibold]}>← Back</Text>
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary.light }]}>
          <Text style={styles.headerAvatarText}>
            {(conversation.other_user.first_name || conversation.other_user.username).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.headerName, { color: colors.neutral.charcoal }, textFont.bold]}>
          {conversation.other_user.first_name || conversation.other_user.username}
        </Text>
      </View>

      {/* Messages */}
      <View style={styles.messagesWrapper}>
        {messagesLoading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary.main} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            style={styles.messageList}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={[styles.emptyChatText, { color: colors.neutral.gray }, textFont.medium]}>
                  No messages yet — say hello! 👋
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Input */}
      <View style={[styles.inputRow, { borderColor: colors.surface.glassBorder, backgroundColor: colors.surface.background }]}>
        <TouchableOpacity
          style={[styles.attachBtn, { backgroundColor: isDark ? 'rgba(30,41,59,0.60)' : 'rgba(226,232,240,0.80)', borderColor: colors.surface.glassBorder }]}
          onPress={() => setShowListPicker(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>🛒</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputBg,
              color: colors.neutral.charcoal,
              borderColor: colors.surface.glassBorder,
            },
            textFont.regular,
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.neutral.gray}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: text.trim() ? colors.primary.main : colors.neutral.lightGray },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={[styles.sendText, textFont.bold]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* List picker modal */}
      <Modal visible={showListPicker} transparent animationType="slide" onRequestClose={() => setShowListPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowListPicker(false)} />
        <View style={[styles.pickerSheet, { backgroundColor: pickerBg, borderColor: pickerBorder }]}>
          <Text style={[styles.pickerTitle, { color: colors.neutral.charcoal }, textFont.bold]}>Share a Shopping List</Text>
          {lists.length === 0 ? (
            <Text style={[styles.pickerEmpty, { color: mutedCol }, textFont.regular]}>You have no lists to share.</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {lists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[styles.pickerItem, { borderColor: pickerBorder }]}
                  onPress={() => handleShareList(list.id, list.name)}
                  disabled={loadingListId !== null}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pickerItemIcon, { backgroundColor: colors.primary.main + '20' }]}>
                    <Text style={{ fontSize: 18 }}>🛒</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemName, { color: colors.neutral.charcoal }, textFont.semibold]}>{list.name}</Text>
                    <Text style={[styles.pickerItemCount, { color: mutedCol }, textFont.regular]}>{list.item_count} items</Text>
                  </View>
                  {loadingListId === list.id
                    ? <ActivityIndicator size="small" color={colors.primary.main} />
                    : <Text style={[{ color: colors.primary.main, fontSize: 20 }]}>›</Text>
                  }
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Save-to-list picker modal */}
      <Modal visible={showSavePicker} transparent animationType="slide" onRequestClose={() => { setShowSavePicker(false); setSavingListId(null); setPendingListData(null); }}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => { setShowSavePicker(false); setSavingListId(null); setPendingListData(null); }} />
        <View style={[styles.pickerSheet, { backgroundColor: pickerBg, borderColor: pickerBorder }]}>
          <Text style={[styles.pickerTitle, { color: colors.neutral.charcoal }, textFont.bold]}>Save to a List</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Create new list option */}
            <TouchableOpacity
              style={[styles.pickerItem, { borderColor: pickerBorder }]}
              onPress={() => handleConfirmSave('new')}
              disabled={savingToListId !== null}
              activeOpacity={0.7}
            >
              <View style={[styles.pickerItemIcon, { backgroundColor: colors.accent.success + '20' }]}>
                <Text style={{ fontSize: 18 }}>+</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerItemName, { color: colors.neutral.charcoal }, textFont.semibold]}>Create new list</Text>
                <Text style={[styles.pickerItemCount, { color: mutedCol }, textFont.regular]}>Save as "{pendingListData?.name}"</Text>
              </View>
              {savingToListId === -1
                ? <ActivityIndicator size="small" color={colors.primary.main} />
                : <Text style={{ color: colors.primary.main, fontSize: 20 }}>›</Text>
              }
            </TouchableOpacity>
            {/* Existing lists */}
            {lists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={[styles.pickerItem, { borderColor: pickerBorder }]}
                onPress={() => handleConfirmSave(list.id)}
                disabled={savingToListId !== null}
                activeOpacity={0.7}
              >
                <View style={[styles.pickerItemIcon, { backgroundColor: colors.primary.main + '20' }]}>
                  <Text style={{ fontSize: 18 }}>🛒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerItemName, { color: colors.neutral.charcoal }, textFont.semibold]}>{list.name}</Text>
                  <Text style={[styles.pickerItemCount, { color: mutedCol }, textFont.regular]}>{list.item_count} items</Text>
                </View>
                {savingToListId === list.id
                  ? <ActivityIndicator size="small" color={colors.primary.main} />
                  : <Text style={{ color: colors.primary.main, fontSize: 20 }}>›</Text>
                }
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5,
  },
  backBtn: { marginRight: spacing.sm },
  backText: { fontSize: typography.fontSize.base },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerAvatarText: { fontSize: typography.fontSize.md, color: '#FFFFFF', fontWeight: '700' },
  headerName: { fontSize: typography.fontSize.md },

  messagesWrapper: { flex: 1, minHeight: 0 } as any,
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { flex: 1 },
  messagesList: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, flexGrow: 1 },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
  },
  bubbleText: { fontSize: typography.fontSize.base, lineHeight: 20 },
  bubbleTime: { fontSize: typography.fontSize.xs, marginTop: 4, textAlign: 'right' },

  listCard: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.lg,
  },
  listCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  listCardTitle: { fontSize: typography.fontSize.base, flex: 1 },
  listCardCount: { fontSize: typography.fontSize.xs, marginBottom: 6 },
  listCardItem: { fontSize: typography.fontSize.sm, lineHeight: 18 },
  listCardMore: { fontSize: typography.fontSize.xs, marginTop: 2 },

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: typography.fontSize.base },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 0.5,
    gap: spacing.xs,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
  },
  sendBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendText: { color: '#FFFFFF', fontSize: typography.fontSize.sm },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: spacing.xl,
    maxHeight: '55%',
  },
  pickerTitle: { fontSize: typography.fontSize.lg, marginBottom: spacing.md },
  pickerEmpty: { fontSize: typography.fontSize.base, textAlign: 'center', paddingVertical: spacing.xl },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    gap: spacing.md,
  },
  pickerItemIcon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemName: { fontSize: typography.fontSize.base },
  pickerItemCount: { fontSize: typography.fontSize.sm, marginTop: 1 },

  saveBtn: {
    marginTop: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  saveBtnText: { fontSize: typography.fontSize.sm },
});

export default ChatScreen;
