"""
Tests for grocer services.

These tests verify the grocer service layer and API endpoints.
"""

import json
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

from products.grocer_services import (
    get_grocer_service,
    get_available_grocers,
    GROCER_SERVICES,
)
from products.grocer_services.base import (
    GrocerProduct,
    GrocerSearchResult,
    GrocerPrice,
    GrocerPromotion,
    PriceMeasure,
    parse_price_measure,
)
from products.grocer_services.sainsburys import SainsburysService
from products.grocer_services.tesco import TescoService


class GrocerServiceRegistryTests(TestCase):
    """Tests for the grocer service registry."""
    
    def test_get_available_grocers(self):
        """Test that available grocers list is not empty."""
        grocers = get_available_grocers()
        self.assertIn('sainsburys', grocers)
        self.assertIn('tesco', grocers)
    
    def test_get_grocer_service_valid(self):
        """Test getting a valid grocer service."""
        service = get_grocer_service('sainsburys')
        self.assertIsInstance(service, SainsburysService)
    
    def test_get_grocer_service_case_insensitive(self):
        """Test that grocer ID is case-insensitive."""
        service = get_grocer_service('SAINSBURYS')
        self.assertIsInstance(service, SainsburysService)
    
    def test_get_grocer_service_invalid(self):
        """Test that invalid grocer ID raises ValueError."""
        with self.assertRaises(ValueError) as context:
            get_grocer_service('nonexistent')
        self.assertIn('Unknown grocer', str(context.exception))


class GrocerProductTests(TestCase):
    """Tests for GrocerProduct dataclass."""
    
    def test_get_effective_price_no_promotion(self):
        """Test effective price without promotions."""
        product = GrocerProduct(
            grocer_id='test',
            product_id='123',
            name='Test Product',
            retail_price=GrocerPrice(price=Decimal('2.50')),
        )
        self.assertEqual(product.get_effective_price(), Decimal('2.50'))
    
    def test_get_effective_price_with_promotion(self):
        """Test effective price with promotion."""
        product = GrocerProduct(
            grocer_id='test',
            product_id='123',
            name='Test Product',
            retail_price=GrocerPrice(price=Decimal('2.00')),
            promotions=[
                GrocerPromotion(
                    description='Sale!',
                    original_price=Decimal('2.50'),
                    promo_price=Decimal('2.00'),
                )
            ],
        )
        self.assertEqual(product.get_effective_price(), Decimal('2.00'))
    
    def test_get_primary_barcode(self):
        """Test getting primary barcode."""
        product = GrocerProduct(
            grocer_id='test',
            product_id='123',
            name='Test Product',
            barcodes=['5000000000000', '1234567890123'],
        )
        self.assertEqual(product.get_primary_barcode(), '5000000000000')
    
    def test_get_primary_barcode_empty(self):
        """Test getting primary barcode when empty."""
        product = GrocerProduct(
            grocer_id='test',
            product_id='123',
            name='Test Product',
            barcodes=[],
        )
        self.assertIsNone(product.get_primary_barcode())


class GrocerSearchResultTests(TestCase):
    """Tests for GrocerSearchResult dataclass."""
    
    def test_total_pages_calculation(self):
        """Test total pages calculation."""
        result = GrocerSearchResult(
            products=[],
            total_count=95,
            page=1,
            page_size=20,
            has_more=True,
        )
        self.assertEqual(result.total_pages, 5)
    
    def test_total_pages_exact_division(self):
        """Test total pages with exact division."""
        result = GrocerSearchResult(
            products=[],
            total_count=100,
            page=1,
            page_size=20,
            has_more=True,
        )
        self.assertEqual(result.total_pages, 5)


class SainsburysServiceTests(TestCase):
    """Tests for Sainsbury's service."""
    
    def setUp(self):
        self.service = SainsburysService()
    
    def test_service_attributes(self):
        """Test service has correct attributes."""
        self.assertEqual(self.service.GROCER_ID, 'sainsburys')
        self.assertEqual(self.service.GROCER_NAME, "Sainsbury's")
    
    def test_parse_price_measure(self):
        """Test price measure parsing."""
        self.assertEqual(
            parse_price_measure('unit'),
            PriceMeasure.UNIT
        )
        self.assertEqual(
            parse_price_measure('kg'),
            PriceMeasure.KG
        )
        self.assertEqual(
            parse_price_measure('ltr'),
            PriceMeasure.LITRE
        )
    
    def test_parse_product(self):
        """Test product parsing from API response."""
        sample_data = {
            'product_uid': '1234567',
            'name': 'Test Orange Juice 1L',
            'eans': ['5000000000001'],
            'retail_price': {'price': 2.50, 'measure': 'unit'},
            'unit_price': {'price': 2.50, 'measure': 'ltr', 'measure_amount': 1},
            'is_available': True,
            'categories': [{'id': '123', 'name': 'Juice'}],
            'attributes': {'brand': ['Tropicana']},
            'image': 'https://example.com/image.jpg',
            'full_url': 'https://www.sainsburys.co.uk/product/123',
            'reviews': {'total': 10, 'average_rating': 4.5},
            'promotions': [],
        }
        
        product = self.service._parse_product(sample_data)
        
        self.assertEqual(product.grocer_id, 'sainsburys')
        self.assertEqual(product.product_id, '1234567')
        self.assertEqual(product.name, 'Test Orange Juice 1L')
        self.assertEqual(product.barcodes, ['5000000000001'])
        self.assertEqual(product.retail_price.price, Decimal('2.50'))
        self.assertEqual(product.brand, 'Tropicana')
        self.assertIn('Juice', product.categories)
        self.assertEqual(product.rating, 4.5)
        self.assertEqual(product.review_count, 10)
    
    def test_parse_product_with_promotion(self):
        """Test product parsing with promotions."""
        sample_data = {
            'product_uid': '1234567',
            'name': 'Test Orange Juice 1L',
            'eans': ['5000000000001'],
            'retail_price': {'price': 2.00, 'measure': 'unit'},
            'is_available': True,
            'promotions': [{
                'strap_line': 'Buy 2 for £3',
                'original_price': 2.50,
                'start_date': '2026-01-01',
                'end_date': '2026-02-01',
            }],
            'categories': [],
            'attributes': {},
        }
        
        product = self.service._parse_product(sample_data)
        
        self.assertTrue(product.retail_price.is_on_sale)
        self.assertEqual(product.retail_price.original_price, Decimal('2.50'))
        self.assertEqual(len(product.promotions), 1)
        self.assertEqual(product.promotions[0].description, 'Buy 2 for £3')


class TescoServiceTests(TestCase):
    """Tests for Tesco service."""

    def setUp(self):
        self.service = TescoService()

    def test_service_attributes(self):
        """Test service has correct attributes."""
        self.assertEqual(self.service.GROCER_ID, 'tesco')
        self.assertEqual(self.service.GROCER_NAME, 'Tesco')

    def test_parse_price_measure(self):
        """Test price measure parsing."""
        self.assertEqual(
            parse_price_measure('each'),
            PriceMeasure.UNIT
        )
        self.assertEqual(
            parse_price_measure('kg'),
            PriceMeasure.KG
        )
        self.assertEqual(
            parse_price_measure('ltr'),
            PriceMeasure.LITRE
        )
        self.assertEqual(
            parse_price_measure('100ml'),
            PriceMeasure.ML_100
        )
        self.assertEqual(
            parse_price_measure(None),
            PriceMeasure.UNIT
        )

    def test_parse_product(self):
        """Test product parsing from API response."""
        sample_data = {
            'id': '12345678',
            'title': 'Tropicana Orange Juice 1L',
            'shortDescription': 'Pure orange juice',
            'gtin': '5000000000001',
            'brandName': 'Tropicana',
            'defaultImageUrl': 'https://example.com/image.jpg',
            'superDepartmentName': 'Drinks',
            'departmentName': 'Fruit Juice',
            'aisleName': 'Orange Juice',
            'shelfName': 'Chilled Juice',
            'sellers': {
                'results': [{
                    'isForSale': True,
                    'price': {
                        'actual': 2.50,
                        'unitPrice': 2.50,
                        'unitOfMeasure': 'ltr',
                    },
                    'promotions': [],
                }],
            },
            'reviews': {
                'stats': {
                    'noOfReviews': 25,
                    'overallRating': 4.2,
                },
            },
        }

        product = self.service._parse_product(sample_data)

        self.assertEqual(product.grocer_id, 'tesco')
        self.assertEqual(product.product_id, '12345678')
        self.assertEqual(product.name, 'Tropicana Orange Juice 1L')
        self.assertEqual(product.description, 'Pure orange juice')
        self.assertEqual(product.barcodes, ['5000000000001'])
        self.assertEqual(product.retail_price.price, Decimal('2.50'))
        self.assertEqual(product.brand, 'Tropicana')
        self.assertIn('Drinks', product.categories)
        self.assertIn('Fruit Juice', product.categories)
        self.assertEqual(product.rating, 4.2)
        self.assertEqual(product.review_count, 25)
        self.assertTrue(product.is_available)

    def test_parse_product_with_promotion(self):
        """Test product parsing with promotions."""
        sample_data = {
            'id': '12345678',
            'title': 'Tropicana Orange Juice 1L',
            'gtin': '5000000000001',
            'sellers': {
                'results': [{
                    'isForSale': True,
                    'price': {
                        'actual': 2.00,
                        'unitPrice': 2.00,
                        'unitOfMeasure': 'ltr',
                    },
                    'promotions': [{
                        'description': 'Clubcard Price',
                        'price': {
                            'beforeDiscount': 2.50,
                            'afterDiscount': 2.00,
                        },
                        'startDate': '2026-01-01',
                        'endDate': '2026-02-01',
                    }],
                }],
            },
        }

        product = self.service._parse_product(sample_data)

        self.assertTrue(product.retail_price.is_on_sale)
        self.assertEqual(product.retail_price.original_price, Decimal('2.50'))
        self.assertEqual(len(product.promotions), 1)
        self.assertEqual(product.promotions[0].description, 'Clubcard Price')
        self.assertEqual(product.promotions[0].promo_price, Decimal('2.00'))

    def test_parse_product_not_for_sale(self):
        """Test product parsing when not for sale."""
        sample_data = {
            'id': '12345678',
            'title': 'Unavailable Product',
            'sellers': {
                'results': [{
                    'isForSale': False,
                    'price': {'actual': 2.50},
                    'promotions': [],
                }],
            },
        }

        product = self.service._parse_product(sample_data)
        self.assertFalse(product.is_available)

    def test_generate_trace_id(self):
        """Test trace ID generation."""
        trace_id1 = self.service._generate_trace_id()
        trace_id2 = self.service._generate_trace_id()
        
        # Should be valid UUIDs and unique
        self.assertIsInstance(trace_id1, str)
        self.assertNotEqual(trace_id1, trace_id2)
        self.assertEqual(len(trace_id1), 36)  # UUID format


class GrocerAPITests(APITestCase):
    """Tests for grocer API endpoints."""
    
    def test_grocer_list(self):
        """Test listing available grocers."""
        response = self.client.get('/api/grocers/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        # Check that Sainsbury's is in the list
        grocer_ids = [g['id'] for g in response.data]
        self.assertIn('sainsburys', grocer_ids)
    
    def test_grocer_search_missing_query(self):
        """Test search without query returns error."""
        response = self.client.get('/api/grocers/sainsburys/search/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_grocer_search_invalid_grocer(self):
        """Test search with invalid grocer returns 404."""
        response = self.client.get('/api/grocers/invalid/search/?q=test')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    @patch.object(SainsburysService, 'search_products')
    def test_grocer_search_success(self, mock_search):
        """Test successful search."""
        # Mock the search response
        mock_search.return_value = GrocerSearchResult(
            products=[
                GrocerProduct(
                    grocer_id='sainsburys',
                    product_id='123',
                    name='Orange Juice 1L',
                    retail_price=GrocerPrice(price=Decimal('2.00')),
                )
            ],
            total_count=1,
            page=1,
            page_size=20,
            has_more=False,
        )
        
        response = self.client.get('/api/grocers/sainsburys/search/?q=orange')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_count'], 1)
        self.assertEqual(len(response.data['products']), 1)
        self.assertEqual(response.data['products'][0]['name'], 'Orange Juice 1L')
    
    @patch.object(SainsburysService, 'get_product_by_id')
    def test_grocer_product_detail(self, mock_get):
        """Test getting product details."""
        mock_get.return_value = GrocerProduct(
            grocer_id='sainsburys',
            product_id='123',
            name='Orange Juice 1L',
            retail_price=GrocerPrice(price=Decimal('2.00')),
        )
        
        response = self.client.get('/api/grocers/sainsburys/products/123/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['product_id'], '123')
    
    @patch.object(SainsburysService, 'get_product_by_id')
    def test_grocer_product_not_found(self, mock_get):
        """Test product not found returns 404."""
        mock_get.return_value = None
        
        response = self.client.get('/api/grocers/sainsburys/products/999/')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SainsburysIntegrationTests(TestCase):
    """
    Integration tests that make real API calls to Sainsbury's.
    
    These tests are skipped by default. Run with:
    python manage.py test products.tests_grocers.SainsburysIntegrationTests --tag=integration
    
    Note: These tests may fail if Sainsbury's API is rate limiting or unavailable.
    """
    
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.service = SainsburysService()
    
    def test_search_products_live(self):
        """Test live search against Sainsbury's API."""
        result = self.service.search_products('orange juice', page_size=5)
        
        # Basic assertions - result should be valid structure even if empty
        self.assertIsInstance(result, GrocerSearchResult)
        
        # Skip further assertions if no results (API might be rate limiting)
        if result.total_count == 0:
            self.skipTest("Sainsbury's API returned no results (may be rate limiting)")
        
        self.assertGreater(len(result.products), 0)
        
        # Check first product has required fields
        product = result.products[0]
        self.assertEqual(product.grocer_id, 'sainsburys')
        self.assertTrue(product.product_id)
        self.assertTrue(product.name)
        self.assertIsNotNone(product.retail_price)

    test_search_products_live.tags = ['integration']


class TescoIntegrationTests(TestCase):
    """
    Integration tests that make real API calls to Tesco.
    
    These tests are skipped by default. Run with:
    python manage.py test products.tests_grocers.TescoIntegrationTests --tag=integration
    
    Note: These tests may fail if Tesco's API is rate limiting or unavailable.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.service = TescoService()

    def test_search_products_live(self):
        """Test live search against Tesco's API."""
        result = self.service.search_products('orange juice', page_size=5)

        # Basic assertions - result should be valid structure even if empty
        self.assertIsInstance(result, GrocerSearchResult)

        # Skip further assertions if no results (API might be rate limiting)
        if result.total_count == 0:
            self.skipTest("Tesco API returned no results (may be rate limiting)")

        self.assertGreater(len(result.products), 0)

        # Check first product has required fields
        product = result.products[0]
        self.assertEqual(product.grocer_id, 'tesco')
        self.assertTrue(product.product_id)
        self.assertTrue(product.name)
        self.assertIsNotNone(product.retail_price)

    test_search_products_live.tags = ['integration']
