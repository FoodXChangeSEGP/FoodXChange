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
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    // Dynamically import SecureStore only on native platforms
    const SecureStore = await import('expo-secure-store');
    return SecureStore.getItemAsync(key);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
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

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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


// Response interceptor for token refresh
/*apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          
          const { access } = response.data;
          await SecureStore.setItemAsync(TOKEN_KEY, access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    }
    
    return Promise.reject(error);
  }
);
*/

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
}

export interface OFFSearchResponse {
  query: string;
  count: number;
  results: OFFProduct[];
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
      await apiClient.post(`/shopping-lists/${listId}/remove_item/`, {
        item_id: itemId,
      });
    },
    
    comparePrices: async (listId: number): Promise<RetailerComparison[]> => {
      const response = await apiClient.get(`/shopping-lists/${listId}/compare_prices/`);
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

  // Open Food Facts endpoints
  off: {
    /**
     * Search for products in Open Food Facts database.
     * Results are ranked by health scores (Nutriscore, NOVA).
     */
    search: async (query: string, options?: {
      limit?: number;
      refresh?: boolean;
    }): Promise<OFFSearchResponse> => {
      const params: Record<string, string | number | boolean> = { q: query };
      if (options?.limit) params.limit = options.limit;
      if (options?.refresh) params.refresh = 'true';
      
      const response = await apiClient.get('/off/search/', { params });
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
