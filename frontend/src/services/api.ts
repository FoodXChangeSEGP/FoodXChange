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
import * as SecureStore from 'expo-secure-store';

// Configuration - update this to match your backend URL
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api' 
  : 'https://your-production-url.com/api';

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

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
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
apiClient.interceptors.response.use(
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
      await SecureStore.setItemAsync(TOKEN_KEY, tokens.access);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh);
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
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    },
    
    isAuthenticated: async (): Promise<boolean> => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
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
};

export default api;
