/**
 * FoodXchange Global State Store
 * Using Zustand for lightweight state management
 */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { User, ShoppingList, Product, OFFProduct } from '../services/api';

// Platform-aware storage for web and native
const createStorage = (): StateStorage => {
  if (Platform.OS === 'web') {
    return {
      getItem: (name: string) => {
        try {
          const value = localStorage.getItem(name);
          return value ?? null;
        } catch {
          return null;
        }
      },
      setItem: (name: string, value: string) => {
        try {
          localStorage.setItem(name, value);
        } catch {
          // Ignore storage errors
        }
      },
      removeItem: (name: string) => {
        try {
          localStorage.removeItem(name);
        } catch {
          // Ignore storage errors
        }
      },
    };
  }
  // For native, we'd use AsyncStorage but for now use memory
  // This is a simple in-memory fallback
  const storage = new Map<string, string>();
  return {
    getItem: (name: string) => storage.get(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.delete(name),
  };
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  logout: () => void;
}

interface ShoppingState {
  lists: ShoppingList[];
  activeListId: number | null;
  setLists: (lists: ShoppingList[]) => void;
  setActiveList: (id: number | null) => void;
  addList: (list: ShoppingList) => void;
  updateList: (id: number, updates: Partial<ShoppingList>) => void;
  removeList: (id: number) => void;
}

interface SearchState {
  recentSearches: RecentProduct[];
  searchResults: Product[];
  isSearching: boolean;
  addRecentSearch: (product: RecentProduct) => void;
  setSearchResults: (results: Product[]) => void;
  setSearching: (value: boolean) => void;
  clearRecentSearches: () => void;
}

// Cart item with quantity
export interface CartItem {
  product: OFFProduct;
  quantity: number;
  addedAt: number;  // timestamp
}

interface CartState {
  items: CartItem[];
  addItem: (product: OFFProduct, quantity?: number) => void;
  removeItem: (productCode: string) => void;
  updateQuantity: (productCode: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotalItems: () => number;
  isInCart: (productCode: string) => boolean;
}

type RecentProduct = {
  id: number;
  name: string;
};

// Auth Store
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// Shopping Store
export const useShoppingStore = create<ShoppingState>((set) => ({
  lists: [],
  activeListId: null,
  setLists: (lists) => set({ lists }),
  setActiveList: (activeListId) => set({ activeListId }),
  addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
  updateList: (id, updates) =>
    set((state) => ({
      lists: state.lists.map((list) =>
        list.id === id ? { ...list, ...updates } : list
      ),
    })),
  removeList: (id) =>
    set((state) => ({
      lists: state.lists.filter((list) => list.id !== id),
      activeListId: state.activeListId === id ? null : state.activeListId,
    })),
}));

// ============================
// Search Store (FIXED)
// ============================


export const useSearchStore = create<SearchState>((set) => ({
  recentSearches: [],
  searchResults: [],
  isSearching: false,

  addRecentSearch: (product) =>
    set((state) => {
      // Remove duplicates by product id
      const filtered = state.recentSearches.filter(
        (p) => p.id !== product.id
      );

      return {
        recentSearches: [...filtered, product].slice(-10),
      };
    }),

  setSearchResults: (searchResults) => set({ searchResults }),

  setSearching: (isSearching) => set({ isSearching }),

  clearRecentSearches: () => set({ recentSearches: [] }),
}));

