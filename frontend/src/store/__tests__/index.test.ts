import { useAuthStore, useShoppingStore, useSearchStore } from '../index';
import type { User, ShoppingList, Product } from '../../services/api';

const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
};

const mockShoppingList: ShoppingList = {
  id: 1,
  name: 'Weekly Shop',
  description: 'Groceries',
  is_active: true,
  total_items: 2,
  total_quantity: 5,
  items: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Helper for new recent search format
const recentProduct = (id: number, name: string) => ({
  id,
  name,
});

// Reset stores between tests
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useShoppingStore.setState({
    lists: [],
    activeListId: null,
  });

  useSearchStore.setState({
    recentSearches: [],
    searchResults: [],
    isSearching: false,
  });
});

describe('useAuthStore', () => {
  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(true);
  });

  it('setUser sets user and isAuthenticated', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setUser with null sets isAuthenticated to false', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setUser(null);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuthenticated updates isAuthenticated', () => {
    useAuthStore.getState().setAuthenticated(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setLoading updates isLoading', () => {
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('logout clears user and isAuthenticated', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});

describe('useShoppingStore', () => {
  it('has correct initial state', () => {
    const state = useShoppingStore.getState();
    expect(state.lists).toEqual([]);
    expect(state.activeListId).toBeNull();
  });

  it('setLists replaces all lists', () => {
    useShoppingStore.getState().setLists([mockShoppingList]);
    expect(useShoppingStore.getState().lists).toHaveLength(1);
    expect(useShoppingStore.getState().lists[0].name).toBe('Weekly Shop');
  });

  it('addList appends a list', () => {
    useShoppingStore.getState().addList(mockShoppingList);
    const secondList = { ...mockShoppingList, id: 2, name: 'Party' };
    useShoppingStore.getState().addList(secondList);
    expect(useShoppingStore.getState().lists).toHaveLength(2);
  });

  it('updateList updates matching list', () => {
    useShoppingStore.getState().setLists([mockShoppingList]);
    useShoppingStore.getState().updateList(1, { name: 'Updated' });
    expect(useShoppingStore.getState().lists[0].name).toBe('Updated');
  });

  it('updateList does not affect non-matching lists', () => {
    const list2 = { ...mockShoppingList, id: 2, name: 'Other' };
    useShoppingStore.getState().setLists([mockShoppingList, list2]);
    useShoppingStore.getState().updateList(1, { name: 'Updated' });
    expect(useShoppingStore.getState().lists[1].name).toBe('Other');
  });

  it('removeList removes the list', () => {
    useShoppingStore.getState().setLists([mockShoppingList]);
    useShoppingStore.getState().removeList(1);
    expect(useShoppingStore.getState().lists).toHaveLength(0);
  });

  it('removeList clears activeListId if it matches', () => {
    useShoppingStore.getState().setLists([mockShoppingList]);
    useShoppingStore.getState().setActiveList(1);
    useShoppingStore.getState().removeList(1);
    expect(useShoppingStore.getState().activeListId).toBeNull();
  });

  it('removeList preserves activeListId if different', () => {
    const list2 = { ...mockShoppingList, id: 2, name: 'Other' };
    useShoppingStore.getState().setLists([mockShoppingList, list2]);
    useShoppingStore.getState().setActiveList(2);
    useShoppingStore.getState().removeList(1);
    expect(useShoppingStore.getState().activeListId).toBe(2);
  });

  it('setActiveList sets the active list id', () => {
    useShoppingStore.getState().setActiveList(5);
    expect(useShoppingStore.getState().activeListId).toBe(5);
  });
});

describe('useSearchStore (new product-based recent searches)', () => {
  it('has correct initial state', () => {
    const state = useSearchStore.getState();
    expect(state.recentSearches).toEqual([]);
    expect(state.searchResults).toEqual([]);
    expect(state.isSearching).toBe(false);
  });

  it('addRecentSearch appends products', () => {
    useSearchStore.getState().addRecentSearch(recentProduct(1, 'milk'));
    useSearchStore.getState().addRecentSearch(recentProduct(2, 'bread'));

    const searches = useSearchStore.getState().recentSearches;

    expect(searches).toEqual([
      { id: 1, name: 'milk' },
      { id: 2, name: 'bread' },
    ]);
  });

  it('addRecentSearch deduplicates by id and moves to end', () => {
    useSearchStore.getState().addRecentSearch(recentProduct(1, 'milk'));
    useSearchStore.getState().addRecentSearch(recentProduct(2, 'bread'));
    useSearchStore.getState().addRecentSearch(recentProduct(1, 'milk'));

    const searches = useSearchStore.getState().recentSearches;

    expect(searches).toEqual([
      { id: 2, name: 'bread' },
      { id: 1, name: 'milk' },
    ]);
  });

  it('addRecentSearch keeps only last 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      useSearchStore
        .getState()
        .addRecentSearch(recentProduct(i, `search-${i}`));
    }

    const searches = useSearchStore.getState().recentSearches;

    expect(searches).toHaveLength(10);

    // should keep 5 -> 14
    expect(searches[0]).toEqual({ id: 5, name: 'search-5' });
    expect(searches[9]).toEqual({ id: 14, name: 'search-14' });
  });

  it('setSearchResults replaces results', () => {
    const mockProducts = [
      { id: 1, name: 'Milk' },
      { id: 2, name: 'Bread' },
    ] as Product[];

    useSearchStore.getState().setSearchResults(mockProducts);

    expect(useSearchStore.getState().searchResults).toEqual(mockProducts);
  });

  it('setSearching updates flag', () => {
    useSearchStore.getState().setSearching(true);
    expect(useSearchStore.getState().isSearching).toBe(true);
  });

  it('clearRecentSearches empties the list', () => {
    useSearchStore.getState().addRecentSearch(recentProduct(1, 'milk'));
    useSearchStore.getState().clearRecentSearches();

    expect(useSearchStore.getState().recentSearches).toEqual([]);
  });
});
