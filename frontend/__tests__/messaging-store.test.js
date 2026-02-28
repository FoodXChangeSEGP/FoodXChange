/**
 * Tests for the useMessagingStore Zustand store
 */

// Mock the api module before importing the store
jest.mock('@/services/api', () => ({
  api: {
    community: {
      listFriends: jest.fn(),
      listFriendRequests: jest.fn(),
      listSentFriendRequests: jest.fn(),
      searchUsers: jest.fn(),
      sendFriendRequest: jest.fn(),
      acceptFriendRequest: jest.fn(),
      rejectFriendRequest: jest.fn(),
      removeFriend: jest.fn(),
      listConversations: jest.fn(),
      startConversation: jest.fn(),
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
    },
  },
}));

const { api } = require('@/services/api');
const { useMessagingStore } = require('@/store/useMessagingStore');

describe('useMessagingStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useMessagingStore.setState({
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
    });
    jest.clearAllMocks();
  });

  describe('loadFriends', () => {
    it('loads friends and sets state', async () => {
      const mockFriends = [
        { id: 1, username: 'alice', first_name: 'Alice', last_name: '' },
        { id: 2, username: 'bob', first_name: 'Bob', last_name: '' },
      ];
      api.community.listFriends.mockResolvedValue(mockFriends);

      await useMessagingStore.getState().loadFriends();

      expect(api.community.listFriends).toHaveBeenCalledTimes(1);
      expect(useMessagingStore.getState().friends).toEqual(mockFriends);
      expect(useMessagingStore.getState().friendsLoading).toBe(false);
    });

    it('sets loading state correctly', async () => {
      api.community.listFriends.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const promise = useMessagingStore.getState().loadFriends();
      expect(useMessagingStore.getState().friendsLoading).toBe(true);
      await promise;
      expect(useMessagingStore.getState().friendsLoading).toBe(false);
    });

    it('handles errors gracefully', async () => {
      api.community.listFriends.mockRejectedValue(new Error('Network error'));

      await useMessagingStore.getState().loadFriends();

      expect(useMessagingStore.getState().friends).toEqual([]);
      expect(useMessagingStore.getState().friendsLoading).toBe(false);
    });
  });

  describe('loadFriendRequests', () => {
    it('loads incoming requests', async () => {
      const mockRequests = [
        { id: 1, from_user: 2, to_user: 1, from_username: 'bob', to_username: 'alice', status: 'pending' },
      ];
      api.community.listFriendRequests.mockResolvedValue(mockRequests);

      await useMessagingStore.getState().loadFriendRequests();

      expect(useMessagingStore.getState().friendRequests).toEqual(mockRequests);
    });
  });

  describe('searchUsers', () => {
    it('searches users with query >= 2 chars', async () => {
      const results = [{ id: 3, username: 'charlie', first_name: 'Charlie', last_name: '' }];
      api.community.searchUsers.mockResolvedValue(results);

      await useMessagingStore.getState().searchUsers('ch');

      expect(api.community.searchUsers).toHaveBeenCalledWith('ch');
      expect(useMessagingStore.getState().searchResults).toEqual(results);
    });

    it('clears results for short queries', async () => {
      useMessagingStore.setState({ searchResults: [{ id: 1 }] });

      await useMessagingStore.getState().searchUsers('x');

      expect(api.community.searchUsers).not.toHaveBeenCalled();
      expect(useMessagingStore.getState().searchResults).toEqual([]);
    });
  });

  describe('sendFriendRequest', () => {
    it('calls API and refreshes sent requests', async () => {
      api.community.sendFriendRequest.mockResolvedValue({ id: 1 });
      api.community.listSentFriendRequests.mockResolvedValue([]);

      await useMessagingStore.getState().sendFriendRequest(2);

      expect(api.community.sendFriendRequest).toHaveBeenCalledWith(2);
      expect(api.community.listSentFriendRequests).toHaveBeenCalled();
    });
  });

  describe('acceptFriendRequest', () => {
    it('calls API and refreshes both lists', async () => {
      api.community.acceptFriendRequest.mockResolvedValue({ accepted: true });
      api.community.listFriendRequests.mockResolvedValue([]);
      api.community.listFriends.mockResolvedValue([]);

      await useMessagingStore.getState().acceptFriendRequest(1);

      expect(api.community.acceptFriendRequest).toHaveBeenCalledWith(1);
      expect(api.community.listFriendRequests).toHaveBeenCalled();
      expect(api.community.listFriends).toHaveBeenCalled();
    });
  });

  describe('rejectFriendRequest', () => {
    it('calls API and refreshes requests', async () => {
      api.community.rejectFriendRequest.mockResolvedValue({ rejected: true });
      api.community.listFriendRequests.mockResolvedValue([]);

      await useMessagingStore.getState().rejectFriendRequest(1);

      expect(api.community.rejectFriendRequest).toHaveBeenCalledWith(1);
    });
  });

  describe('removeFriend', () => {
    it('removes friend from local state', async () => {
      useMessagingStore.setState({
        friends: [
          { id: 1, username: 'alice', first_name: 'Alice', last_name: '' },
          { id: 2, username: 'bob', first_name: 'Bob', last_name: '' },
        ],
      });
      api.community.removeFriend.mockResolvedValue({ removed: true });

      await useMessagingStore.getState().removeFriend(1);

      expect(useMessagingStore.getState().friends).toEqual([
        { id: 2, username: 'bob', first_name: 'Bob', last_name: '' },
      ]);
    });
  });

  describe('loadConversations', () => {
    it('loads conversations', async () => {
      const mockConvs = [{
        id: 1,
        other_user: { id: 2, username: 'bob' },
        last_message: null,
        unread_count: 0,
      }];
      api.community.listConversations.mockResolvedValue(mockConvs);

      await useMessagingStore.getState().loadConversations();

      expect(useMessagingStore.getState().conversations).toEqual(mockConvs);
      expect(useMessagingStore.getState().conversationsLoading).toBe(false);
    });
  });

  describe('startConversation', () => {
    it('starts conversation and refreshes list', async () => {
      const mockConv = { id: 1, other_user: { id: 2, username: 'bob' } };
      api.community.startConversation.mockResolvedValue(mockConv);
      api.community.listConversations.mockResolvedValue([mockConv]);

      const result = await useMessagingStore.getState().startConversation(2);

      expect(api.community.startConversation).toHaveBeenCalledWith(2);
      expect(result).toEqual(mockConv);
    });
  });

  describe('loadMessages', () => {
    it('loads messages for a conversation', async () => {
      const mockMessages = [
        { id: 1, text: 'Hello', sender: 1, sender_username: 'alice' },
        { id: 2, text: 'Hi!', sender: 2, sender_username: 'bob' },
      ];
      api.community.getMessages.mockResolvedValue(mockMessages);

      await useMessagingStore.getState().loadMessages(1);

      expect(api.community.getMessages).toHaveBeenCalledWith(1);
      expect(useMessagingStore.getState().messages).toEqual(mockMessages);
    });
  });

  describe('sendMessage', () => {
    it('sends message and appends to state', async () => {
      useMessagingStore.setState({ messages: [] });
      const newMsg = { id: 1, text: 'Hey!', sender: 1, sender_username: 'alice' };
      api.community.sendMessage.mockResolvedValue(newMsg);
      api.community.listConversations.mockResolvedValue([]);

      await useMessagingStore.getState().sendMessage(1, 'Hey!');

      expect(api.community.sendMessage).toHaveBeenCalledWith(1, 'Hey!');
      expect(useMessagingStore.getState().messages).toEqual([newMsg]);
    });
  });

  describe('clearSearchResults', () => {
    it('clears search results', () => {
      useMessagingStore.setState({ searchResults: [{ id: 1 }] });

      useMessagingStore.getState().clearSearchResults();

      expect(useMessagingStore.getState().searchResults).toEqual([]);
    });
  });
});
