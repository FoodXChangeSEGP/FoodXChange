/**
 * ChatScreen — Individual conversation view with message bubbles.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import { useMessagingStore } from '@/store/useMessagingStore';
import { useAuthStore } from '@/store';
import type { Conversation, DirectMessage } from '@/types/community';

interface ChatScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversation, onBack }) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const { messages, messagesLoading, loadMessages, sendMessage } = useMessagingStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages(conversation.id);
    // Poll for new messages every 5s
    const interval = setInterval(() => loadMessages(conversation.id), 5000);
    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(conversation.id, trimmed);
    } catch {
      setText(trimmed); // Restore text on failure
    } finally {
      setSending(false);
    }
  }, [text, sending, conversation.id, sendMessage]);

  const renderSharedContent = useCallback((item: DirectMessage, isMe: boolean) => {
    const sc = item.shared_content;
    if (!sc) return null;

    const typeEmoji: Record<string, string> = { shopping_list: '🛒', recipe: '🍳', event: '📅' };
    const typeLabel: Record<string, string> = { shopping_list: 'Shopping List', recipe: 'Recipe', event: 'Event' };

    return (
      <View style={[
        styles.sharedCard,
        {
          backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          borderColor: isMe ? 'rgba(255,255,255,0.2)' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'),
        },
      ]}>
        <Text style={styles.sharedEmoji}>{typeEmoji[sc.type] || '📎'}</Text>
        <View style={styles.sharedInfo}>
          <Text style={[
            styles.sharedLabel,
            { color: isMe ? 'rgba(255,255,255,0.7)' : colors.neutral.gray },
            textFont.medium,
          ]}>
            {typeLabel[sc.type] || 'Shared'}
          </Text>
          <Text style={[
            styles.sharedTitle,
            { color: isMe ? '#FFFFFF' : colors.neutral.charcoal },
            textFont.semibold,
          ]} numberOfLines={2}>
            {sc.title}
          </Text>
          {sc.description ? (
            <Text style={[
              styles.sharedDesc,
              { color: isMe ? 'rgba(255,255,255,0.8)' : colors.neutral.darkGray },
              textFont.regular,
            ]} numberOfLines={1}>
              {sc.description}
            </Text>
          ) : null}
          {sc.type === 'event' && sc.date && (
            <Text style={[
              styles.sharedMeta,
              { color: isMe ? 'rgba(255,255,255,0.7)' : colors.neutral.gray },
              textFont.regular,
            ]}>
              📅 {sc.date}{sc.location_name ? ` · 📍 ${sc.location_name}` : ''}
            </Text>
          )}
          {sc.type === 'recipe' && (
            <Text style={[
              styles.sharedMeta,
              { color: isMe ? 'rgba(255,255,255,0.7)' : colors.neutral.gray },
              textFont.regular,
            ]}>
              {sc.difficulty ? `${sc.difficulty}` : ''}{sc.total_time_minutes ? ` · ${sc.total_time_minutes} min` : ''}
            </Text>
          )}
          {sc.type === 'shopping_list' && sc.item_count !== undefined && (
            <Text style={[
              styles.sharedMeta,
              { color: isMe ? 'rgba(255,255,255,0.7)' : colors.neutral.gray },
              textFont.regular,
            ]}>
              {sc.item_count} item{sc.item_count !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
    );
  }, [colors, isDark]);

  const renderMessage = useCallback(({ item }: { item: DirectMessage }) => {
    const isMe = item.sender === user?.id;
    return (
      <View style={[
        styles.bubbleRow,
        { justifyContent: isMe ? 'flex-end' : 'flex-start' },
      ]}>
        <View style={[
          styles.bubble,
          isMe
            ? { backgroundColor: colors.primary.main, borderBottomRightRadius: 4 }
            : {
                backgroundColor: isDark ? 'rgba(30,41,59,0.70)' : 'rgba(226,232,240,0.80)',
                borderBottomLeftRadius: 4,
              },
        ]}>
          {renderSharedContent(item, isMe)}
          {item.text ? (
            <Text style={[
              styles.bubbleText,
              { color: isMe ? '#FFFFFF' : colors.neutral.charcoal },
              textFont.regular,
            ]}>
              {item.text}
            </Text>
          ) : null}
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
  }, [user?.id, colors, isDark, renderSharedContent]);

  const inputBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.surface.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.surface.glassBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: colors.primary.main }, textFont.semibold]}>← Back</Text>
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: colors.primary.light }]}>
          <Text style={styles.headerAvatarText}>
            {conversation.other_user.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.headerName, { color: colors.neutral.charcoal }, textFont.bold]}>
          {conversation.other_user.username}
        </Text>
      </View>

      {/* Messages */}
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

      {/* Input */}
      <View style={[styles.inputRow, { borderColor: colors.surface.glassBorder }]}>
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
    </KeyboardAvoidingView>
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

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },

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

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: typography.fontSize.base },

  sharedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  sharedEmoji: { fontSize: 24, marginTop: 2 },
  sharedInfo: { flex: 1 },
  sharedLabel: { fontSize: typography.fontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  sharedTitle: { fontSize: typography.fontSize.sm, lineHeight: 18, marginTop: 1 },
  sharedDesc: { fontSize: typography.fontSize.xs, marginTop: 2 },
  sharedMeta: { fontSize: typography.fontSize.xs, marginTop: 2 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
    marginRight: spacing.sm,
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
});

export default ChatScreen;
