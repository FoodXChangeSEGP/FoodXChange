import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';

const TokenStorage = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
      } catch {}
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch {}
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};

const USE_PRODUCTION_API = false;

const LOCAL_API_URL = 'http://localhost:8000/api';
const PRODUCTION_API_URL = 'https://foodxchange.onrender.com/api';

const API_BASE_URL = USE_PRODUCTION_API ? PRODUCTION_API_URL : LOCAL_API_URL;

const TOKEN_KEY = 'foodxchange_auth_token';
const REFRESH_TOKEN_KEY = 'foodxchange_refresh_token';

const DEFAULT_TIMEOUT = 30000;
const SEARCH_TIMEOUT = 60000;

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await TokenStorage.getItemAsync(TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Error retrieving auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface Retailer {
  id: number;
  name: string;
  logo_url: string | null;
  website_url: string | null;
}

export interface ProductPrice {
  id: number;
  retailer: Retailer;
  price: string;
  currency: string;
  is_on_sale: boolean;
  sale_price: string | null;
  in_stock: boolean;
  effective_price: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  nova_score: 1 | 2 | 3 | 4;
  nova_score_display: string;
  nutri_score: 'A' | 'B' | 'C' | 'D' | 'E';
  nutri_score_display: string;
  barcode: string | null;
  unit: string;
  prices?: ProductPrice[];
  lowest_price?: string | null;
}

export interface TrafficLightValue {
  value: string | null;
  level: 'green' | 'amber' | 'red' | 'unknown';
}

export interface TrafficLight {
  sugars: TrafficLightValue;
  salt: TrafficLightValue;
  fat: TrafficLightValue;
  saturated_fat: TrafficLightValue;
}

export interface OFFProduct {
  id: number;
  code: string;
  product_name: string;
  brands: string;
  image_url: string | null;
  nutriscore_grade: 'a' | 'b' | 'c' | 'd' | 'e' | 'unknown';
  nutriscore_display: string;
  nova_group: 1 | 2 | 3 | 4 | null;
  nova_display: string;
  traffic_light: TrafficLight;
  sugars_100g?: string | null;
  salt_100g?: string | null;
  fat_100g?: string | null;
  saturated_fat_100g?: string | null;
  categories?: string;
  countries?: string;
  cheapest_price?: string | null;
  prices?: RetailerPrice[];
}

export interface OFFSearchResponse {
  query: string;
  count: number;
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  results: OFFProduct[];
}

export interface OFFSearchOptions {
  page?: number;
  page_size?: number;
  sort_by?: 'relevance' | 'nutriscore' | 'nova' | 'name';
  nutriscore?: string[];  // e.g., ['a', 'b']
  nova_group?: number[];  // e.g., [1, 2]
  exclude_no_nova?: boolean;
  exclude_no_nutriscore?: boolean;
  refresh?: boolean;
}

export interface RetailerPrice {
  grocer_id: string;
  grocer_name: string;
  price: string;
  unit_price: string | null;
  unit_measure: string | null;
  is_on_sale: boolean;
  original_price: string | null;
  promotion_description: string | null;
  product_url: string | null;
  product_id: string;
}

export interface GrocerNutritionData {
  nutriscore_grade: string | null;
  nutriscore_display: string;
  nova_group: number | null;
  nova_display: string;
  sugars_100g: string | null;
  salt_100g: string | null;
  fat_100g: string | null;
  saturated_fat_100g: string | null;
  traffic_light: TrafficLight;
  ingredients_text?: string | null;
}

export interface PriceComparison {
  cheapest: {
    grocer_id: string;
    grocer_name: string;
    price: string;
  };
  most_expensive: {
    grocer_id: string;
    grocer_name: string;
    price: string;
  };
  potential_savings: string;
  savings_percent: number;
}

export interface CombinedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  description: string;
  categories: string[];
  image_url: string | null;
  prices: RetailerPrice[];
  relevance_score: number;
  retailer_count: number;
  nutrition: GrocerNutritionData | null;
  has_off_match: boolean;
  cheapest_price: string | null;
  cheapest_retailer: string | null;
  price_comparison: PriceComparison | null;
  has_nutrition_data: boolean;
}

export interface CombinedSearchSummary {
  total_unique_products: number;
  products_at_multiple_retailers: number;
  products_with_price_comparison: number;
  products_with_nutrition_data: number;
  retailers_searched: number;
}

export interface CombinedSearchResponse {
  products: CombinedProduct[];
  query: string;
  total_products: number;
  retailer_counts: Record<string, number>;
  nutrition_match_count: number;
  summary: CombinedSearchSummary;
}

export interface GrocerSearchOptions {
  page_size?: number;
  include_nutrition?: boolean;
  grocers?: string[];  // e.g., ['tesco', 'sainsburys']
}

export interface HealthySwapResponse {
  original: OFFProduct;
  alternatives: OFFProduct[];
}

export interface UserList {
  id: number;
  name: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: number;
  product: Product;
  quantity: number;
  is_checked: boolean;
  notes: string;
}

export interface ShoppingList {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  total_items: number;
  total_quantity: number;
  items: ShoppingListItem[];
  created_at: string;
  updated_at: string;
}

export interface RetailerComparison {
  retailer: Retailer;
  available_items: number;
  total_items: number;
  completeness_percentage: number;
  total_cost: string;
  is_cheapest: boolean;
  is_most_complete: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export const api = {
  auth: {
    login: async (username: string, password: string): Promise<AuthTokens> => {
      const response = await apiClient.post('/auth/login/', { username, password });
      const tokens = response.data;
      await TokenStorage.setItemAsync(TOKEN_KEY, tokens.access);
      await TokenStorage.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh);
      return tokens;
    },
    
    register: async (userData: {
      username: string;
      email: string;
      password: string;
      password_confirm: string;
      first_name: string;
      last_name: string;
    }): Promise<User & { tokens?: AuthTokens }> => {
      const response = await apiClient.post('/auth/register/', userData);
      return response.data;
    },
    
    logout: async (): Promise<void> => {
      await TokenStorage.deleteItemAsync(TOKEN_KEY);
      await TokenStorage.deleteItemAsync(REFRESH_TOKEN_KEY);
    },
    
    isAuthenticated: async (): Promise<boolean> => {
      const token = await TokenStorage.getItemAsync(TOKEN_KEY);
      return !!token;
    },
  },
  
  users: {
    getCurrentUser: async (): Promise<User> => {
      const response = await apiClient.get('/users/me/');
      return response.data;
    },
    
    getProfile: async (): Promise<User> => {
      const response = await apiClient.get('/users/profile/');
      return response.data;
    },
    
    updateProfile: async (data: Partial<User>): Promise<User> => {
      const response = await apiClient.patch('/users/profile/', data);
      return response.data;
    },
  },
  
  products: {
    getAll: async (params?: {
      category?: string;
      nova_score?: number;
      nutri_score?: string;
      search?: string;
      ordering?: string;
    }): Promise<Product[]> => {
      const response = await apiClient.get('/products/', { params });
      return response.data;
    },
    
    getById: async (id: number): Promise<Product> => {
      const response = await apiClient.get(`/products/${id}/`);
      return response.data;
    },
    
    searchByBarcode: async (barcode: string): Promise<Product | null> => {
      const response = await apiClient.get('/products/', { 
        params: { barcode } 
      });
      return response.data.length > 0 ? response.data[0] : null;
    },
    
    search: async (query: string): Promise<Product[]> => {
      const response = await apiClient.get('/products/', { 
        params: { search: query } 
      });
      return response.data;
    },
    
    getByCategory: async (category: string): Promise<Product[]> => {
      const response = await apiClient.get('/products/', { 
        params: { category } 
      });
      return response.data;
    },
  },
  
  retailers: {
    getAll: async (): Promise<Retailer[]> => {
      const response = await apiClient.get('/retailers/');
      return response.data;
    },
    
    getById: async (id: number): Promise<Retailer> => {
      const response = await apiClient.get(`/retailers/${id}/`);
      return response.data;
    },
  },
  
  shoppingLists: {
    getAll: async (): Promise<ShoppingList[]> => {
      const response = await apiClient.get('/shopping-lists/');
      return response.data;
    },
    
    getById: async (id: number): Promise<ShoppingList> => {
      const response = await apiClient.get(`/shopping-lists/${id}/`);
      return response.data;
    },
    
    create: async (data: { name: string; description?: string }): Promise<ShoppingList> => {
      const response = await apiClient.post('/shopping-lists/', data);
      return response.data;
    },
    
    update: async (id: number, data: Partial<ShoppingList>): Promise<ShoppingList> => {
      const response = await apiClient.patch(`/shopping-lists/${id}/`, data);
      return response.data;
    },
    
    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`/shopping-lists/${id}/`);
    },
    
    addItem: async (listId: number, productId: number, quantity: number = 1): Promise<ShoppingListItem> => {
      const response = await apiClient.post(`/shopping-lists/${listId}/add_item/`, {
        product_id: productId,
        quantity,
      });
      return response.data;
    },
    
    removeItem: async (listId: number, itemId: number): Promise<void> => {
      await apiClient.post(`/shopping-lists/${listId}/remove_item/`, {
        item_id: itemId,
      });
    },
    
    comparePrices: async (listId: number): Promise<RetailerComparison[]> => {
      const response = await apiClient.get(`/shopping-lists/${listId}/compare_prices/`);
      return response.data;
    },
  },
  
  prices: {
    getAll: async (params?: {
      product?: number;
      retailer?: number;
      in_stock?: boolean;
    }): Promise<ProductPrice[]> => {
      const response = await apiClient.get('/prices/', { params });
      return response.data;
    },
    
    getForProduct: async (productId: number): Promise<ProductPrice[]> => {
      const response = await apiClient.get('/prices/', { 
        params: { product: productId } 
      });
      return response.data;
    },
  },

  grocers: {
    search: async (query: string, options?: GrocerSearchOptions): Promise<CombinedSearchResponse> => {
      const params: Record<string, string | number | boolean> = { q: query };
      
      if (options?.page_size) params.page_size = options.page_size;
      if (options?.include_nutrition !== undefined) {
        params.include_nutrition = options.include_nutrition ? 'true' : 'false';
      }
      if (options?.grocers?.length) {
        params.grocers = options.grocers.join(',');
      }
      
      const response = await apiClient.get('/grocers/search/combined/', {
        params,
        timeout: SEARCH_TIMEOUT,
      });
      return response.data;
    },

    compareByBarcode: async (barcode: string): Promise<CombinedProduct> => {
      const response = await apiClient.get(`/grocers/compare/${barcode}/`);
      return response.data;
    },

    listGrocers: async (): Promise<{ id: string; name: string }[]> => {
      const response = await apiClient.get('/grocers/');
      return response.data;
    },

    compareShoppingList: async (items: Array<{ barcode: string; quantity: number }>): Promise<{
      items: Array<{
        barcode: string;
        name: string;
        quantity: number;
        prices: Array<{
          grocer_id: string;
          grocer_name: string;
          price: string;
          total: string;
        }>;
        cheapest_price: string | null;
        cheapest_retailer: string | null;
      }>;
      missing_products: string[];
      retailer_totals: Array<{
        grocer_id: string;
        grocer_name: string;
        total: string;
        items_available: number;
        items_total: number;
        is_complete: boolean;
        products: Array<{
          name: string;
          quantity: number;
          unit_price: string;
          total: string;
        }>;
      }>;
      cheapest_single_retailer: {
        grocer_id: string;
        grocer_name: string;
        total: string;
        is_complete: boolean;
      } | null;
      cheapest_combination: {
        retailers: Array<{
          grocer_id: string;
          grocer_name: string;
          items: string[];
          subtotal: string;
        }>;
        total: string;
        num_retailers: number;
      } | null;
      potential_savings: {
        amount: string;
        percentage: string;
      } | null;
      summary: {
        total_items: number;
        items_found: number;
        items_missing: number;
        retailers_checked: string[];
      };
    }> => {
      const response = await apiClient.post('/grocers/compare-list/', { items });
      return response.data;
    },
  },

  off: {
    search: async (query: string, options?: OFFSearchOptions): Promise<OFFSearchResponse> => {
      const params: Record<string, string | number | boolean> = { q: query };
      
      if (options?.page) params.page = options.page;
      if (options?.page_size) params.page_size = options.page_size;
      
      if (options?.sort_by) params.sort_by = options.sort_by;
      
      if (options?.nutriscore?.length) params.nutriscore = options.nutriscore.join(',');
      if (options?.nova_group?.length) params.nova_group = options.nova_group.join(',');
      if (options?.exclude_no_nova) params.exclude_no_nova = 'true';
      if (options?.exclude_no_nutriscore) params.exclude_no_nutriscore = 'true';
      
      if (options?.refresh) params.refresh = 'true';
      
      const response = await apiClient.get('/off/search/', { 
        params,
        timeout: SEARCH_TIMEOUT,
      });
      return response.data;
    },

    getByBarcode: async (code: string): Promise<OFFProduct> => {
      const response = await apiClient.get(`/off/product/${code}/`);
      return response.data;
    },

    getHealthySwap: async (params: {
      code?: string;
      id?: number;
      q?: string;
      limit?: number;
    }): Promise<HealthySwapResponse> => {
      const response = await apiClient.get('/off/swap/', { params });
      return response.data;
    },

    getAlternatives: async (productId: number, limit?: number): Promise<HealthySwapResponse> => {
      const params = limit ? { limit } : {};
      const response = await apiClient.get(`/off/products/${productId}/alternatives/`, { params });
      return response.data;
    },
  },

  lists: {
    getAll: async (): Promise<UserList[]> => {
      const response = await apiClient.get('/user-lists/');
      return Array.isArray(response.data) ? response.data : response.data.results ?? [];
    },

    create: async (name: string): Promise<UserList> => {
      const response = await apiClient.post('/user-lists/', { name });
      return response.data;
    },

    rename: async (id: number, name: string): Promise<UserList> => {
      const response = await apiClient.patch(`/user-lists/${id}/`, { name });
      return response.data;
    },

    delete: async (id: number): Promise<void> => {
      await apiClient.delete(`/user-lists/${id}/`);
    },
  },

  mylist: {
    get: async (listId: number) => {
      const response = await apiClient.get('/mylist/', { params: { list_id: listId } });
      return response.data;
    },

    add: (barcode: string, name: string, listId: number, quantity = 1) =>
      apiClient.post('/mylist/', {
        barcode,
        name,
        quantity,
        list_id: listId,
      }),

    update: (id: number, quantity: number) =>
      apiClient.patch(`/mylist/${id}/`, { quantity }),

    remove: (id: number) =>
      apiClient.delete(`/mylist/${id}/`),
  },

  community: {
    // Groups
    listGroups: async (filter?: 'mine' | 'trending' | 'featured'): Promise<import('../types/community').CommunityGroup[]> => {
      const params = filter ? { filter } : {};
      const response = await apiClient.get('/community/groups/', { params });
      return response.data.results ?? response.data;
    },

    createGroup: async (data: { name: string; description: string; category: string }): Promise<import('../types/community').CommunityGroup> => {
      const response = await apiClient.post('/community/groups/', data);
      return response.data;
    },

    getGroup: async (id: number): Promise<import('../types/community').CommunityGroup> => {
      const response = await apiClient.get(`/community/groups/${id}/`);
      return response.data;
    },

    joinGroup: async (id: number): Promise<{ joined: boolean; member_count: number }> => {
      const response = await apiClient.post(`/community/groups/${id}/join/`);
      return response.data;
    },

    leaveGroup: async (id: number): Promise<{ left: boolean; member_count: number }> => {
      const response = await apiClient.post(`/community/groups/${id}/leave/`);
      return response.data;
    },

    // Topics
    listTopics: async (groupId: number): Promise<import('../types/community').Topic[]> => {
      const response = await apiClient.get(`/community/groups/${groupId}/topics/`);
      return response.data.results ?? response.data;
    },

    createTopic: async (groupId: number, data: { title: string; body: string }): Promise<import('../types/community').Topic> => {
      const response = await apiClient.post(`/community/groups/${groupId}/topics/`, data);
      return response.data;
    },

    deleteTopic: async (topicId: number): Promise<void> => {
      await apiClient.delete(`/community/topics/${topicId}/`);
    },

    voteTopic: async (topicId: number, voteType: import('../types/community').VoteType): Promise<import('../types/community').VoteResponse> => {
      const response = await apiClient.post(`/community/topics/${topicId}/vote/`, { vote_type: voteType });
      return response.data;
    },

    // Comments
    listComments: async (topicId: number, ordering?: 'newest' | 'most_liked'): Promise<import('../types/community').Comment[]> => {
      const params = ordering ? { ordering } : {};
      const response = await apiClient.get(`/community/topics/${topicId}/comments/`, { params });
      return response.data.results ?? response.data;
    },

    createComment: async (topicId: number, body: string): Promise<import('../types/community').Comment> => {
      const response = await apiClient.post(`/community/topics/${topicId}/comments/`, { body });
      return response.data;
    },

    voteComment: async (commentId: number, voteType: import('../types/community').VoteType): Promise<import('../types/community').VoteResponse> => {
      const response = await apiClient.post(`/community/comments/${commentId}/vote/`, { vote_type: voteType });
      return response.data;
    },

    replyToComment: async (commentId: number, body: string): Promise<import('../types/community').Comment> => {
      const response = await apiClient.post(`/community/comments/${commentId}/reply/`, { body });
      return response.data;
    },

    // Events
    listEvents: async (): Promise<import('../types/community').FoodXEvent[]> => {
      const response = await apiClient.get('/community/events/');
      return response.data.results ?? response.data;
    },

    getEvent: async (id: number): Promise<import('../types/community').FoodXEvent> => {
      const response = await apiClient.get(`/community/events/${id}/`);
      return response.data;
    },
  },

  cart: {
    getAll: async (): Promise<CartItemData[]> => {
      const response = await apiClient.get('/cart/');
      const data = response.data;
      return Array.isArray(data) ? data : data?.results ?? [];
    },

    add: async (item: {
      barcode: string;
      name: string;
      image_url?: string;
      quantity?: number;
      price?: string;
      retailer_name?: string;
      product_data?: Record<string, any>;
    }): Promise<CartItemData> => {
      const response = await apiClient.post('/cart/', item);
      return response.data;
    },

    update: async (id: number, data: Partial<CartItemData>): Promise<CartItemData> => {
      const response = await apiClient.patch(`/cart/${id}/`, data);
      return response.data;
    },

    remove: async (id: number): Promise<void> => {
      await apiClient.delete(`/cart/${id}/`);
    },

    clear: async (): Promise<void> => {
      await apiClient.delete('/cart/clear/');
    },
  },

};

export interface CartItemData {
  id: number;
  barcode: string;
  name: string;
  image_url: string | null;
  quantity: number;
  price: string | null;
  retailer_name: string;
  product_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default api;
