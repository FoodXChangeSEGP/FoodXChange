import axios from 'axios';

// Mock expo-secure-store before importing api
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
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

// Get the mock instance that api.ts will use
const mockAxiosCreate = axios.create as jest.Mock;
const mockClient = mockAxiosCreate();

import { api } from '../api';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('api.products', () => {
  it('getAll calls GET /products/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Milk' }] });
    const result = await api.products.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/products/', { params: undefined });
    expect(result).toEqual([{ id: 1, name: 'Milk' }]);
  });

  it('getAll passes filter params', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.products.getAll({ category: 'Dairy', nova_score: 1 });
    expect(mockClient.get).toHaveBeenCalledWith('/products/', {
      params: { category: 'Dairy', nova_score: 1 },
    });
  });

  it('getById calls GET /products/:id/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { id: 5, name: 'Bread' } });
    const result = await api.products.getById(5);
    expect(mockClient.get).toHaveBeenCalledWith('/products/5/');
    expect(result.name).toBe('Bread');
  });

  it('search calls GET /products/ with search param', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    await api.products.search('organic');
    expect(mockClient.get).toHaveBeenCalledWith('/products/', {
      params: { search: 'organic' },
    });
  });

  it('searchByBarcode returns product when found', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, barcode: '123' }] });
    const result = await api.products.searchByBarcode('123');
    expect(result).toEqual({ id: 1, barcode: '123' });
  });

  it('searchByBarcode returns null when not found', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    const result = await api.products.searchByBarcode('999');
    expect(result).toBeNull();
  });

  it('getByCategory calls with category param', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.products.getByCategory('Fruit');
    expect(mockClient.get).toHaveBeenCalledWith('/products/', {
      params: { category: 'Fruit' },
    });
  });
});

describe('api.retailers', () => {
  it('getAll calls GET /retailers/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Tesco' }] });
    const result = await api.retailers.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/retailers/');
    expect(result).toHaveLength(1);
  });

  it('getById calls GET /retailers/:id/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { id: 2, name: 'Aldi' } });
    const result = await api.retailers.getById(2);
    expect(mockClient.get).toHaveBeenCalledWith('/retailers/2/');
    expect(result.name).toBe('Aldi');
  });
});

describe('api.shoppingLists', () => {
  it('getAll calls GET /shopping-lists/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.shoppingLists.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/shopping-lists/');
  });

  it('getById calls GET /shopping-lists/:id/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { id: 1, name: 'My List' } });
    const result = await api.shoppingLists.getById(1);
    expect(mockClient.get).toHaveBeenCalledWith('/shopping-lists/1/');
    expect(result.name).toBe('My List');
  });

  it('create calls POST /shopping-lists/', async () => {
    mockClient.post.mockResolvedValueOnce({
      data: { id: 1, name: 'New List' },
    });
    const result = await api.shoppingLists.create({ name: 'New List' });
    expect(mockClient.post).toHaveBeenCalledWith('/shopping-lists/', {
      name: 'New List',
    });
    expect(result.name).toBe('New List');
  });

  it('update calls PATCH /shopping-lists/:id/', async () => {
    mockClient.patch.mockResolvedValueOnce({
      data: { id: 1, name: 'Updated' },
    });
    await api.shoppingLists.update(1, { name: 'Updated' } as any);
    expect(mockClient.patch).toHaveBeenCalledWith('/shopping-lists/1/', {
      name: 'Updated',
    });
  });

  it('delete calls DELETE /shopping-lists/:id/', async () => {
    mockClient.delete.mockResolvedValueOnce({});
    await api.shoppingLists.delete(1);
    expect(mockClient.delete).toHaveBeenCalledWith('/shopping-lists/1/');
  });

  it('addItem calls POST /shopping-lists/:id/add_item/', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: 1, quantity: 2 } });
    await api.shoppingLists.addItem(1, 5, 2);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/shopping-lists/1/add_item/',
      { product_id: 5, quantity: 2 },
    );
  });

  it('addItem defaults quantity to 1', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: 1, quantity: 1 } });
    await api.shoppingLists.addItem(1, 5);
    expect(mockClient.post).toHaveBeenCalledWith(
      '/shopping-lists/1/add_item/',
      { product_id: 5, quantity: 1 },
    );
  });

  it('comparePrices calls GET /shopping-lists/:id/compare_prices/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.shoppingLists.comparePrices(1);
    expect(mockClient.get).toHaveBeenCalledWith(
      '/shopping-lists/1/compare_prices/',
    );
  });
});

describe('api.prices', () => {
  it('getAll calls GET /prices/', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.prices.getAll();
    expect(mockClient.get).toHaveBeenCalledWith('/prices/', { params: undefined });
  });

  it('getForProduct calls GET /prices/ with product param', async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await api.prices.getForProduct(3);
    expect(mockClient.get).toHaveBeenCalledWith('/prices/', {
      params: { product: 3 },
    });
  });
});

describe('api.auth', () => {
  const SecureStore = require('expo-secure-store');

  it('login stores tokens and returns them', async () => {
    mockClient.post.mockResolvedValueOnce({
      data: { access: 'abc', refresh: 'def' },
    });
    const tokens = await api.auth.login('user', 'pass');
    expect(mockClient.post).toHaveBeenCalledWith('/auth/login/', {
      username: 'user',
      password: 'pass',
    });
    expect(tokens.access).toBe('abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
  });

  it('register calls POST /auth/register/', async () => {
    mockClient.post.mockResolvedValueOnce({
      data: { id: 1, username: 'newuser' },
    });
    const result = await api.auth.register({
      username: 'newuser',
      email: 'new@example.com',
      password: 'StrongPass123!',
      password_confirm: 'StrongPass123!',
    });
    expect(mockClient.post).toHaveBeenCalledWith('/auth/register/', {
      username: 'newuser',
      email: 'new@example.com',
      password: 'StrongPass123!',
      password_confirm: 'StrongPass123!',
    });
    expect(result.username).toBe('newuser');
  });

  it('logout clears stored tokens', async () => {
    await api.auth.logout();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
  });
});
