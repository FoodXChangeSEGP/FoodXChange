/**
 * Common TypeScript Types
 */

// Navigation Types
export type RootTabParamList = {
  Home: undefined;
  FoodX: undefined;
  Cook: undefined;
  Pantry: undefined;
  Community: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  ProductDetail: { productId: number };
  ShoppingListDetail: { listId: number };
  BarcodeScanner: undefined;
  Login: undefined;
  Register: undefined;
};

// Re-export API types
export type {
  Product,
  ProductPrice,
  Retailer,
  ShoppingList,
  ShoppingListItem,
  RetailerComparison,
  User,
} from '../services/api';
