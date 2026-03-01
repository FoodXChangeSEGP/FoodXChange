/**
 * ShareToFriendModal — pick a friend to share a shopping list, recipe, or event via DM.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal, TextInput,
  StyleSheet, ActivityIndicator, Alert, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont } from '@/theme';
import { useMessagingStore } from '@/store/useMessagingStore';
import { useAuthStore } from '@/store';
import type { Friend, SharedContentType } from '@/types/community';

interface ShareToFriendModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: SharedContentType;
  contentId: number;
  contentTitle: string;
}

export const ShareToFriendModal: React.FC<ShareToFriendModalProps> = ({
  visible, onClose, contentType, contentId, contentTitle,
}) => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const { friends, friendsLoading, loadFriends, shareContent } = useMessagingStore();
  const [sending, setSending] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible && isAuthenticated) {
      loadFriends();
    }
    if (visible) {
      setMessage('');
      setSending(null);
    }
  }, [visible, isAuthenticated]);

  const typeLabel: Record<SharedContentType, string> = {
    shopping_list: 'list',
    recipe: 'recipe',
    event: 'event',
  };

  const typeEmoji: Record<SharedContentType, string> = {
    shopping_list: '🛒',
    recipe: '🍳',
    event: '📅',
  };

  const handleShare = useCallback(async (friend: Friend) => {
    if (sending) return;
    setSending(friend.id);
    try {
      const defaultText = `${typeEmoji[contentType]} Shared a ${typeLabel[contentType]}: ${contentTitle}`;
      await shareContent(friend.id, contentType, contentId, message.trim() || defaultText);
      Alert.alert('Sent!', `${contentTitle} shared with ${friend.username}`);
      onClose();
    } catch {
      Alert.alert('Error', `Could not share with ${friend.username}. Make sure you are friends.`);
    } finally {
      setSending(null);
    }
  }, [sending, contentType, contentId, contentTitle, message, shareContent, onClose]);

  const renderFriend = useCallback(({ item }: { item: Friend }) => {
    const isSending = sending === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.friendRow,
          { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
        ]}
        onPress={() => handleShare(item)}
        disabled={!!sending}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary.light }]}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.neutral.charcoal }, textFont.semibold]}>
            {item.username}
          </Text>
          {(item.first_name || item.last_name) && (
            <Text style={[styles.friendSub, { color: colors.neutral.gray }, textFont.regular]}>
              {[item.first_name, item.last_name].filter(Boolean).join(' ')}
            </Text>
          )}
        </View>
        {isSending ? (
          <ActivityIndicator size="small" color={colors.primary.main} />
        ) : (
          <Ionicons name="send" size={20} color={colors.primary.main} />
        )}
      </TouchableOpacity>
    );
  }, [sending, colors, isDark, handleShare]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }, textFont.bold]}>
            Share {typeLabel[contentType]}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={colors.neutral.charcoal} />
          </TouchableOpacity>
        </View>

        {/* Content preview */}
        <View style={[styles.preview, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
          <Text style={styles.previewEmoji}>{typeEmoji[contentType]}</Text>
          <Text style={[styles.previewTitle, { color: colors.neutral.charcoal }, textFont.semibold]} numberOfLines={2}>
            {contentTitle}
          </Text>
        </View>

        {/* Optional message */}
        <TextInput
          style={[
            styles.messageInput,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: colors.neutral.charcoal,
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            },
            textFont.regular,
          ]}
          placeholder="Add a message (optional)..."
          placeholderTextColor={colors.neutral.gray}
          value={message}
          onChangeText={setMessage}
          maxLength={500}
        />

        {/* Not authenticated */}
        {!isAuthenticated ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
              Sign in to share with friends
            </Text>
          </View>
        ) : friendsLoading ? (
          <ActivityIndicator color={colors.primary.main} style={{ marginTop: spacing.xl }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
              No friends yet. Add friends in the Messages tab to share content!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderFriend}
            contentContainerStyle={styles.friendsList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: 300,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  previewEmoji: {
    fontSize: 24,
  },
  previewTitle: {
    fontSize: typography.fontSize.base,
    flex: 1,
  },
  messageInput: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    fontSize: typography.fontSize.base,
  },
  friendsList: {
    paddingBottom: spacing['3xl'],
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.md,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: typography.fontSize.base,
  },
  friendSub: {
    fontSize: typography.fontSize.xs,
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing['3xl'],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default ShareToFriendModal;
