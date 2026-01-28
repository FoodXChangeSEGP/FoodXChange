"""
Tests for Open Food Facts SearchService.
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.utils import timezone

from products.off_models import OFFProduct, SearchQueryCache
from products.search_service import SearchService


class SearchServiceURLConstructionTest(TestCase):
    """Test URL construction logic."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_build_search_url_basic(self):
        """Test basic URL construction with query."""
        url = self.service.build_search_url("chocolate")
        
        self.assertIn("action=process", url)
        self.assertIn("search_terms=chocolate", url)
        self.assertIn("format=csv", url)
        self.assertIn("download=on", url)
    
    def test_build_search_url_uk_geofence(self):
        """Test UK geo-fence parameters are included."""
        url = self.service.build_search_url("biscuits")
        
        self.assertIn("tagtype_0=countries", url)
        self.assertIn("tag_contains_0=contains", url)
        self.assertIn("tag_0=United+Kingdom", url)
    
    def test_build_search_url_ranking(self):
        """Test popularity ranking parameter."""
        url = self.service.build_search_url("milk")
        
        self.assertIn("sort_by=unique_scans_n", url)
    
    def test_build_search_url_pagination(self):
        """Test pagination parameters."""
        url = self.service.build_search_url("bread", page=2)
        
        self.assertIn("page=2", url)
        self.assertIn("page_size=100", url)


class SearchServiceDataCleaningTest(TestCase):
    """Test CSV data cleaning and processing pipeline."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_has_required_fields_complete(self):
        """Test product with all required fields passes."""
        product = {
            'code': '123456',
            'product_name': 'Test Product',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        
        self.assertTrue(self.service._has_required_fields(product))
    
    def test_has_required_fields_missing_code(self):
        """Test product missing code fails."""
        product = {
            'product_name': 'Test Product',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        
        self.assertFalse(self.service._has_required_fields(product))
    
    def test_has_required_fields_empty_name(self):
        """Test product with empty name fails."""
        product = {
            'code': '123456',
            'product_name': '',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        
        self.assertFalse(self.service._has_required_fields(product))
    
    def test_clean_data_filters_non_uk(self):
        """Test products not in UK are filtered out."""
        products = [
            {
                'code': '123456',
                'product_name': 'UK Product',
                'nutriscore_grade': 'a',
                'image_url': 'https://example.com/uk.jpg',
                'countries_en': 'United Kingdom, France',
            },
            {
                'code': '789012',
                'product_name': 'US Product',
                'nutriscore_grade': 'b',
                'image_url': 'https://example.com/us.jpg',
                'countries_en': 'United States',
            },
        ]
        
        cleaned = self.service.clean_data(products)
        
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]['product_name'], 'UK Product')
    
    def test_deduplicate_by_brand_and_name(self):
        """Test de-duplication keeps highest completeness."""
        products = [
            {
                'code': '111',
                'product_name': 'Chocolate Biscuits',
                'brands': 'TestBrand',
                'nutriscore_grade': 'c',
                'image_url': 'https://example.com/1.jpg',
                'countries_en': 'United Kingdom',
                'completeness': '0.5',
            },
            {
                'code': '222',
                'product_name': 'Chocolate Biscuits',  # Same name
                'brands': 'TestBrand',  # Same brand
                'nutriscore_grade': 'd',
                'image_url': 'https://example.com/2.jpg',
                'countries_en': 'United Kingdom',
                'completeness': '0.8',  # Higher completeness
            },
        ]
        
        cleaned = self.service.clean_data(products)
        
        # Should keep only the one with higher completeness
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]['code'], '222')
    
    def test_normalize_nutriscore(self):
        """Test nutriscore grade normalization."""
        self.assertEqual(self.service._normalize_nutriscore('A'), 'a')
        self.assertEqual(self.service._normalize_nutriscore('b'), 'b')
        self.assertEqual(self.service._normalize_nutriscore(''), 'unknown')
        self.assertEqual(self.service._normalize_nutriscore('X'), 'unknown')
    
    def test_parse_decimal(self):
        """Test decimal parsing."""
        self.assertEqual(self.service._parse_decimal('5.5'), Decimal('5.5'))
        self.assertIsNone(self.service._parse_decimal(''))
        self.assertIsNone(self.service._parse_decimal('invalid'))
    
    def test_parse_int(self):
        """Test integer parsing."""
        self.assertEqual(self.service._parse_int('3'), 3)
        self.assertEqual(self.service._parse_int('3.0'), 3)
        self.assertIsNone(self.service._parse_int(''))
        self.assertIsNone(self.service._parse_int('invalid'))


class SearchServiceStorageTest(TestCase):
    """Test database storage and upsert logic."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_store_products_creates_new(self):
        """Test storing new products."""
        products = [
            {
                'code': 'TEST123',
                'product_name': 'Test Chocolate',
                'brands': 'TestBrand',
                'nutriscore_grade': 'c',
                'image_url': 'https://example.com/test.jpg',
                'nova_group': '3',
                'sugars_100g': '15.5',
                'salt_100g': '0.5',
                'fat_100g': '10.0',
                'saturated-fat_100g': '5.0',
                'completeness': '0.75',
                'countries_en': 'United Kingdom',
                'categories_en': 'Snacks, Chocolate',
            }
        ]
        
        stored = self.service.store_products(products, 'chocolate')
        
        self.assertEqual(len(stored), 1)
        
        product = OFFProduct.objects.get(code='TEST123')
        self.assertEqual(product.product_name, 'Test Chocolate')
        self.assertEqual(product.brands, 'TestBrand')
        self.assertEqual(product.nutriscore_grade, 'c')
        self.assertEqual(product.nova_group, 3)
        self.assertEqual(product.sugars_100g, Decimal('15.5'))
        self.assertEqual(product.search_query, 'chocolate')
    
    def test_store_products_upsert_existing(self):
        """Test upserting existing product updates it."""
        # Create existing product
        OFFProduct.objects.create(
            code='EXISTING123',
            product_name='Old Name',
            nutriscore_grade='d',
        )
        
        products = [
            {
                'code': 'EXISTING123',
                'product_name': 'New Name',
                'brands': 'NewBrand',
                'nutriscore_grade': 'b',
                'image_url': 'https://example.com/new.jpg',
            }
        ]
        
        stored = self.service.store_products(products, 'test')
        
        self.assertEqual(len(stored), 1)
        self.assertEqual(OFFProduct.objects.count(), 1)  # No duplicate
        
        product = OFFProduct.objects.get(code='EXISTING123')
        self.assertEqual(product.product_name, 'New Name')
        self.assertEqual(product.nutriscore_grade, 'b')


class SearchServiceCacheTest(TestCase):
    """Test lazy loading and cache logic."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_update_query_cache(self):
        """Test cache entry creation."""
        self.service._update_query_cache('chocolate', 25)
        
        cache = SearchQueryCache.objects.get(query='chocolate')
        self.assertEqual(cache.result_count, 25)
        self.assertTrue(cache.is_complete)
    
    def test_cache_is_stale_after_24_hours(self):
        """Test cache staleness detection."""
        cache = SearchQueryCache.objects.create(
            query='old_query',
            result_count=10,
        )
        
        # Fresh cache
        self.assertFalse(cache.is_stale)
        
        # Simulate old cache
        from datetime import timedelta
        SearchQueryCache.objects.filter(pk=cache.pk).update(
            last_searched_at=timezone.now() - timedelta(hours=25)
        )
        cache.refresh_from_db()
        self.assertTrue(cache.is_stale)


class SearchServiceRankingTest(TestCase):
    """Test swap ranking logic."""
    
    def setUp(self):
        self.service = SearchService()
        
        # Create test products
        OFFProduct.objects.create(
            code='PROD_E4', product_name='Unhealthy E4',
            nutriscore_grade='e', nova_group=4,
            search_query='test'
        )
        OFFProduct.objects.create(
            code='PROD_A1', product_name='Healthy A1',
            nutriscore_grade='a', nova_group=1,
            search_query='test'
        )
        OFFProduct.objects.create(
            code='PROD_B2', product_name='Good B2',
            nutriscore_grade='b', nova_group=2,
            search_query='test'
        )
        OFFProduct.objects.create(
            code='PROD_A3', product_name='Mixed A3',
            nutriscore_grade='a', nova_group=3,
            search_query='test'
        )
    
    def test_swap_ranking_order(self):
        """Test products are ranked by nutriscore then nova."""
        queryset = OFFProduct.objects.filter(search_query='test')
        ranked = list(self.service._apply_swap_ranking(queryset))
        
        # Expected order: A1, A3, B2, E4
        self.assertEqual(ranked[0].code, 'PROD_A1')  # Best: A + Nova 1
        self.assertEqual(ranked[1].code, 'PROD_A3')  # A + Nova 3
        self.assertEqual(ranked[2].code, 'PROD_B2')  # B + Nova 2
        self.assertEqual(ranked[3].code, 'PROD_E4')  # Worst: E + Nova 4
    
    def test_swap_ranking_with_limit(self):
        """Test limit is applied correctly."""
        queryset = OFFProduct.objects.filter(search_query='test')
        ranked = list(self.service._apply_swap_ranking(queryset, limit=2))
        
        self.assertEqual(len(ranked), 2)
        self.assertEqual(ranked[0].code, 'PROD_A1')
        self.assertEqual(ranked[1].code, 'PROD_A3')


class OFFProductModelTest(TestCase):
    """Test OFFProduct model properties."""
    
    def test_nutriscore_rank_property(self):
        """Test nutriscore_rank calculation."""
        product_a = OFFProduct(nutriscore_grade='a')
        product_e = OFFProduct(nutriscore_grade='e')
        product_unknown = OFFProduct(nutriscore_grade='unknown')
        
        self.assertEqual(product_a.nutriscore_rank, 1)
        self.assertEqual(product_e.nutriscore_rank, 5)
        self.assertEqual(product_unknown.nutriscore_rank, 6)
    
    def test_nova_rank_property(self):
        """Test nova_rank calculation."""
        product_1 = OFFProduct(nova_group=1)
        product_4 = OFFProduct(nova_group=4)
        product_none = OFFProduct(nova_group=None)
        
        self.assertEqual(product_1.nova_rank, 1)
        self.assertEqual(product_4.nova_rank, 4)
        self.assertEqual(product_none.nova_rank, 5)
    
    def test_is_stale_property(self):
        """Test is_stale calculation."""
        from datetime import timedelta
        
        fresh_product = OFFProduct(last_fetched_at=timezone.now())
        self.assertFalse(fresh_product.is_stale)
        
        stale_product = OFFProduct(
            last_fetched_at=timezone.now() - timedelta(hours=25)
        )
        self.assertTrue(stale_product.is_stale)
