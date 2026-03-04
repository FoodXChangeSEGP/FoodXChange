import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { User, ShoppingList, Product, OFFProduct, UserList } from '../services/api';
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

export { UserList };

interface MyListState {
  // List management
  lists: UserList[];
  activeListId: number | null;
  listsLoading: boolean;

  // Items in the active list
  items: MyListItem[];
  loading: boolean;

  // List operations
  fetchLists: () => Promise<void>;
  createList: (name: string) => Promise<UserList | null>;
  deleteList: (id: number) => Promise<void>;
  renameList: (id: number, name: string) => Promise<void>;
  setActiveList: (id: number) => Promise<void>;

  // Item operations (scoped to activeListId)
  fetchMyList: () => Promise<void>;
  addItem: (barcode: string, name: string, quantity?: number) => Promise<void>;
  removeItem: (barcode: string) => Promise<void>;
  updateQuantity: (barcode: string, quantity: number) => Promise<void>;
  isSaved: (barcode: string) => boolean;
  fetchPrices: () => Promise<void>;
  duplicateList: (id: number) => Promise<void>;
}

export const useMyListStore = create<MyListState>((set, get) => ({
  lists: [],
  activeListId: null,
  listsLoading: false,
  items: [],
  loading: false,

  // ── List management ──────────────────────────────────────────────────────────

  fetchLists: async () => {
    set({ listsLoading: true });
    try {
      const lists = await import('../services/api').then(m => m.api.lists.getAll());
      const current = get().activeListId;
      // Auto-select first list if none selected or selected list no longer exists
      const validId = lists.find(l => l.id === current) ? current : (lists[0]?.id ?? null);
      set({ lists, activeListId: validId });
      if (validId) await get().fetchMyList();
    } catch (error) {
      console.error('Failed to fetch lists', error);
    } finally {
      set({ listsLoading: false });
    }
  },

  createList: async (name: string) => {
    try {
      const newList = await import('../services/api').then(m => m.api.lists.create(name));
      set(state => ({ lists: [...state.lists, newList], activeListId: newList.id, items: [] }));
      return newList;
    } catch (error) {
      console.error('Failed to create list', error);
      return null;
    }
  },

  deleteList: async (id: number) => {
    try {
      await import('../services/api').then(m => m.api.lists.delete(id));
      const { lists, activeListId } = get();
      const remaining = lists.filter(l => l.id !== id);
      const newActiveId = activeListId === id ? (remaining[0]?.id ?? null) : activeListId;
      set({ lists: remaining, activeListId: newActiveId, items: newActiveId ? get().items : [] });
      if (newActiveId && newActiveId !== activeListId) await get().fetchMyList();
      if (!newActiveId) set({ items: [] });
    } catch (error) {
      console.error('Failed to delete list', error);
    }
  },

  renameList: async (id: number, name: string) => {
    try {
      const updated = await import('../services/api').then(m => m.api.lists.rename(id, name));
      set(state => ({ lists: state.lists.map(l => l.id === id ? updated : l) }));
    } catch (error) {
      console.error('Failed to rename list', error);
    }
  },

  setActiveList: async (id: number) => {
    if (get().activeListId === id) return;
    set({ activeListId: id, items: [] });
    useCartStore.getState().clearCart();
    await get().fetchMyList();
  },

  duplicateList: async (id: number) => {
    try {
      const { api } = await import('../services/api');
      const sourceList = get().lists.find(l => l.id === id);
      const newName = `Copy of ${sourceList?.name ?? 'List'}`;
      // Fetch source items
      const res: any = await api.mylist.get(id);
      const sourceItems: MyListItem[] = Array.isArray(res) ? res : res?.results ?? [];
      // Create the duplicate list
      const newList = await api.lists.create(newName);
      set(state => ({ lists: [...state.lists, newList] }));
      // Copy items into the new list
      await Promise.all(
        sourceItems.map(item =>
          api.mylist.add(item.barcode, item.name, newList.id, item.quantity)
        )
      );
      // Update item_count on the new list
      set(state => ({
        lists: state.lists.map(l =>
          l.id === newList.id ? { ...l, item_count: sourceItems.length } : l
        ),
      }));
    } catch (error) {
      console.error('Failed to duplicate list', error);
    }
  },

  // ── Item operations ───────────────────────────────────────────────────────────

  fetchMyList: async () => {
    const { activeListId } = get();
    if (!activeListId) return;
    set({ loading: true });
    try {
      const res: any = await import('../services/api').then(m => m.api.mylist.get(activeListId));
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
    const { activeListId, items } = get();

    // If no active list, auto-create a default one
    let listId = activeListId;
    if (!listId) {
      const newList = await get().createList('My List');
      if (!newList) throw new Error('Could not create list');
      listId = newList.id;
    }

    if (items.some(i => i.barcode === barcode)) return;

    try {
      await import('../services/api').then(m =>
        m.api.mylist.add(barcode, name, listId!, quantity)
      );
      await get().fetchMyList();
      // Update item_count on the active list
      set(state => ({
        lists: state.lists.map(l =>
          l.id === listId ? { ...l, item_count: l.item_count + 1 } : l
        ),
      }));
    } catch (error) {
      console.error('Failed to add to MyList', error);
      throw error;
    }
  },

  removeItem: async (barcode) => {
    const item = get().items.find(i => i.barcode === barcode);
    if (!item) return;

    // Optimistic update
    const { activeListId } = get();
    set(state => ({
      items: state.items.filter(i => i.barcode !== barcode),
      lists: state.lists.map(l =>
        l.id === activeListId ? { ...l, item_count: Math.max(0, l.item_count - 1) } : l
      ),
    }));
    useCartStore.getState().removeItem(barcode);

    try {
      await import('../services/api').then(m => m.api.mylist.remove(item.id));
    } catch (error) {
      console.error('Failed to remove from MyList', error);
      get().fetchMyList();
    }
  },

  updateQuantity: async (barcode, quantity) => {
    const item = get().items.find(i => i.barcode === barcode);
    if (!item) return;

    if (quantity <= 0) {
      await get().removeItem(barcode);
      return;
    }

    // Optimistic update
    set({ items: get().items.map(i => i.barcode === barcode ? { ...i, quantity } : i) });
    useCartStore.getState().updateQuantity(barcode, quantity);

    try {
      await import('../services/api').then(m => m.api.mylist.update(item.id, quantity));
    } catch (error) {
      console.error('Failed to update quantity', error);
      get().fetchMyList();
    }
  },

  isSaved: (barcode) =>
    get().items.some(item => item.barcode === barcode),

  fetchPrices: async () => {
    const items = get().items;

    const updatedItems = await Promise.all(
      items.map(async (item) => {
        try {
          // Use a short query (first 4 words) so both Tesco and Sainsbury's
          // return their versions of the product — full names are retailer-specific
          // and can miss the other retailer entirely.
          const shortQuery = item.name.split(' ').slice(0, 4).join(' ');

          const res = await import('../services/api').then(m =>
            m.api.grocers.search(shortQuery, {
              page_size: 30,
              include_nutrition: true,
            })
          );

          if (!res?.products?.length) return item;

          const cleanBarcode = item.barcode.replace(/^0+/, '');

          // Merge all products that share the same barcode across retailers,
          // mirroring the deduplication the search screen already does.
          const barcodeMap = new Map<string, any>();
          for (const p of res.products) {
            const pBarcode = (p.barcode ?? '').replace(/^0+/, '');
            if (pBarcode !== cleanBarcode) continue;

            const existing = barcodeMap.get(pBarcode);
            if (existing) {
              const newPrices = (p.prices ?? []).filter(
                (np: any) => !existing.prices.some((ep: any) => ep.grocer_id === np.grocer_id)
              );
              existing.prices = [...existing.prices, ...newPrices];
              if (!existing.image_url && p.image_url) existing.image_url = p.image_url;
              if (!existing.has_off_match && p.has_off_match) {
                existing.has_off_match = p.has_off_match;
                existing.nutrition = p.nutrition;
              }
            } else {
              barcodeMap.set(pBarcode, { ...p, prices: [...(p.prices ?? [])] });
            }
          }

          const mergedProduct = barcodeMap.get(cleanBarcode);
          if (!mergedProduct) return item;

          const allRetailers = mergedProduct.prices;
          if (!allRetailers.length) return item;

          let cheapestRetailer = allRetailers[0];
          for (const retailer of allRetailers) {
            if (retailer.price && parseFloat(retailer.price) < parseFloat(cheapestRetailer.price)) {
              cheapestRetailer = retailer;
            }
          }

          return {
            ...item,
            cheapest_price: cheapestRetailer.price,
            cheapest_retailer: cheapestRetailer.grocer_id,
            productData: {
              ...mergedProduct,
              retailer_count: allRetailers.length,
              cheapest_price: cheapestRetailer.price,
              cheapest_retailer: cheapestRetailer.grocer_id,
            },
          };

        } catch (error) {
          console.error('Price fetch failed for', item.barcode);
          return item;
        }
      })
    );

    set({ items: updatedItems });

    // Sync cart to mirror active list
    const cartStore = useCartStore.getState();
    cartStore.clearCart();
    const validGrades = ['a', 'b', 'c', 'd', 'e', 'unknown'] as const;
    for (const item of updatedItems) {
      const d = item.productData;
      const nutriGrade = d?.nutrition?.nutriscore_grade ?? 'unknown';
      const novaGroup = d?.nutrition?.nova_group ?? null;
      cartStore.addItem({
        id: parseInt(item.barcode) || 0,
        code: item.barcode,
        product_name: item.name,
        brands: d?.brand ?? '',
        image_url: d?.image_url ?? null,
        nutriscore_grade: (validGrades.includes(nutriGrade as any) ? nutriGrade : 'unknown') as any,
        nutriscore_display: d?.nutrition?.nutriscore_display ?? 'Unknown',
        nova_group: ([1, 2, 3, 4].includes(novaGroup as any) ? novaGroup : null) as any,
        nova_display: d?.nutrition?.nova_display ?? 'Unknown',
        traffic_light: d?.nutrition?.traffic_light ?? {
          sugars: { value: null, level: 'unknown' as const },
          salt: { value: null, level: 'unknown' as const },
          fat: { value: null, level: 'unknown' as const },
          saturated_fat: { value: null, level: 'unknown' as const },
        },
        cheapest_price: d?.cheapest_price ?? null,
        prices: d?.prices ?? [],
      }, item.quantity);
    }
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

interface FavouritesState {
  favourites: string[];
  toggle: (barcode: string) => void;
  isFavourite: (barcode: string) => boolean;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      favourites: [],
      toggle: (barcode) =>
        set((state) => ({
          favourites: state.favourites.includes(barcode)
            ? state.favourites.filter((b) => b !== barcode)
            : [...state.favourites, barcode],
        })),
      isFavourite: (barcode) => get().favourites.includes(barcode),
    }),
    {
      name: 'foodxchange-favourites',
      storage: createJSONStorage(() => createStorage()),
    }
  )
);
