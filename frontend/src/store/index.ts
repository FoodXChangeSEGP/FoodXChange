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
  recentSearches: string[];
  searchResults: Product[];
  isSearching: boolean;
  addRecentSearch: (query: string) => void;
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

// Search Store
export const useSearchStore = create<SearchState>((set) => ({
  recentSearches: [],
  searchResults: [],
  isSearching: false,
  addRecentSearch: (query) =>
    set((state) => ({
      recentSearches: [
        query,
        ...state.recentSearches.filter((s) => s !== query),
      ].slice(0, 10),
    })),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching: (isSearching) => set({ isSearching }),
  clearRecentSearches: () => set({ recentSearches: [] }),
}));

const normCode = (c: any) => String(c ?? '');

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) =>
        set((state) => {
          // Normalize to ensure code is always a string
          const normalizedProduct = {
            ...(product as any),
            code: normCode((product as any).code),
          } as any;

          const existingIndex = state.items.findIndex(
            (item) => normCode((item.product as any).code) === normalizedProduct.code
          );

          if (existingIndex >= 0) {
            // Update quantity if already in cart
            const newItems = state.items.map((it, idx) =>
              idx === existingIndex ? { ...it, quantity: it.quantity + quantity } : it
            );
            return { items: newItems };
          }

          // Add new item
          return {
            items: [...state.items, { product: normalizedProduct, quantity, addedAt: Date.now() }],
          };
        }),

      removeItem: (productCode) =>
        set((state) => ({
          items: state.items.filter(
            (item) => normCode((item.product as any).code) !== normCode(productCode)
          ),
        })),

      updateQuantity: (productCode, quantity) =>
        set((state) => {
          const code = normCode(productCode);

          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => normCode((item.product as any).code) !== code),
            };
          }

          return {
            items: state.items.map((item) =>
              normCode((item.product as any).code) === code ? { ...item, quantity } : item
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      getItemCount: () => get().items.length,

      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

      isInCart: (productCode) =>
        get().items.some(
          (item) => normCode((item.product as any).code) === normCode(productCode)
        ),
    }),
    {
      name: 'foodxchange-cart',
      storage: createJSONStorage(() => createStorage()),
    }
  )
);
