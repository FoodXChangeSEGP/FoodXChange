"""
Tests for Combined Search Service.

Tests the deduplication, relevance scoring, and nutrition enrichment
functionality of the combined grocer search.
"""

from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from products.combined_search_service import (
    CombinedSearchService,
    CombinedProduct,
    CombinedSearchResult,
    RetailerPrice,
    NutritionData,
)
from products.combined_search_serializers import (
    CombinedProductSerializer,
    CombinedSearchResultSerializer,
    NutritionDataSerializer,
)
from products.grocer_services.base import (
    GrocerProduct,
    GrocerSearchResult,
    GrocerPrice,
    PriceMeasure,
)


class CombinedProductTests(TestCase):
    """Tests for CombinedProduct dataclass."""
    
    def test_calculate_cheapest_single_retailer(self):
        """Test cheapest calculation with single retailer."""
        product = CombinedProduct(
            barcode="1234567890123",
            name="Test Product",
            prices=[
                RetailerPrice(
                    grocer_id="tesco",
                    grocer_name="Tesco",
                    price=Decimal("2.50"),
                    product_id="123",
                ),
            ],
        )
        product.calculate_cheapest()
        
        self.assertEqual(product.cheapest_price, Decimal("2.50"))
        self.assertEqual(product.cheapest_retailer, "tesco")
    
    def test_calculate_cheapest_multiple_retailers(self):
        """Test cheapest calculation with multiple retailers."""
        product = CombinedProduct(
            barcode="1234567890123",
            name="Test Product",
            prices=[
                RetailerPrice(
                    grocer_id="tesco",
                    grocer_name="Tesco",
                    price=Decimal("2.50"),
                    product_id="123",
                ),
                RetailerPrice(
                    grocer_id="sainsburys",
                    grocer_name="Sainsbury's",
                    price=Decimal("2.00"),
                    product_id="456",
                ),
            ],
        )
        product.calculate_cheapest()
        
        self.assertEqual(product.cheapest_price, Decimal("2.00"))
        self.assertEqual(product.cheapest_retailer, "sainsburys")
    
    def test_calculate_cheapest_empty_prices(self):
        """Test cheapest calculation with no prices."""
        product = CombinedProduct(
            barcode="1234567890123",
            name="Test Product",
            prices=[],
        )
        product.calculate_cheapest()
        
        self.assertIsNone(product.cheapest_price)
        self.assertIsNone(product.cheapest_retailer)


class CombinedSearchServiceTests(TestCase):
    """Tests for CombinedSearchService."""
    
    def setUp(self):
        self.service = CombinedSearchService()
    
    def test_grocer_product_to_retailer_price(self):
        """Test conversion from GrocerProduct to RetailerPrice."""
        grocer_product = GrocerProduct(
            grocer_id="tesco",
            product_id="12345",
            name="Orange Juice",
            retail_price=GrocerPrice(
                price=Decimal("2.50"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
            barcodes=["5000128123456"],
        )
        
        retailer_price, relevance = self.service._grocer_product_to_retailer_price(
            grocer_product, rank=0
        )
        
        self.assertEqual(retailer_price.grocer_id, "tesco")
        self.assertEqual(retailer_price.price, Decimal("2.50"))
        self.assertEqual(relevance, 100.0)  # First result gets 100% relevance
    
    def test_relevance_score_decay(self):
        """Test that relevance decays with position."""
        grocer_product = GrocerProduct(
            grocer_id="tesco",
            product_id="12345",
            name="Orange Juice",
            retail_price=GrocerPrice(
                price=Decimal("2.50"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        
        _, rel_0 = self.service._grocer_product_to_retailer_price(grocer_product, rank=0)
        _, rel_1 = self.service._grocer_product_to_retailer_price(grocer_product, rank=1)
        _, rel_5 = self.service._grocer_product_to_retailer_price(grocer_product, rank=5)
        
        self.assertEqual(rel_0, 100.0)
        self.assertAlmostEqual(rel_1, 90.0, places=1)
        self.assertLess(rel_5, rel_1)
    
    def test_safe_decimal(self):
        """Test safe decimal conversion."""
        self.assertEqual(self.service._safe_decimal(1.5), Decimal("1.5"))
        self.assertEqual(self.service._safe_decimal("2.5"), Decimal("2.5"))
        self.assertIsNone(self.service._safe_decimal(None))
        self.assertIsNone(self.service._safe_decimal("invalid"))
    
    @patch.object(CombinedSearchService, '_search_grocer')
    def test_search_deduplication_by_barcode(self, mock_search):
        """Test that products with same barcode are deduplicated."""
        # Mock both grocers returning products with same barcode
        tesco_product = GrocerProduct(
            grocer_id="tesco",
            product_id="T123",
            name="Coca Cola 2L",
            barcodes=["5000112637922"],
            retail_price=GrocerPrice(
                price=Decimal("2.00"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        sainsburys_product = GrocerProduct(
            grocer_id="sainsburys",
            product_id="S456",
            name="Coca-Cola 2L",
            barcodes=["5000112637922"],
            retail_price=GrocerPrice(
                price=Decimal("2.20"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        
        def mock_search_impl(grocer_id, query, page_size):
            if grocer_id == "tesco":
                return ("tesco", GrocerSearchResult(
                    products=[tesco_product],
                    total_count=1,
                    page=1,
                    page_size=page_size,
                    has_more=False,
                ))
            else:
                return ("sainsburys", GrocerSearchResult(
                    products=[sainsburys_product],
                    total_count=1,
                    page=1,
                    page_size=page_size,
                    has_more=False,
                ))
        
        mock_search.side_effect = mock_search_impl
        
        result = self.service.search("coca cola", include_nutrition=False)
        
        # Should have 1 deduplicated product
        self.assertEqual(len(result.products), 1)
        
        # Should have prices from both retailers
        product = result.products[0]
        self.assertEqual(len(product.prices), 2)
        self.assertEqual(product.retailer_count, 2)
        
        # Check price comparison works
        grocer_ids = [p.grocer_id for p in product.prices]
        self.assertIn("tesco", grocer_ids)
        self.assertIn("sainsburys", grocer_ids)
    
    @patch.object(CombinedSearchService, '_search_grocer')
    def test_search_relevance_boost_for_multiple_retailers(self, mock_search):
        """Test that products at multiple retailers get relevance boost."""
        shared_product = GrocerProduct(
            grocer_id="tesco",
            product_id="T123",
            name="Shared Product",
            barcodes=["5000112637922"],
            retail_price=GrocerPrice(
                price=Decimal("2.00"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        unique_product = GrocerProduct(
            grocer_id="tesco",
            product_id="T456",
            name="Unique Product",
            barcodes=["5000112637999"],
            retail_price=GrocerPrice(
                price=Decimal("1.50"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        shared_sainsburys = GrocerProduct(
            grocer_id="sainsburys",
            product_id="S123",
            name="Shared Product",
            barcodes=["5000112637922"],
            retail_price=GrocerPrice(
                price=Decimal("2.20"),
                currency="GBP",
                measure=PriceMeasure.UNIT,
            ),
        )
        
        def mock_search_impl(grocer_id, query, page_size):
            if grocer_id == "tesco":
                return ("tesco", GrocerSearchResult(
                    products=[shared_product, unique_product],
                    total_count=2,
                    page=1,
                    page_size=page_size,
                    has_more=False,
                ))
            else:
                return ("sainsburys", GrocerSearchResult(
                    products=[shared_sainsburys],
                    total_count=1,
                    page=1,
                    page_size=page_size,
                    has_more=False,
                ))
        
        mock_search.side_effect = mock_search_impl
        
        result = self.service.search("product", include_nutrition=False)
        
        # Should have 2 products (1 shared + 1 unique)
        self.assertEqual(len(result.products), 2)
        
        # The shared product should have higher relevance
        shared = [p for p in result.products if p.barcode == "5000112637922"][0]
        unique = [p for p in result.products if p.barcode == "5000112637999"][0]
        
        self.assertGreater(shared.relevance_score, unique.relevance_score)


class NutritionDataSerializerTests(TestCase):
    """Tests for NutritionDataSerializer."""
    
    def test_nutriscore_display(self):
        """Test nutriscore display labels."""
        nutrition = NutritionData(
            nutriscore_grade="a",
            nova_group=1,
        )
        serializer = NutritionDataSerializer(nutrition)
        
        self.assertEqual(serializer.data['nutriscore_display'], 'A - Excellent')
    
    def test_nova_display(self):
        """Test NOVA group display labels."""
        nutrition = NutritionData(
            nutriscore_grade="c",
            nova_group=4,
        )
        serializer = NutritionDataSerializer(nutrition)
        
        self.assertEqual(serializer.data['nova_display'], '4 - Ultra-Processed')
    
    def test_traffic_light_green(self):
        """Test traffic light shows green for low values."""
        nutrition = NutritionData(
            sugars_100g=Decimal("3.0"),
            salt_100g=Decimal("0.2"),
            fat_100g=Decimal("2.0"),
            saturated_fat_100g=Decimal("1.0"),
        )
        serializer = NutritionDataSerializer(nutrition)
        
        traffic = serializer.data['traffic_light']
        self.assertEqual(traffic['sugars']['level'], 'green')
        self.assertEqual(traffic['salt']['level'], 'green')
        self.assertEqual(traffic['fat']['level'], 'green')
        self.assertEqual(traffic['saturated_fat']['level'], 'green')
    
    def test_traffic_light_red(self):
        """Test traffic light shows red for high values."""
        nutrition = NutritionData(
            sugars_100g=Decimal("30.0"),
            salt_100g=Decimal("2.0"),
            fat_100g=Decimal("20.0"),
            saturated_fat_100g=Decimal("6.0"),
        )
        serializer = NutritionDataSerializer(nutrition)
        
        traffic = serializer.data['traffic_light']
        self.assertEqual(traffic['sugars']['level'], 'red')
        self.assertEqual(traffic['salt']['level'], 'red')
        self.assertEqual(traffic['fat']['level'], 'red')
        self.assertEqual(traffic['saturated_fat']['level'], 'red')


class CombinedProductSerializerTests(TestCase):
    """Tests for CombinedProductSerializer."""
    
    def test_price_comparison(self):
        """Test price comparison calculation."""
        product = CombinedProduct(
            barcode="1234567890123",
            name="Test Product",
            prices=[
                RetailerPrice(
                    grocer_id="tesco",
                    grocer_name="Tesco",
                    price=Decimal("2.00"),
                    product_id="123",
                ),
                RetailerPrice(
                    grocer_id="sainsburys",
                    grocer_name="Sainsbury's",
                    price=Decimal("2.50"),
                    product_id="456",
                ),
            ],
            relevance_score=100.0,
            retailer_count=2,
        )
        product.calculate_cheapest()
        
        serializer = CombinedProductSerializer(product)
        comparison = serializer.data['price_comparison']
        
        self.assertIsNotNone(comparison)
        self.assertEqual(comparison['cheapest']['grocer_id'], 'tesco')
        self.assertEqual(comparison['cheapest']['price'], '2.00')
        self.assertEqual(comparison['most_expensive']['grocer_id'], 'sainsburys')
        self.assertEqual(comparison['potential_savings'], '0.50')
        self.assertEqual(comparison['savings_percent'], 20.0)
    
    def test_has_nutrition_data(self):
        """Test has_nutrition_data field."""
        product_with = CombinedProduct(
            barcode="1234567890123",
            name="With Nutrition",
            nutrition=NutritionData(nutriscore_grade="a"),
        )
        product_without = CombinedProduct(
            barcode="1234567890124",
            name="Without Nutrition",
        )
        
        self.assertTrue(CombinedProductSerializer(product_with).data['has_nutrition_data'])
        self.assertFalse(CombinedProductSerializer(product_without).data['has_nutrition_data'])


class CombinedSearchAPITests(TestCase):
    """Integration tests for Combined Search API endpoint."""
    
    def setUp(self):
        self.client = APIClient()
    
    def test_combined_search_missing_query(self):
        """Test that missing query returns 400."""
        response = self.client.get('/api/grocers/search/combined/')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())
    
    @patch.object(CombinedSearchService, 'search')
    def test_combined_search_success(self, mock_search):
        """Test successful combined search."""
        mock_search.return_value = CombinedSearchResult(
            products=[
                CombinedProduct(
                    barcode="1234567890123",
                    name="Test Product",
                    prices=[
                        RetailerPrice(
                            grocer_id="tesco",
                            grocer_name="Tesco",
                            price=Decimal("2.00"),
                            product_id="123",
                        ),
                    ],
                    relevance_score=100.0,
                    retailer_count=1,
                ),
            ],
            query="test",
            total_products=1,
            retailer_counts={"tesco": 1, "sainsburys": 0},
            nutrition_match_count=0,
        )
        
        response = self.client.get('/api/grocers/search/combined/?q=test')
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['query'], 'test')
        self.assertEqual(data['total_products'], 1)
        self.assertEqual(len(data['products']), 1)
        self.assertIn('summary', data)
    
    @patch.object(CombinedSearchService, 'search')
    def test_combined_search_with_params(self, mock_search):
        """Test combined search with query parameters."""
        mock_search.return_value = CombinedSearchResult(
            products=[],
            query="juice",
            total_products=0,
            retailer_counts={"tesco": 0},
            nutrition_match_count=0,
        )
        
        response = self.client.get(
            '/api/grocers/search/combined/',
            {
                'q': 'juice',
                'page_size': 30,
                'include_nutrition': 'false',
                'grocers': 'tesco',
            }
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Check that search was called with correct params
        mock_search.assert_called_once()
        call_kwargs = mock_search.call_args[1]
        self.assertEqual(call_kwargs['query'], 'juice')
        self.assertEqual(call_kwargs['page_size'], 30)
        self.assertFalse(call_kwargs['include_nutrition'])
        self.assertEqual(call_kwargs['grocer_ids'], ['tesco'])
