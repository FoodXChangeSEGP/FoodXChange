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

// Cart Store with persistence
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (product, quantity = 1) =>
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.product.code === product.code
          );
          
          if (existingIndex >= 0) {
            // Update quantity if already in cart
            const newItems = [...state.items];
            newItems[existingIndex].quantity += quantity;
            return { items: newItems };
          }
          
          // Add new item
          return {
            items: [
              ...state.items,
              { product, quantity, addedAt: Date.now() },
            ],
          };
        }),
      
      removeItem: (productCode) =>
        set((state) => ({
          items: state.items.filter((item) => item.product.code !== productCode),
        })),
      
      updateQuantity: (productCode, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.product.code !== productCode),
            };
          }
          
          return {
            items: state.items.map((item) =>
              item.product.code === productCode
                ? { ...item, quantity }
                : item
            ),
          };
        }),
      
      clearCart: () => set({ items: [] }),
      
      getItemCount: () => get().items.length,
      
      getTotalItems: () =>
        get().items.reduce((total, item) => total + item.quantity, 0),
      
      isInCart: (productCode) =>
        get().items.some((item) => item.product.code === productCode),
    }),
    {
      name: 'foodxchange-cart',
      storage: createJSONStorage(() => createStorage()),
    }
  )
);

// ==============================================
// MyList Store (persistent + backend synced)
// ==============================================

export interface MyListItem {
  id: number;
  barcode: string;
  name: string;
  quantity: number;
  created_at?: string;

  cheapest_price?: string | null;
  cheapest_retailer?: string | null;
}

interface MyListState {
  items: MyListItem[];
  loading: boolean;
  fetchMyList: () => Promise<void>;
  addItem: (barcode: string, name: string, quantity?: number) => Promise<void>;
  removeItem: (barcode: string) => Promise<void>;
  isSaved: (barcode: string) => boolean;
  fetchPrices: () => Promise<void>;
}

export const useMyListStore = create<MyListState>((set, get) => ({
  items: [],
  loading: false,

  fetchMyList: async () => {
    set({ loading: true });
    try {
      const res: any = await import('../services/api').then(m => m.api.mylist.get());
      const data = Array.isArray(res) ? res : res?.results ?? [];

      set({ items: data });

      
      await get().fetchPrices();

    } catch (error) {
      console.error('Failed to fetch MyList', error);
    } finally {
      set({ loading: false });
    }
  },


  addItem: async (barcode, name, quantity = 1) => {
    if (get().items.some(i => i.barcode === barcode)) return;

    try {
      await import('../services/api').then(m =>
        m.api.mylist.add(barcode, name, quantity)
      );

      // Re-fetch to sync real ID
      await get().fetchMyList();
    } catch (error) {
      console.error('Failed to add to MyList', error);
    }
  },

  removeItem: async (barcode) => {
    const item = get().items.find(i => i.barcode === barcode);
    if (!item) return;

    try {
      await import('../services/api').then(m =>
        m.api.mylist.remove(item.id)
      );

      set({
        items: get().items.filter(i => i.barcode !== barcode),
      });
    } catch (error) {
      console.error('Failed to remove from MyList', error);
    }
  },


  isSaved: (barcode) =>
    get().items.some(item => item.barcode === barcode),

  fetchPrices: async () => {
    const items = get().items;

    const updatedItems = await Promise.all(
      items.map(async (item) => {
        try {
          const res = await import('../services/api').then(m =>
            m.api.grocers.search(item.name, {
              page_size: 10,
              include_nutrition: false,
            })
          );

          if (!res?.products?.length) return item;

          const cleanBarcode = item.barcode.replace(/^0+/, '');

          // Match all products with same barcode
          const matches = res.products.filter((p: any) =>
            p.barcode?.replace(/^0+/, '') === cleanBarcode
          );

          if (!matches.length) return item;

          // 🔥 Now compute real cheapest across matches
          let cheapest = matches[0];

          for (const product of matches) {
            if (
              product.cheapest_price &&
              parseFloat(product.cheapest_price) <
                parseFloat(cheapest.cheapest_price)
            ) {
              cheapest = product;
            }
          }

          return {
            ...item,
            cheapest_price: cheapest.cheapest_price,
            cheapest_retailer: cheapest.cheapest_retailer,
          };
        } catch (error) {
          console.error('Price fetch failed for', item.barcode);
          return item;
        }
      })
    );

    set({ items: updatedItems });
  },


}));
