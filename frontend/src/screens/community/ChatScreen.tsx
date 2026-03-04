/**
 * ChatScreen — Individual conversation view with message bubbles.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  // GlassTabBar is position:absolute, 68px tall, sitting Math.max(insets.bottom,12) from the bottom
  const tabBarClearance = 68 + Math.max(insets.bottom, 12) + 8;
  const { messages, messagesLoading, loadMessages, sendMessage, clearMessages } = useMessagingStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    clearMessages();
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
  }, [user?.id, colors, isDark]);

  const inputBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface.background, paddingBottom: tabBarClearance }]}>
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

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatText: { fontSize: typography.fontSize.base },

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
