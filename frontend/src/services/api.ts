/**
 * FoodXchange API Service
 * 
 * Handles all communication with the Django REST backend.
 * Base URL: /api/
 * 
 * Available Endpoints:
 * - Products: /api/products/
 * - Retailers: /api/retailers/
 * - Prices: /api/prices/
 * - Shopping Lists: /api/shopping-lists/
 * - Auth: /api/auth/login/, /api/auth/register/, /api/auth/refresh/
 * - Users: /api/users/me/, /api/users/profile/
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';

// =============================================================================
// TOKEN STORAGE ABSTRACTION
// =============================================================================
// expo-secure-store doesn't work on web, so we use localStorage for web
// and SecureStore for native platforms.
// =============================================================================

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
      } catch {
        // Ignore storage errors in tests
      }
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
      } catch {
        // Ignore storage errors in tests
      }
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.deleteItemAsync(key);
  },
};


// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================
// Toggle between local and production API:
// - Set USE_PRODUCTION_API = false for local development (http://localhost:8000)
// - Set USE_PRODUCTION_API = true to test against production Render API
// - In production builds (__DEV__ = false), always uses production URL
// =============================================================================
const USE_PRODUCTION_API = false; // <-- Toggle this for local testing against prod

const LOCAL_API_URL = 'http://localhost:8000/api';
const PRODUCTION_API_URL = 'https://foodxchange.onrender.com/api';

const API_BASE_URL = __DEV__ 
  ? (USE_PRODUCTION_API ? PRODUCTION_API_URL : LOCAL_API_URL)
  : PRODUCTION_API_URL;

// Log which API is being used (only in dev)
if (__DEV__) {
  console.log(`🌐 API: ${API_BASE_URL}`);
}

const TOKEN_KEY = 'foodxchange_auth_token';
const REFRESH_TOKEN_KEY = 'foodxchange_refresh_token';

// Timeouts - Open Food Facts API can be slow
const DEFAULT_TIMEOUT = 30000;  // 30 seconds for most requests
const SEARCH_TIMEOUT = 60000;   // 60 seconds for search (OFF API is slow)

// Create axios instance
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

// ============================================
// TYPE DEFINITIONS (matching Django models)
// ============================================

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

// Open Food Facts Product Types
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
  // Nutritional data (for detail view)
  sugars_100g?: string | null;
  salt_100g?: string | null;
  fat_100g?: string | null;
  saturated_fat_100g?: string | null;
  categories?: string;
  countries?: string;
  // Price info (when added from grocer search)
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

// ==============================================
// GROCER COMBINED SEARCH TYPES (Primary Source)
// ==============================================
// These types are for the combined Tesco/Sainsbury's search
// which uses UK grocers as primary data source and enriches
// with Open Food Facts nutrition data only via barcode match.

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

// ============================================
// API METHODS
// ============================================

export const api = {
  // Auth endpoints
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
    }): Promise<User> => {
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
  
  // User endpoints
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
  
  // Products endpoints
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
  
  // Retailers endpoints
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
  
  // Shopping Lists endpoints
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
      await apiClient.delete(`/shopping-lists/${listId}/items/${itemId}/`);
    },
    
    comparePrices: async (listId: number): Promise<RetailerComparison[]> => {
      const response = await apiClient.get(`/shopping-lists/${listId}/compare/`);
      return response.data;
    },

    itemDeals: async (listId: number) => {
      const response = await apiClient.get(`/shopping-lists/${listId}/item_deals/`);
      return response.data;
    },    
  },
  
  // Prices endpoints
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

  // ==============================================
  // GROCER SEARCH (Primary Source - Tesco/Sainsbury's)
  // ==============================================
  // These endpoints use UK grocers as the primary data source
  // and enrich with Open Food Facts nutrition data only via barcode.
  grocers: {
    /**
     * Search for products across Tesco and Sainsbury's.
     * This is the recommended endpoint for product search as it:
     * - Uses UK grocers as primary data source
     * - Deduplicates products by barcode
     * - Shows prices from multiple retailers
     * - Only enriches with OFF nutrition data when barcode matches
     */
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

    /**
     * Compare prices for a specific product by barcode.
     */
    compareByBarcode: async (barcode: string): Promise<CombinedProduct> => {
      const response = await apiClient.get(`/grocers/compare/${barcode}/`);
      return response.data;
    },

    /**
     * List available grocery retailers.
     */
    listGrocers: async (): Promise<{ id: string; name: string }[]> => {
      const response = await apiClient.get('/grocers/');
      return response.data;
    },

    /**
     * Compare prices for a shopping list across retailers.
     * Returns total by retailer and cheapest combination.
     */
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

  // Open Food Facts endpoints (for nutrition verification and healthy swaps)
  off: {
    /**
     * Search for products in Open Food Facts database.
     * NOTE: This is primarily for healthy swap functionality.
     * For main product search, use grocers.search() instead.
     * Supports pagination, sorting, and filtering.
     * Uses longer timeout as OFF API can be slow.
     */
    search: async (query: string, options?: OFFSearchOptions): Promise<OFFSearchResponse> => {
      const params: Record<string, string | number | boolean> = { q: query };
      
      // Pagination
      if (options?.page) params.page = options.page;
      if (options?.page_size) params.page_size = options.page_size;
      
      // Sorting (default: relevance for best search results)
      if (options?.sort_by) params.sort_by = options.sort_by;
      
      // Filters
      if (options?.nutriscore?.length) params.nutriscore = options.nutriscore.join(',');
      if (options?.nova_group?.length) params.nova_group = options.nova_group.join(',');
      if (options?.exclude_no_nova) params.exclude_no_nova = 'true';
      if (options?.exclude_no_nutriscore) params.exclude_no_nutriscore = 'true';
      
      // Force refresh
      if (options?.refresh) params.refresh = 'true';
      
      const response = await apiClient.get('/off/search/', { 
        params,
        timeout: SEARCH_TIMEOUT,  // Use longer timeout for search
      });
      return response.data;
    },

    /**
     * Get a single product by barcode.
     */
    getByBarcode: async (code: string): Promise<OFFProduct> => {
      const response = await apiClient.get(`/off/product/${code}/`);
      return response.data;
    },

    /**
     * Find healthier alternatives to a product.
     */
    getHealthySwap: async (params: {
      code?: string;
      id?: number;
      q?: string;
      limit?: number;
    }): Promise<HealthySwapResponse> => {
      const response = await apiClient.get('/off/swap/', { params });
      return response.data;
    },

    /**
     * Get alternatives for a product by its ID.
     */
    getAlternatives: async (productId: number, limit?: number): Promise<HealthySwapResponse> => {
      const params = limit ? { limit } : {};
      const response = await apiClient.get(`/off/products/${productId}/alternatives/`, { params });
      return response.data;
    },
  },
};

export default api;
