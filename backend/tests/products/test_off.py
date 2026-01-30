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
    
    def test_build_search_url_all_components(self):
        """Test URL construction includes all required components."""
        url = self.service.build_search_url("chocolate")
        
        # Basic components
        self.assertIn("action=process", url)
        self.assertIn("search_terms=chocolate", url)
        self.assertIn("json=true", url)
        # UK filtering via subdomain
        self.assertIn("uk.openfoodfacts.org", url)
        # Ranking parameter
        self.assertIn("sort_by=unique_scans_n", url)
    
    def test_build_search_url_pagination(self):
        """Test pagination parameters."""
        url = self.service.build_search_url("bread", page=2)
        
        self.assertIn("page=2", url)
        self.assertIn("page_size=50", url)


class SearchServiceDataCleaningTest(TestCase):
    """Test CSV data cleaning and processing pipeline."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_has_required_fields(self):
        """Test required fields validation."""
        # Complete product passes
        complete = {
            'code': '123456',
            'product_name': 'Test Product',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        self.assertTrue(self.service._has_required_fields(complete))
        
        # Missing code fails
        missing_code = {
            'product_name': 'Test Product',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        self.assertFalse(self.service._has_required_fields(missing_code))
        
        # Empty name fails
        empty_name = {
            'code': '123456',
            'product_name': '',
            'nutriscore_grade': 'b',
            'image_url': 'https://example.com/image.jpg'
        }
        self.assertFalse(self.service._has_required_fields(empty_name))
    
    def test_clean_data_removes_missing_fields(self):
        """Test products with missing required fields are filtered out."""
        products = [
            {
                'code': '123456',
                'product_name': 'Complete Product',
                'nutriscore_grade': 'a',
                'image_url': 'https://example.com/product.jpg',
            },
            {
                'code': '789012',
                'product_name': '',  # Empty name - should be filtered
                'nutriscore_grade': 'b',
                'image_url': 'https://example.com/no-name.jpg',
            },
        ]
        
        cleaned = self.service.clean_data(products)
        
        self.assertEqual(len(cleaned), 1)
        self.assertEqual(cleaned[0]['product_name'], 'Complete Product')
    
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
        # Valid grades normalize to lowercase
        self.assertEqual(self.service._normalize_nutriscore('A'), 'a')
        self.assertEqual(self.service._normalize_nutriscore('b'), 'b')
        # Invalid grades become 'unknown'
        self.assertEqual(self.service._normalize_nutriscore(''), 'unknown')
        self.assertEqual(self.service._normalize_nutriscore('X'), 'unknown')
    
    def test_parse_decimal_and_int(self):
        """Test decimal and integer parsing helpers."""
        # Valid decimal parsing
        self.assertEqual(self.service._parse_decimal('5.5'), Decimal('5.5'))
        self.assertIsNone(self.service._parse_decimal(''))
        self.assertIsNone(self.service._parse_decimal('invalid'))
        
        # Valid integer parsing
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


# =============================================================================
# View Tests - OFFSearchView
# =============================================================================

from django.urls import reverse
from rest_framework.test import APITestCase, APIRequestFactory
from rest_framework import status


class OFFSearchViewParameterParsingTest(APITestCase):
    """Test query parameter parsing in OFFSearchView.
    
    These tests verify that edge cases in parameter parsing are handled
    correctly, especially the empty string cases that can cause bugs.
    """
    
    def setUp(self):
        """Create test products for search results."""
        # Create products with different nutriscore and nova values
        OFFProduct.objects.create(
            code='TEST_A1', product_name='Healthy Product A1',
            nutriscore_grade='a', nova_group=1,
            image_url='https://example.com/a1.jpg',
            search_query='test_product', completeness=Decimal('0.9')
        )
        OFFProduct.objects.create(
            code='TEST_B2', product_name='Good Product B2',
            nutriscore_grade='b', nova_group=2,
            image_url='https://example.com/b2.jpg',
            search_query='test_product', completeness=Decimal('0.8')
        )
        OFFProduct.objects.create(
            code='TEST_C3', product_name='Average Product C3',
            nutriscore_grade='c', nova_group=3,
            image_url='https://example.com/c3.jpg',
            search_query='test_product', completeness=Decimal('0.7')
        )
        OFFProduct.objects.create(
            code='TEST_D4', product_name='Poor Product D4',
            nutriscore_grade='d', nova_group=4,
            image_url='https://example.com/d4.jpg',
            search_query='test_product', completeness=Decimal('0.6')
        )
        OFFProduct.objects.create(
            code='TEST_UNKNOWN', product_name='Unknown Product',
            nutriscore_grade='unknown', nova_group=None,
            image_url='https://example.com/unknown.jpg',
            search_query='test_product', completeness=Decimal('0.5')
        )
        
        # Create cache entry so the view doesn't try to fetch from OFF API
        SearchQueryCache.objects.create(
            query='test_product',
            result_count=5,
            is_complete=True
        )
    
    def test_empty_nutriscore_filter_returns_all_results(self):
        """Test that empty nutriscore parameter doesn't filter out all products.
        
        This is the bug we fixed: '' in 'abcde' is True in Python, so an empty
        string was being included in the filter list as [''], which then filtered
        out all products because no product has nutriscore_grade=''.
        """
        response = self.client.get('/api/off/search/', {'q': 'test_product'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return all 5 products, not 0
        self.assertGreater(response.data['total_count'], 0)
    
    def test_nutriscore_filter_comprehensive(self):
        """Test nutriscore filter with various input formats."""
        # Valid comma-separated values
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nutriscore': 'a,b'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nutriscore_grade'], ['a', 'b'])
        
        # Handles whitespace correctly
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nutriscore': ' a , b '
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nutriscore_grade'], ['a', 'b'])
        
        # Invalid values are silently ignored, case-insensitive
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nutriscore': 'A,x,z,B'  # x and z invalid, uppercase valid
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nutriscore_grade'], ['a', 'b'])
    
    def test_empty_nova_filter_returns_all_results(self):
        """Test that empty nova_group parameter doesn't filter out all products."""
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nova_group': ''
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['total_count'], 0)
    
    def test_nova_filter_comprehensive(self):
        """Test nova filter with various input formats."""
        # Valid comma-separated values
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nova_group': '1,2'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nova_group'], [1, 2])
        
        # Invalid values (0, 5, strings) are silently ignored
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nova_group': '0,1,5,abc,2'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nova_group'], [1, 2])
        
        # Handles whitespace correctly
        response = self.client.get('/api/off/search/', {
            'q': 'test_product',
            'nova_group': ' 1 , 2 '
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for product in response.data['results']:
            self.assertIn(product['nova_group'], [1, 2])


class OFFSearchViewPaginationTest(APITestCase):
    """Test pagination parameter handling in OFFSearchView."""
    
    def setUp(self):
        """Create many test products for pagination testing."""
        for i in range(50):
            OFFProduct.objects.create(
                code=f'PAGI_{i:03d}',
                product_name=f'Pagination Test Product {i}',
                nutriscore_grade='a',
                nova_group=1,
                image_url=f'https://example.com/{i}.jpg',
                search_query='pagination_test',
                completeness=Decimal(f'0.{50 - i:04d}')  # Vary completeness 0.0050 to 0.0001
            )
        
        SearchQueryCache.objects.create(
            query='pagination_test',
            result_count=50,
            is_complete=True
        )
    
    def test_default_pagination(self):
        """Test default page and page_size values."""
        response = self.client.get('/api/off/search/', {'q': 'pagination_test'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['page'], 1)
        self.assertEqual(response.data['page_size'], 20)
        self.assertEqual(len(response.data['results']), 20)
    
    def test_custom_page_size(self):
        """Test custom page_size parameter."""
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page_size': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['page_size'], 10)
        self.assertEqual(len(response.data['results']), 10)
    
    def test_page_size_limits_and_invalid_values(self):
        """Test page_size bounds and invalid value handling."""
        # Capped at 100 (max limit)
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page_size': 500
        })
        self.assertEqual(response.data['page_size'], 100)
        
        # Clamped to 1 (min limit)
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page_size': 0
        })
        self.assertEqual(response.data['page_size'], 1)
        
        # Invalid value uses default
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page_size': 'abc'
        })
        self.assertEqual(response.data['page_size'], 20)
    
    def test_page_number_edge_cases(self):
        """Test page number with invalid and edge case values."""
        # Invalid page uses default
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page': 'abc'
        })
        self.assertEqual(response.data['page'], 1)
        
        # Negative page clamped to 1
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page': -5
        })
        self.assertEqual(response.data['page'], 1)
    
    def test_second_page(self):
        """Test accessing second page of results."""
        response = self.client.get('/api/off/search/', {
            'q': 'pagination_test',
            'page': 2,
            'page_size': 10
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['page'], 2)
        self.assertEqual(len(response.data['results']), 10)
        self.assertTrue(response.data['has_previous'])
        self.assertTrue(response.data['has_next'])


class OFFSearchViewSortingTest(APITestCase):
    """Test sorting parameter handling in OFFSearchView."""
    
    def setUp(self):
        """Create products with varied scores for sorting tests."""
        OFFProduct.objects.create(
            code='SORT_E4', product_name='Apple Pie',
            nutriscore_grade='e', nova_group=4,
            image_url='https://example.com/e4.jpg',
            search_query='sort_test', completeness=Decimal('0.9')
        )
        OFFProduct.objects.create(
            code='SORT_A1', product_name='Zebra Oats',
            nutriscore_grade='a', nova_group=1,
            image_url='https://example.com/a1.jpg',
            search_query='sort_test', completeness=Decimal('0.5')
        )
        OFFProduct.objects.create(
            code='SORT_C2', product_name='Banana Chips',
            nutriscore_grade='c', nova_group=2,
            image_url='https://example.com/c2.jpg',
            search_query='sort_test', completeness=Decimal('0.7')
        )
        
        SearchQueryCache.objects.create(
            query='sort_test',
            result_count=3,
            is_complete=True
        )
    
    def test_default_sort_is_relevance(self):
        """Test default sort order is relevance (by completeness)."""
        response = self.client.get('/api/off/search/', {'q': 'sort_test'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Sorted by completeness descending: E4 (0.9), C2 (0.7), A1 (0.5)
        self.assertEqual(response.data['results'][0]['code'], 'SORT_E4')
    
    def test_sort_by_health_scores(self):
        """Test sorting by nutriscore and nova (healthiest/least processed first)."""
        # Sort by nutriscore
        response = self.client.get('/api/off/search/', {
            'q': 'sort_test',
            'sort_by': 'nutriscore'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['code'], 'SORT_A1')
        self.assertEqual(response.data['results'][1]['code'], 'SORT_C2')
        self.assertEqual(response.data['results'][2]['code'], 'SORT_E4')
        
        # Sort by nova (same order for this test data)
        response = self.client.get('/api/off/search/', {
            'q': 'sort_test',
            'sort_by': 'nova'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['code'], 'SORT_A1')
        self.assertEqual(response.data['results'][2]['code'], 'SORT_E4')
    
    def test_sort_by_name(self):
        """Test sorting alphabetically by name."""
        response = self.client.get('/api/off/search/', {
            'q': 'sort_test',
            'sort_by': 'name'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Sorted alphabetically: Apple Pie, Banana Chips, Zebra Oats
        self.assertEqual(response.data['results'][0]['code'], 'SORT_E4')  # Apple Pie
        self.assertEqual(response.data['results'][1]['code'], 'SORT_C2')  # Banana Chips
        self.assertEqual(response.data['results'][2]['code'], 'SORT_A1')  # Zebra Oats
    
    def test_sort_by_edge_cases(self):
        """Test invalid sort option falls back to relevance, case-insensitive."""
        # Invalid option uses default relevance sort
        response = self.client.get('/api/off/search/', {
            'q': 'sort_test',
            'sort_by': 'invalid_option'
        })
        self.assertEqual(response.data['results'][0]['code'], 'SORT_E4')
        
        # Case-insensitive
        response = self.client.get('/api/off/search/', {
            'q': 'sort_test',
            'sort_by': 'NUTRISCORE'
        })
        self.assertEqual(response.data['results'][0]['code'], 'SORT_A1')


class OFFSearchViewBooleanParametersTest(APITestCase):
    """Test boolean parameter parsing in OFFSearchView."""
    
    def setUp(self):
        """Create products for boolean filter tests."""
        OFFProduct.objects.create(
            code='BOOL_KNOWN', product_name='Known Product',
            nutriscore_grade='a', nova_group=1,
            image_url='https://example.com/known.jpg',
            search_query='bool_test', completeness=Decimal('0.9')
        )
        OFFProduct.objects.create(
            code='BOOL_NO_NOVA', product_name='No Nova Product',
            nutriscore_grade='b', nova_group=None,
            image_url='https://example.com/nonova.jpg',
            search_query='bool_test', completeness=Decimal('0.8')
        )
        OFFProduct.objects.create(
            code='BOOL_UNKNOWN', product_name='Unknown Nutriscore Product',
            nutriscore_grade='unknown', nova_group=2,
            image_url='https://example.com/unknown.jpg',
            search_query='bool_test', completeness=Decimal('0.7')
        )
        
        SearchQueryCache.objects.create(
            query='bool_test',
            result_count=3,
            is_complete=True
        )
    
    def test_exclude_no_nova(self):
        """Test exclude_no_nova parameter with true and false values."""
        # True filters out products without NOVA
        response = self.client.get('/api/off/search/', {
            'q': 'bool_test',
            'exclude_no_nova': 'true'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [p['code'] for p in response.data['results']]
        self.assertNotIn('BOOL_NO_NOVA', codes)
        
        # False includes products without NOVA
        response = self.client.get('/api/off/search/', {
            'q': 'bool_test',
            'exclude_no_nova': 'false'
        })
        codes = [p['code'] for p in response.data['results']]
        self.assertIn('BOOL_NO_NOVA', codes)
    
    def test_exclude_no_nutriscore(self):
        """Test exclude_no_nutriscore=true filters out unknown nutriscore."""
        response = self.client.get('/api/off/search/', {
            'q': 'bool_test',
            'exclude_no_nutriscore': 'true'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [p['code'] for p in response.data['results']]
        self.assertNotIn('BOOL_UNKNOWN', codes)
    
    def test_boolean_params_edge_cases(self):
        """Test boolean parameters are case-insensitive and invalid defaults to false."""
        # Case-insensitive
        response = self.client.get('/api/off/search/', {
            'q': 'bool_test',
            'exclude_no_nova': 'TRUE',
            'exclude_no_nutriscore': 'True'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [p['code'] for p in response.data['results']]
        self.assertNotIn('BOOL_NO_NOVA', codes)
        self.assertNotIn('BOOL_UNKNOWN', codes)
        
        # Invalid value defaults to false
        response = self.client.get('/api/off/search/', {
            'q': 'bool_test',
            'exclude_no_nova': 'yes'  # Invalid - not 'true'
        })
        codes = [p['code'] for p in response.data['results']]
        self.assertIn('BOOL_NO_NOVA', codes)


class OFFSearchViewErrorHandlingTest(APITestCase):
    """Test error handling in OFFSearchView."""
    
    def test_invalid_query_returns_400(self):
        """Test missing, empty, and whitespace-only queries return 400 Bad Request."""
        # Missing q parameter
        response = self.client.get('/api/off/search/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        
        # Empty q parameter
        response = self.client.get('/api/off/search/', {'q': ''})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        
        # Whitespace-only q parameter
        response = self.client.get('/api/off/search/', {'q': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)


class SearchServiceQueryNormalizationTest(TestCase):
    """Test query normalization logic in SearchService."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_normalize_stop_words_and_meaningful_words(self):
        """Test stop words are removed and meaningful words preserved."""
        # Stop words removed
        self.assertEqual(self.service.normalize_query('loaf of bread'), 'bread')
        self.assertEqual(self.service.normalize_query('a packet of biscuits'), 'biscuits')
        self.assertEqual(self.service.normalize_query('some fresh milk'), 'milk')
        
        # Meaningful words preserved
        self.assertEqual(self.service.normalize_query('wholemeal bread'), 'wholemeal bread')
        self.assertEqual(self.service.normalize_query('chocolate chip cookies'), 'chocolate chip cookies')
    
    def test_normalize_edge_cases(self):
        """Test normalization handles edge cases: empty result and case conversion."""
        # All stop words returns empty
        self.assertEqual(self.service.normalize_query('a the of'), '')
        
        # Case-insensitive
        self.assertEqual(self.service.normalize_query('BREAD'), 'bread')
        self.assertEqual(self.service.normalize_query('Loaf Of Bread'), 'bread')


class SearchServiceFalsePositiveFilterTest(TestCase):
    """Test false positive filtering logic in SearchService."""
    
    def setUp(self):
        self.service = SearchService()
    
    def test_false_positive_filtering(self):
        """Test false positives are filtered based on search query context."""
        # 'bread flour' filtered when searching for 'bread'
        bread_products = [
            {'product_name': 'Whole Wheat Bread', 'categories_en': 'Bread'},
            {'product_name': 'Bread Flour', 'categories_en': 'Flour, Baking'},
            {'product_name': 'White Bread', 'categories_en': 'Bread'},
        ]
        filtered = self.service.filter_false_positives(bread_products, 'bread')
        names = [p['product_name'] for p in filtered]
        self.assertIn('Whole Wheat Bread', names)
        self.assertNotIn('Bread Flour', names)
        
        # 'bread flour' NOT filtered when searching for 'flour'
        flour_products = [
            {'product_name': 'Bread Flour', 'categories_en': 'Flour, Baking'},
            {'product_name': 'Plain Flour', 'categories_en': 'Flour'},
        ]
        filtered = self.service.filter_false_positives(flour_products, 'flour')
        names = [p['product_name'] for p in filtered]
        self.assertIn('Bread Flour', names)
        
        # 'cake mix' filtered when searching for 'cake'
        cake_products = [
            {'product_name': 'Chocolate Cake', 'categories_en': 'Cakes'},
            {'product_name': 'Cake Mix', 'categories_en': 'Baking Mix'},
        ]
        filtered = self.service.filter_false_positives(cake_products, 'cake')
        names = [p['product_name'] for p in filtered]
        self.assertIn('Chocolate Cake', names)
        self.assertNotIn('Cake Mix', names)


class SearchServiceRankingAndFiltersTest(TestCase):
    """Test the _apply_ranking_and_filters method comprehensively."""
    
    def setUp(self):
        self.service = SearchService()
        
        # Create diverse test products
        OFFProduct.objects.create(
            code='RANK_A1', product_name='Product A1',
            nutriscore_grade='a', nova_group=1,
            search_query='rank_test', completeness=Decimal('0.9')
        )
        OFFProduct.objects.create(
            code='RANK_B2', product_name='Product B2',
            nutriscore_grade='b', nova_group=2,
            search_query='rank_test', completeness=Decimal('0.8')
        )
        OFFProduct.objects.create(
            code='RANK_C3', product_name='Product C3',
            nutriscore_grade='c', nova_group=3,
            search_query='rank_test', completeness=Decimal('0.7')
        )
        OFFProduct.objects.create(
            code='RANK_UNKNOWN', product_name='Product Unknown',
            nutriscore_grade='unknown', nova_group=None,
            search_query='rank_test', completeness=Decimal('0.6')
        )
    
    def test_nutriscore_filter_variations(self):
        """Test nutriscore_filter with list, None, and empty list."""
        queryset = OFFProduct.objects.filter(search_query='rank_test')
        
        # Valid list filters products
        result = self.service._apply_ranking_and_filters(
            queryset, nutriscore_filter=['a', 'b']
        )
        codes = [p.code for p in result]
        self.assertIn('RANK_A1', codes)
        self.assertIn('RANK_B2', codes)
        self.assertNotIn('RANK_C3', codes)
        
        # None returns all
        result = self.service._apply_ranking_and_filters(
            queryset, nutriscore_filter=None
        )
        self.assertEqual(result.count(), 4)
        
        # Empty list is handled (view converts to None)
        result = self.service._apply_ranking_and_filters(
            queryset, nutriscore_filter=[]
        )
        self.assertEqual(result.count(), 4)
    
    def test_nova_filter_with_list(self):
        """Test nova_filter with a valid list."""
        queryset = OFFProduct.objects.filter(search_query='rank_test')
        result = self.service._apply_ranking_and_filters(
            queryset,
            nova_filter=[1, 2]
        )
        
        codes = [p.code for p in result]
        self.assertIn('RANK_A1', codes)
        self.assertIn('RANK_B2', codes)
        self.assertNotIn('RANK_C3', codes)
    
    def test_exclude_filters(self):
        """Test exclude_no_nova and exclude_no_nutriscore filters."""
        queryset = OFFProduct.objects.filter(search_query='rank_test')
        
        # exclude_no_nova removes products without NOVA
        result = self.service._apply_ranking_and_filters(
            queryset, exclude_no_nova=True
        )
        codes = [p.code for p in result]
        self.assertNotIn('RANK_UNKNOWN', codes)
        self.assertEqual(result.count(), 3)
        
        # exclude_no_nutriscore removes products with unknown grade
        result = self.service._apply_ranking_and_filters(
            queryset, exclude_no_nutriscore=True
        )
        codes = [p.code for p in result]
        self.assertNotIn('RANK_UNKNOWN', codes)
        self.assertEqual(result.count(), 3)
    
    def test_combined_filters(self):
        """Test multiple filters applied together."""
        queryset = OFFProduct.objects.filter(search_query='rank_test')
        result = self.service._apply_ranking_and_filters(
            queryset,
            nutriscore_filter=['a', 'b', 'c'],
            nova_filter=[1, 2],
            exclude_no_nova=True,
            exclude_no_nutriscore=True
        )
        
        # Should only match A1 and B2 (nutri a/b/c AND nova 1/2)
        codes = [p.code for p in result]
        self.assertIn('RANK_A1', codes)
        self.assertIn('RANK_B2', codes)
        self.assertNotIn('RANK_C3', codes)  # nova 3 excluded
        self.assertNotIn('RANK_UNKNOWN', codes)  # unknown nutri excluded

