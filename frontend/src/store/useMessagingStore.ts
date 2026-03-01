import { create } from 'zustand';
import { api } from '../services/api';
import type {
  UserSearchResult,
  FriendRequest,
  Friend,
  Conversation,
  DirectMessage,
  SharedContentType,
} from '../types/community';

interface MessagingState {
  // Friends
  friends: Friend[];
  friendRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  friendsLoading: boolean;

  // Conversations
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: DirectMessage[];
  conversationsLoading: boolean;
  messagesLoading: boolean;

  // User search
  searchResults: UserSearchResult[];
  searchLoading: boolean;

  // Actions — Friends
  loadFriends: () => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  loadSentRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (userId: number) => Promise<void>;
  acceptFriendRequest: (requestId: number) => Promise<void>;
  rejectFriendRequest: (requestId: number) => Promise<void>;
  removeFriend: (userId: number) => Promise<void>;
  clearSearchResults: () => void;

  // Actions — Conversations
  loadConversations: () => Promise<void>;
  startConversation: (userId: number) => Promise<Conversation>;
  setActiveConversation: (conv: Conversation | null) => void;
  loadMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, text: string) => Promise<void>;
  shareContent: (
    friendId: number,
    contentType: SharedContentType,
    contentId: number,
    text?: string,
  ) => Promise<void>;
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  friends: [],
  friendRequests: [],
  sentRequests: [],
  friendsLoading: false,

  conversations: [],
  activeConversation: null,
  messages: [],
  conversationsLoading: false,
  messagesLoading: false,

  searchResults: [],
  searchLoading: false,

  // ── Friends ──

  loadFriends: async () => {
    set({ friendsLoading: true });
    try {
      const friends = await api.community.listFriends();
      set({ friends });
    } catch (e) {
      console.warn('Failed to load friends:', e);
    } finally {
      set({ friendsLoading: false });
    }
  },

  loadFriendRequests: async () => {
    try {
      const friendRequests = await api.community.listFriendRequests();
      set({ friendRequests });
    } catch (e) {
      console.warn('Failed to load friend requests:', e);
    }
  },

  loadSentRequests: async () => {
    try {
      const sentRequests = await api.community.listSentFriendRequests();
      set({ sentRequests });
    } catch (e) {
      console.warn('Failed to load sent requests:', e);
    }
  },

  searchUsers: async (query: string) => {
    if (query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    set({ searchLoading: true });
    try {
      const searchResults = await api.community.searchUsers(query);
      set({ searchResults });
    } catch (e) {
      console.warn('Failed to search users:', e);
    } finally {
      set({ searchLoading: false });
    }
  },

  sendFriendRequest: async (userId: number) => {
    try {
      await api.community.sendFriendRequest(userId);
      await get().loadSentRequests();
    } catch (e) {
      console.warn('Failed to send friend request:', e);
      throw e;
    }
  },

  acceptFriendRequest: async (requestId: number) => {
    try {
      await api.community.acceptFriendRequest(requestId);
      await Promise.all([get().loadFriendRequests(), get().loadFriends()]);
    } catch (e) {
      console.warn('Failed to accept friend request:', e);
      throw e;
    }
  },

  rejectFriendRequest: async (requestId: number) => {
    try {
      await api.community.rejectFriendRequest(requestId);
      await get().loadFriendRequests();
    } catch (e) {
      console.warn('Failed to reject friend request:', e);
      throw e;
    }
  },

  removeFriend: async (userId: number) => {
    try {
      await api.community.removeFriend(userId);
      set({ friends: get().friends.filter((f) => f.id !== userId) });
    } catch (e) {
      console.warn('Failed to remove friend:', e);
      throw e;
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),

  // ── Conversations ──

  loadConversations: async () => {
    set({ conversationsLoading: true });
    try {
      const conversations = await api.community.listConversations();
      set({ conversations });
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    } finally {
      set({ conversationsLoading: false });
    }
  },

  startConversation: async (userId: number) => {
    const conv = await api.community.startConversation(userId);
    await get().loadConversations();
    return conv;
  },

  setActiveConversation: (conv) => set({ activeConversation: conv }),

  loadMessages: async (conversationId: number) => {
    set({ messagesLoading: true });
    try {
      const messages = await api.community.getMessages(conversationId);
      set({ messages });
    } catch (e) {
      console.warn('Failed to load messages:', e);
    } finally {
      set({ messagesLoading: false });
    }
  },

  sendMessage: async (conversationId: number, text: string) => {
    try {
      const msg = await api.community.sendMessage(conversationId, text);
      set({ messages: [...get().messages, msg] });
      // Refresh conversations list to update last_message / ordering
      get().loadConversations();
    } catch (e) {
      console.warn('Failed to send message:', e);
      throw e;
    }
  },

  shareContent: async (friendId, contentType, contentId, text) => {
    try {
      const conv = await api.community.startConversation(friendId);
      await api.community.sendMessage(conv.id, text || '', {
        shared_content_type: contentType,
        shared_content_id: contentId,
      });
      // Refresh conversations list
      get().loadConversations();
    } catch (e) {
      console.warn('Failed to share content:', e);
      throw e;
    }
  },
}));
