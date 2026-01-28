/**
 * Minimal API Service Tests
 * 
 * Focus: Does the API service correctly call the backend endpoints?
 * We mock axios to test the service layer without network calls.
 */

import axios from 'axios';

// Mock react-native Platform (required for api.ts)
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

// Mock axios
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockInstance),
    },
    ...mockInstance,
  };
});

const mockAxiosCreate = axios.create as jest.Mock;
const mockClient = mockAxiosCreate();

import { api } from '../api';

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================================
// CORE ENDPOINT TESTS - Does the API call the right endpoints?
// =============================================================================

describe('Products API', () => {
  it('fetches all products', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Milk' }] });
    const result = await api.products.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/products/', { params: undefined });
    expect(result).toHaveLength(1);
  });

  it('fetches product by id', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { id: 5, name: 'Bread' } });
    const result = await api.products.getById(5);
    expect(mockClient.get).toHaveBeenCalledWith('/products/5/');
    expect(result.name).toBe('Bread');
  });

  it('searches products', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Organic Milk' }] });
    const result = await api.products.search('organic');
    expect(mockClient.get).toHaveBeenCalledWith('/products/', { params: { search: 'organic' } });
    expect(result).toHaveLength(1);
  });
});

describe('Retailers API', () => {
  it('fetches all retailers', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Tesco' }] });
    const result = await api.retailers.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/retailers/');
    expect(result).toHaveLength(1);
  });
});

describe('Shopping Lists API', () => {
  it('fetches all shopping lists', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Weekly Shop' }] });
    const result = await api.shoppingLists.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/shopping-lists/');
    expect(result).toHaveLength(1);
  });

  it('creates a shopping list', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: 1, name: 'New List' } });
    const result = await api.shoppingLists.create({ name: 'New List' });
    expect(mockClient.post).toHaveBeenCalledWith('/shopping-lists/', { name: 'New List' });
    expect(result.name).toBe('New List');
  });

  it('adds item to shopping list', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: 1, quantity: 2 } });
    await api.shoppingLists.addItem(1, 5, 2);
    expect(mockClient.post).toHaveBeenCalledWith('/shopping-lists/1/add_item/', { product_id: 5, quantity: 2 });
  });

  it('compares prices for a shopping list', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { comparison: [], cheapest: null } });
    await api.shoppingLists.comparePrices(1);
    expect(mockClient.get).toHaveBeenCalledWith('/shopping-lists/1/compare_prices/');
  });
});

describe('Prices API', () => {
  it('fetches prices for a product', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, price: '1.50' }] });
    const result = await api.prices.getForProduct(3);
    expect(mockClient.get).toHaveBeenCalledWith('/prices/', { params: { product: 3 } });
    expect(result).toHaveLength(1);
  });
});

// Auth tests are intentionally minimal - storage mocking is complex
describe('Auth API', () => {
  it('login calls correct endpoint', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { access: 'token', refresh: 'refresh' } });
    const tokens = await api.auth.login('user', 'pass');
    expect(mockClient.post).toHaveBeenCalledWith('/auth/login/', { username: 'user', password: 'pass' });
    expect(tokens.access).toBe('token');
  });

  it('register calls correct endpoint', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: 1, username: 'newuser' } });
    const result = await api.auth.register({
      username: 'newuser',
      email: 'new@example.com',
      password: 'Pass123!',
      password_confirm: 'Pass123!',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/auth/register/', expect.any(Object));
    expect(result.username).toBe('newuser');
  });
});
