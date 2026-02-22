import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { User, ShoppingList, Product, OFFProduct } from '../services/api';
import { CombinedProduct } from '@/services/api';

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
        } catch {}
      },
      removeItem: (name: string) => {
        try {
          localStorage.removeItem(name);
        } catch {}
      },
    };
  }
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
  initAuth: () => Promise<void>;
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

export interface CartItem {
  product: OFFProduct;
  quantity: number;
  addedAt: number;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    try {
      const { api } = await import('../services/api');
      await api.auth.logout();
    } catch {}
    set({ user: null, isAuthenticated: false });
  },
  initAuth: async () => {
    set({ isLoading: true });
    try {
      const { api } = await import('../services/api');
      const isAuth = await api.auth.isAuthenticated();
      if (isAuth) {
        const user = await api.users.getCurrentUser();
        set({ user, isAuthenticated: true });
      }
    } catch {
      try {
        const { api } = await import('../services/api');
        await api.auth.logout();
      } catch {}
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

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

const normalizeCode = (c: any) => String(c ?? '');

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) =>
        set((state) => {
          const normalizedProduct = {
            ...(product as any),
            code: normalizeCode((product as any).code),
          } as any;

          const existingIndex = state.items.findIndex(
            (item) => normalizeCode((item.product as any).code) === normalizedProduct.code
          );

          if (existingIndex >= 0) {
            const newItems = state.items.map((it, idx) =>
              idx === existingIndex ? { ...it, quantity: it.quantity + quantity } : it
            );
            return { items: newItems };
          }

          return {
            items: [...state.items, { product: normalizedProduct, quantity, addedAt: Date.now() }],
          };
        }),

      removeItem: (productCode) =>
        set((state) => ({
          items: state.items.filter(
            (item) => normalizeCode((item.product as any).code) !== normalizeCode(productCode)
          ),
        })),

      updateQuantity: (productCode, quantity) =>
        set((state) => {
          const code = normalizeCode(productCode);

          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => normalizeCode((item.product as any).code) !== code),
            };
          }

          return {
            items: state.items.map((item) =>
              normalizeCode((item.product as any).code) === code ? { ...item, quantity } : item
            ),
          };
        }),

      clearCart: () => set({ items: [] }),

      getItemCount: () => get().items.length,

      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

      isInCart: (productCode) =>
        get().items.some(
          (item) => normalizeCode((item.product as any).code) === normalizeCode(productCode)
        ),
    }),
    {
      name: 'foodxchange-cart',
      storage: createJSONStorage(() => createStorage()),
    }
  )
);

export interface MyListItem {
  id: number;
  barcode: string;
  name: string;
  quantity: number;
  created_at?: string;

  cheapest_price?: string | null;
  cheapest_retailer?: string | null;

  productData?: CombinedProduct;
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
              include_nutrition: true,
            })
          );

          if (!res?.products?.length) return item;

          const cleanBarcode = item.barcode.replace(/^0+/, '');

          const matches = res.products.filter((p: any) =>
            p.barcode?.replace(/^0+/, '') === cleanBarcode
          );

          if (!matches.length) return item;

          const allRetailers = matches.flatMap((product: any) =>
            product.prices ?? []
          );

          if (!allRetailers.length) return item;

          const uniqueRetailers = allRetailers.filter(
            (value: any, index: number, self: any[]) =>
              index === self.findIndex((t) => t.grocer_id === value.grocer_id)
          );

          let cheapestRetailer = uniqueRetailers[0];

          for (const retailer of uniqueRetailers) {
            if (
              retailer.price &&
              parseFloat(retailer.price) <
                parseFloat(cheapestRetailer.price)
            ) {
              cheapestRetailer = retailer;
            }
          }

          const baseProduct = matches[0];

          const mergedProduct = {
            ...baseProduct,
            prices: uniqueRetailers,
            retailer_count: uniqueRetailers.length,
            cheapest_price: cheapestRetailer.price,
            cheapest_retailer: cheapestRetailer.grocer_id,
          };

          return {
            ...item,
            cheapest_price: cheapestRetailer.price,
            cheapest_retailer: cheapestRetailer.grocer_id,
            productData: mergedProduct,
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

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setDark: (isDark) => set({ isDark }),
    }),
    {
      name: 'foodxchange-theme',
      storage: createJSONStorage(() => createStorage()),
    }
  )
);
