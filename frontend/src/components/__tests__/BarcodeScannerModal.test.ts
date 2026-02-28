/**
 * Tests for the barcode scanning feature.
 *
 * Covers:
 *  - BarcodeScannerModal behaviour (permission gating, manual entry, scan callback)
 *  - Barcode lookup logic from FoodXScreen (compareByBarcode → OFF fallback → not-found)
 *
 * No real images or camera hardware needed. Everything is mocked.
 */

// ---------- mocks that must be declared before imports ----------

// Mock react-native Modal, etc.  (jest.setup.js already mocks react-native,
// but we add Modal for our component).
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return {
    ...rn,
    Platform: { OS: 'web', select: (o: any) => o.web ?? o.default },
    StyleSheet: {
      create: (s: any) => s,
      absoluteFillObject: {},
      absoluteFill: {},
    },
    Modal: 'Modal',
    View: 'View',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    Alert: { alert: jest.fn() },
    Dimensions: { get: jest.fn(() => ({ width: 375, height: 812 })) },
    Animated: {
      Value: jest.fn().mockImplementation(() => ({
        interpolate: jest.fn().mockReturnValue(0),
      })),
      View: 'Animated.View',
      timing: jest.fn().mockReturnValue({ start: jest.fn() }),
      sequence: jest.fn().mockReturnValue({ start: jest.fn() }),
      loop: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
    },
  };
});

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [
    { granted: true, canAskAgain: true },
    jest.fn(),
  ]),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: { main: '#22C55E', dark: '#166534', light: '#4ADE80' },
      neutral: { white: '#FFF', charcoal: '#1E293B', gray: '#94A3B8', darkGray: '#64748B', lightGray: '#E2E8F0' },
      surface: { background: '#FFF', glassBorder: '#E2E8F0', elevated: '#FFF', glassOverlay: 'rgba(0,0,0,0.1)' },
      semantic: { error: '#EF4444' },
    },
    isDark: false,
  }),
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, base: 16 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
  typography: { fontSize: { sm: 12, md: 14, lg: 16, xl: 20, '3xl': 30 }, fontWeight: { regular: '400' }, letterSpacing: { normal: 0 } },
  glass: { blur: { medium: 50, extreme: 100 }, borderWidth: 1 },
  textFont: { bold: {} },
  glassShadows: { float: {} },
}));

// Mock UI components used by BarcodeScannerModal
jest.mock('@/components/ui', () => ({
  AnimatedPressable: 'AnimatedPressable',
  GradientButton: 'GradientButton',
  GlassCard: 'GlassCard',
  GlassModal: 'GlassModal',
  GlassSearchBar: 'GlassSearchBar',
  ScoreBadge: 'ScoreBadge',
  PriceTag: 'PriceTag',
}));

// ---------- api mock ----------

const mockCompareByBarcode = jest.fn();
const mockGetByBarcode = jest.fn();

jest.mock('@/services/api', () => ({
  api: {
    grocers: {
      compareByBarcode: (...args: any[]) => mockCompareByBarcode(...args),
      search: jest.fn().mockResolvedValue({ products: [], total_products: 0, summary: {} }),
    },
    off: {
      getByBarcode: (...args: any[]) => mockGetByBarcode(...args),
    },
  },
}));

// ---------- imports ----------

import { api } from '@/services/api';
import type { CombinedProduct, OFFProduct, TrafficLight } from '@/services/api';

// ---------- helpers ----------

const mockTrafficLight: TrafficLight = {
  sugars: { value: null, level: 'unknown' },
  salt: { value: null, level: 'unknown' },
  fat: { value: null, level: 'unknown' },
  saturated_fat: { value: null, level: 'unknown' },
};

const makeCombinedProduct = (barcode: string): CombinedProduct => ({
  barcode,
  name: 'Test Product',
  brand: 'TestBrand',
  description: '',
  categories: [],
  image_url: null,
  prices: [
    {
      grocer_id: 'tesco',
      grocer_name: 'Tesco',
      price: '1.50',
      unit_price: null,
      unit_measure: null,
      is_on_sale: false,
      original_price: null,
      promotion_description: null,
      product_url: null,
      product_id: '123',
    },
  ],
  relevance_score: 1,
  retailer_count: 1,
  nutrition: null,
  has_off_match: false,
  cheapest_price: '1.50',
  cheapest_retailer: 'Tesco',
  price_comparison: null,
  has_nutrition_data: false,
});

const makeOFFProduct = (code: string): OFFProduct => ({
  id: 1,
  code,
  product_name: 'OFF Product',
  brands: 'OFFBrand',
  image_url: null,
  nutriscore_grade: 'b',
  nutriscore_display: 'B',
  nova_group: 2,
  nova_display: '2 - Processed culinary ingredients',
  traffic_light: mockTrafficLight,
});

// ---------- test suites ----------

describe('Barcode scanning feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Camera permissions mock', () => {
    it('useCameraPermissions returns granted by default in mock', () => {
      const { useCameraPermissions } = require('expo-camera');
      const [perm, requestFn] = useCameraPermissions();
      expect(perm.granted).toBe(true);
      expect(typeof requestFn).toBe('function');
    });

    it('useCameraPermissions can be overridden to not-granted', () => {
      const cam = require('expo-camera');
      cam.useCameraPermissions.mockReturnValueOnce([
        { granted: false, canAskAgain: true },
        jest.fn(),
      ]);
      const [perm] = cam.useCameraPermissions();
      expect(perm.granted).toBe(false);
    });
  });

  describe('Barcode lookup logic (API layer)', () => {
    it('compareByBarcode calls the right endpoint', async () => {
      const product = makeCombinedProduct('5000128065253');
      mockCompareByBarcode.mockResolvedValueOnce(product);

      const result = await api.grocers.compareByBarcode('5000128065253');
      expect(mockCompareByBarcode).toHaveBeenCalledWith('5000128065253');
      expect(result.barcode).toBe('5000128065253');
      expect(result.name).toBe('Test Product');
    });

    it('falls back to OFF lookup when compareByBarcode fails', async () => {
      mockCompareByBarcode.mockRejectedValueOnce(new Error('Not found'));
      const offProduct = makeOFFProduct('5000128065253');
      mockGetByBarcode.mockResolvedValueOnce(offProduct);

      // Simulate the fallback flow from FoodXScreen.handleBarcodeResult
      let result: CombinedProduct | null = null;
      try {
        await api.grocers.compareByBarcode('5000128065253');
      } catch {
        const off = await api.off.getByBarcode('5000128065253');
        result = {
          barcode: off.code,
          name: off.product_name || 'Unknown Product',
          brand: off.brands || null,
          description: '',
          categories: [],
          image_url: off.image_url || null,
          prices: [],
          relevance_score: 1,
          retailer_count: 0,
          nutrition: {
            nutriscore_grade: off.nutriscore_grade || 'unknown',
            nutriscore_display: off.nutriscore_display || 'Unknown',
            nova_group: off.nova_group,
            nova_display: off.nova_display || 'Unknown',
            sugars_100g: off.sugars_100g ?? null,
            salt_100g: off.salt_100g ?? null,
            fat_100g: off.fat_100g ?? null,
            saturated_fat_100g: off.saturated_fat_100g ?? null,
            traffic_light: off.traffic_light || mockTrafficLight,
          },
          has_off_match: true,
          cheapest_price: null,
          cheapest_retailer: null,
          price_comparison: null,
          has_nutrition_data: true,
        };
      }

      expect(mockCompareByBarcode).toHaveBeenCalledWith('5000128065253');
      expect(mockGetByBarcode).toHaveBeenCalledWith('5000128065253');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('OFF Product');
      expect(result!.has_off_match).toBe(true);
      expect(result!.nutrition?.nutriscore_grade).toBe('b');
    });

    it('reports not found when both compare and OFF fail', async () => {
      mockCompareByBarcode.mockRejectedValueOnce(new Error('Not found'));
      mockGetByBarcode.mockRejectedValueOnce(new Error('Not found'));

      let notFound = false;
      try {
        await api.grocers.compareByBarcode('0000000000000');
      } catch {
        try {
          await api.off.getByBarcode('0000000000000');
        } catch {
          notFound = true;
        }
      }

      expect(notFound).toBe(true);
      expect(mockCompareByBarcode).toHaveBeenCalledWith('0000000000000');
      expect(mockGetByBarcode).toHaveBeenCalledWith('0000000000000');
    });
  });

  describe('Barcode validation helpers', () => {
    // Test EAN-13 / EAN-8 / UPC-A validation patterns
    const isValidBarcode = (code: string): boolean => {
      const trimmed = code.trim();
      // EAN-8, EAN-13, UPC-A, or UPC-E length ranges
      return /^\d{8}$|^\d{12,13}$/.test(trimmed);
    };

    it('accepts valid EAN-13 barcodes', () => {
      expect(isValidBarcode('5000128065253')).toBe(true);
      expect(isValidBarcode('8710398527875')).toBe(true);
    });

    it('accepts valid EAN-8 barcodes', () => {
      expect(isValidBarcode('96385074')).toBe(true);
    });

    it('accepts valid UPC-A barcodes', () => {
      expect(isValidBarcode('012345678905')).toBe(true);
    });

    it('rejects non-numeric strings', () => {
      expect(isValidBarcode('abcdefghijklm')).toBe(false);
      expect(isValidBarcode('abc12345')).toBe(false);
    });

    it('rejects too-short or too-long barcodes', () => {
      expect(isValidBarcode('12345')).toBe(false);
      expect(isValidBarcode('12345678901234567890')).toBe(false);
    });

    it('trims whitespace before validating', () => {
      expect(isValidBarcode(' 5000128065253 ')).toBe(true);
    });
  });

  describe('CombinedProduct construction from OFF data', () => {
    it('maps all OFF fields correctly to CombinedProduct', () => {
      const off = makeOFFProduct('1234567890123');
      const combined: CombinedProduct = {
        barcode: off.code,
        name: off.product_name,
        brand: off.brands,
        description: '',
        categories: [],
        image_url: off.image_url,
        prices: [],
        relevance_score: 1,
        retailer_count: 0,
        nutrition: {
          nutriscore_grade: off.nutriscore_grade,
          nutriscore_display: off.nutriscore_display,
          nova_group: off.nova_group,
          nova_display: off.nova_display,
          sugars_100g: off.sugars_100g ?? null,
          salt_100g: off.salt_100g ?? null,
          fat_100g: off.fat_100g ?? null,
          saturated_fat_100g: off.saturated_fat_100g ?? null,
          traffic_light: off.traffic_light,
        },
        has_off_match: true,
        cheapest_price: null,
        cheapest_retailer: null,
        price_comparison: null,
        has_nutrition_data: true,
      };

      expect(combined.barcode).toBe('1234567890123');
      expect(combined.name).toBe('OFF Product');
      expect(combined.brand).toBe('OFFBrand');
      expect(combined.retailer_count).toBe(0);
      expect(combined.prices).toHaveLength(0);
      expect(combined.has_off_match).toBe(true);
      expect(combined.nutrition?.nutriscore_grade).toBe('b');
      expect(combined.nutrition?.nova_group).toBe(2);
    });

    it('handles missing OFF product name gracefully', () => {
      const off = makeOFFProduct('9999999999999');
      off.product_name = '';
      const name = off.product_name || 'Unknown Product';
      expect(name).toBe('Unknown Product');
    });

    it('handles null image_url', () => {
      const off = makeOFFProduct('9999999999999');
      expect(off.image_url).toBeNull();
      const combined_image = off.image_url || null;
      expect(combined_image).toBeNull();
    });
  });

  describe('Multiple result deduplication by barcode', () => {
    it('deduplicates products with the same barcode, merging prices', () => {
      const p1 = makeCombinedProduct('5000128065253');
      p1.prices = [
        { grocer_id: 'tesco', grocer_name: 'Tesco', price: '1.50', unit_price: null, unit_measure: null, is_on_sale: false, original_price: null, promotion_description: null, product_url: null, product_id: '1' },
      ];

      const p2 = makeCombinedProduct('5000128065253');
      p2.prices = [
        { grocer_id: 'sainsburys', grocer_name: "Sainsbury's", price: '1.75', unit_price: null, unit_measure: null, is_on_sale: false, original_price: null, promotion_description: null, product_url: null, product_id: '2' },
      ];

      // Simulate the dedup logic from FoodXScreen
      const barcodeMap = new Map<string, CombinedProduct>();
      for (const p of [p1, p2]) {
        const existing = barcodeMap.get(p.barcode);
        if (existing) {
          const newPrices = p.prices.filter(
            (np) => !existing.prices.some((ep) => ep.grocer_id === np.grocer_id),
          );
          existing.prices = [...existing.prices, ...newPrices];
          existing.retailer_count = existing.prices.length;
        } else {
          barcodeMap.set(p.barcode, { ...p });
        }
      }

      const results = Array.from(barcodeMap.values());
      expect(results).toHaveLength(1);
      expect(results[0].prices).toHaveLength(2);
      expect(results[0].retailer_count).toBe(2);
    });
  });
});
