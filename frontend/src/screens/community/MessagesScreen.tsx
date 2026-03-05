/**
 * MessagesScreen — Conversations list, friend requests, and user search.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import { useAuthStore } from '@/store';
import { useMessagingStore } from '@/store/useMessagingStore';
import type { Conversation, Friend, FriendRequest, UserSearchResult, DirectMessage } from '@/types/community';
import { ChatScreen } from './ChatScreen';

type Section = 'chats' | 'friends' | 'requests' | 'shared';

export const MessagesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const {
    conversations, conversationsLoading, loadConversations,
    friends, friendsLoading, loadFriends,
    friendRequests, loadFriendRequests,
    sentRequests, loadSentRequests,
    searchResults, searchLoading, searchUsers, clearSearchResults,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
    removeFriend, startConversation,
    sharedListMessages, sharedListsLoading, loadSharedLists,
  } = useMessagingStore();

  const [section, setSection] = useState<Section>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);

  const handleSectionChange = useCallback((next: Section) => {
    setSection(next);
    if (next === 'friends') loadFriends();
    else if (next === 'requests') { loadFriendRequests(); loadSentRequests(); }
    else if (next === 'chats') loadConversations();
    else if (next === 'shared') loadSharedLists();
  }, [loadFriends, loadFriendRequests, loadSentRequests, loadConversations, loadSharedLists]);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadFriends();
      loadFriendRequests();
      loadSentRequests();
    }
  }, [isAuthenticated]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.trim().length >= 2) {
      searchUsers(text.trim());
    } else {
      clearSearchResults();
    }
  }, [searchUsers, clearSearchResults]);

  const handleSendRequest = useCallback(async (user: UserSearchResult) => {
    try {
      await sendFriendRequest(user.id);
      Alert.alert('Sent', `Friend request sent to ${user.first_name || user.username}`);
    } catch {
      Alert.alert('Error', 'Could not send friend request. May already be pending.');
    }
  }, [sendFriendRequest]);

  const handleAccept = useCallback(async (req: FriendRequest) => {
    try {
      await acceptFriendRequest(req.id);
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    }
  }, [acceptFriendRequest]);

  const handleReject = useCallback(async (req: FriendRequest) => {
    try {
      await rejectFriendRequest(req.id);
    } catch {
      Alert.alert('Error', 'Could not reject request.');
    }
  }, [rejectFriendRequest]);

  const handleStartChat = useCallback(async (friend: Friend) => {
    try {
      const conv = await startConversation(friend.id);
      setActiveChat(conv);
    } catch {
      Alert.alert('Error', 'Could not start conversation. You must be friends first.');
    }
  }, [startConversation]);

  const handleRemoveFriend = useCallback(async (friend: Friend) => {
    Alert.alert('Remove Friend', `Remove ${friend.first_name || friend.username} from friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try { await removeFriend(friend.id); } catch { Alert.alert('Error', 'Could not remove friend.'); }
        },
      },
    ]);
  }, [removeFriend]);

  // ── If not logged in ──
  if (!isAuthenticated) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface.background }]}>
        <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
          Sign in to use Messages
        </Text>
      </View>
    );
  }

  // ── Active chat view ──
  if (activeChat) {
    return <ChatScreen conversation={activeChat} onBack={() => { setActiveChat(null); loadConversations(); }} />;
  }

  const overlayBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';
  const inputBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';
  const pillBg = isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.70)';

  const sentIds = new Set(sentRequests.map((r) => r.to_user));
  const friendIds = new Set(friends.map((f) => f.id));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface.background }]}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: inputBg,
              color: colors.neutral.charcoal,
              borderColor: colors.surface.glassBorder,
            },
            textFont.regular,
          ]}
          placeholder="Search users by username..."
          placeholderTextColor={colors.neutral.gray}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
      </View>

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <View style={[styles.searchResults, { backgroundColor: overlayBg, borderColor: colors.surface.glassBorder }]}>
          {searchLoading ? (
            <ActivityIndicator color={colors.primary.main} style={{ padding: spacing.md }} />
          ) : searchResults.length === 0 ? (
            <Text style={[styles.emptySmall, { color: colors.neutral.gray }, textFont.regular]}>No users found</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 200 }}
              renderItem={({ item }) => (
                <View style={[styles.searchItem, { borderColor: colors.surface.glassBorder }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.username, { color: colors.neutral.charcoal }, textFont.semibold]}>
                      {item.username}
                    </Text>
                    {(item.first_name || item.last_name) && (
                      <Text style={[styles.fullName, { color: colors.neutral.gray }, textFont.regular]}>
                        {[item.first_name, item.last_name].filter(Boolean).join(' ')}
                      </Text>
                    )}
                  </View>
                  {friendIds.has(item.id) ? (
                    <Text style={[styles.badge, { color: colors.primary.main }, textFont.medium]}>Friends</Text>
                  ) : sentIds.has(item.id) ? (
                    <Text style={[styles.badge, { color: colors.neutral.gray }, textFont.medium]}>Pending</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary.main }]}
                      onPress={() => handleSendRequest(item)}
                    >
                      <Text style={[styles.actionBtnText, textFont.semibold]}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* Section pills */}
      <View style={styles.pillRow}>
        <View style={[
          styles.pillContainer,
          {
            backgroundColor: pillBg,
            borderColor: colors.surface.glassBorder,
          },
        ]}>
          {(['chats', 'friends', 'requests', 'shared'] as Section[]).map((s) => {
            const active = section === s;
            const label = s === 'chats' ? 'Chats' : s === 'friends' ? 'Friends' : s === 'requests' ? 'Requests' : 'Shared Lists';
            const count = s === 'requests' ? friendRequests.length : 0;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => handleSectionChange(s)}
                style={[
                  styles.pill,
                  active && {
                    backgroundColor: colors.primary.main,
                    shadowColor: colors.primary.glow,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                    elevation: 3,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.pillText,
                  { color: active ? '#FFFFFF' : colors.neutral.gray },
                  active ? textFont.semibold : textFont.medium,
                ]}>
                  {label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {section === 'chats' && (
          conversationsLoading ? (
            <ActivityIndicator color={colors.primary.main} style={{ marginTop: spacing.xl }} />
          ) : conversations.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyIcon]}>💬</Text>
              <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
                No conversations yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.neutral.gray }, textFont.regular]}>
                Add friends and start chatting!
              </Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.convRow, { borderColor: colors.surface.glassBorder }]}
                  onPress={() => setActiveChat(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary.light }]}>
                    <Text style={styles.avatarText}>
                      {(item.other_user.first_name || item.other_user.username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <View style={styles.convHeader}>
                      <Text style={[styles.convName, { color: colors.neutral.charcoal }, textFont.semibold]}>
                        {item.other_user.first_name || item.other_user.username}
                      </Text>
                      {item.last_message && (
                        <Text style={[styles.convTime, { color: colors.neutral.gray }, textFont.regular]}>
                          {formatTime(item.last_message.created_at)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.convFooter}>
                      <Text
                        style={[styles.convPreview, { color: colors.neutral.darkGray }, textFont.regular]}
                        numberOfLines={1}
                      >
                        {item.last_message?.text ?? 'No messages yet'}
                      </Text>
                      {item.unread_count > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.primary.main }]}>
                          <Text style={[styles.unreadText, textFont.bold]}>{item.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )
        )}

        {section === 'friends' && (
          friendsLoading ? (
            <ActivityIndicator color={colors.primary.main} style={{ marginTop: spacing.xl }} />
          ) : friends.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyIcon]}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
                No friends yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.neutral.gray }, textFont.regular]}>
                Search for users above to add friends
              </Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={[styles.friendRow, { borderColor: colors.surface.glassBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent.cyan }]}>
                    <Text style={styles.avatarText}>
                      {(item.first_name || item.username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[styles.username, { color: colors.neutral.charcoal }, textFont.semibold]}>
                      {item.first_name || item.username}
                    </Text>
                    {item.last_name && (
                      <Text style={[styles.fullName, { color: colors.neutral.gray }, textFont.regular]}>
                        {item.last_name}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary.main }]}
                    onPress={() => handleStartChat(item)}
                  >
                    <Text style={[styles.actionBtnText, textFont.semibold]}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.semantic.error, marginLeft: spacing.xs }]}
                    onPress={() => handleRemoveFriend(item)}
                  >
                    <Text style={[styles.actionBtnText, textFont.semibold]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )
        )}

        {section === 'requests' && (
          friendRequests.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyIcon]}>📩</Text>
              <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
                No pending requests
              </Text>
            </View>
          ) : (
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <View style={[styles.friendRow, { borderColor: colors.surface.glassBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent.orange }]}>
                    <Text style={styles.avatarText}>
                      {(item.from_first_name || item.from_username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[styles.username, { color: colors.neutral.charcoal }, textFont.semibold]}>
                      {item.from_first_name || item.from_username}
                    </Text>
                    <Text style={[styles.fullName, { color: colors.neutral.gray }, textFont.regular]}>
                      wants to be friends
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary.main }]}
                    onPress={() => handleAccept(item)}
                  >
                    <Text style={[styles.actionBtnText, textFont.semibold]}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.neutral.gray, marginLeft: spacing.xs }]}
                    onPress={() => handleReject(item)}
                  >
                    <Text style={[styles.actionBtnText, textFont.semibold]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )
        )}

        {section === 'shared' && (
          sharedListsLoading ? (
            <ActivityIndicator color={colors.primary.main} style={{ marginTop: spacing.xl }} />
          ) : sharedListMessages.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.emptyIcon]}>🛒</Text>
              <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.medium]}>
                No shared lists yet
              </Text>
              <Text style={[styles.emptyHint, { color: colors.neutral.gray }, textFont.regular]}>
                Share a list from inside a chat
              </Text>
            </View>
          ) : (
            <FlatList
              data={sharedListMessages}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }: { item: DirectMessage }) => {
                const listData = item.shared_list_data!;
                return (
                  <View style={[styles.sharedListRow, { borderColor: colors.surface.glassBorder }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary.main + '25' }]}>
                      <Text style={{ fontSize: 20 }}>🛒</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[styles.username, { color: colors.neutral.charcoal }, textFont.semibold]}>
                        {listData.name}
                      </Text>
                      <Text style={[styles.fullName, { color: colors.neutral.gray }, textFont.regular]}>
                        {listData.item_count} item{listData.item_count !== 1 ? 's' : ''} · from {item.sender_username}
                      </Text>
                      {listData.items.slice(0, 2).map((li, idx) => (
                        <Text key={idx} style={[styles.sharedListItem, { color: colors.neutral.darkGray }, textFont.regular]} numberOfLines={1}>
                          · {li.name}{li.quantity > 1 ? ` ×${li.quantity}` : ''}
                        </Text>
                      ))}
                      {listData.items.length > 2 && (
                        <Text style={[styles.sharedListItem, { color: colors.neutral.gray }, textFont.regular]}>
                          +{listData.items.length - 2} more
                        </Text>
                      )}
                    </View>
                    <Text style={[{ color: colors.neutral.gray }, textFont.regular, { fontSize: typography.fontSize.xs }]}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                );
              }}
            />
          )
        )}
      </View>
    </View>
  );
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },

  searchRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.base,
  },
  searchResults: {
    marginHorizontal: spacing.xl,
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5,
  },
  emptySmall: { padding: spacing.md, textAlign: 'center', fontSize: typography.fontSize.sm },

  pillRow: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  pillContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    borderWidth: glass.borderWidth,
    padding: 3,
    alignSelf: 'flex-start',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  pillText: { fontSize: typography.fontSize.sm, letterSpacing: 0.2 },

  content: { flex: 1 },

  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: typography.fontSize.base },
  convTime: { fontSize: typography.fontSize.xs },
  convFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  convPreview: { fontSize: typography.fontSize.sm, flex: 1 },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: typography.fontSize.lg, color: '#FFFFFF', fontWeight: '700' },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.xs,
  },
  unreadText: { color: '#FFFFFF', fontSize: typography.fontSize.xs },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  username: { fontSize: typography.fontSize.base },
  fullName: { fontSize: typography.fontSize.sm, marginTop: 1 },
  badge: { fontSize: typography.fontSize.sm },

  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: typography.fontSize.sm },

  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: typography.fontSize.md, textAlign: 'center' },
  emptyHint: { fontSize: typography.fontSize.sm, textAlign: 'center', marginTop: spacing.xs },

  sharedListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
  },
  sharedListItem: { fontSize: typography.fontSize.sm, marginTop: 1 },
});

export default MessagesScreen;
