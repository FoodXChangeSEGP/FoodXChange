"""
Combined Grocer Search Service.

Searches across multiple grocery retailers, deduplicates products by barcode,
combines relevance scores, and enriches with Open Food Facts nutrition data.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

import requests

from .grocer_services import (
    get_grocer_service,
    get_available_grocers,
    GrocerProduct,
    GrocerSearchResult,
)
from .off_models import OFFProduct


logger = logging.getLogger(__name__)


# Open Food Facts API for barcode lookup
OFF_API_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"


@dataclass
class RetailerPrice:
    """Price information from a specific retailer."""
    grocer_id: str
    grocer_name: str
    price: Decimal
    unit_price: Optional[Decimal] = None
    unit_measure: Optional[str] = None
    is_on_sale: bool = False
    original_price: Optional[Decimal] = None
    promotion_description: Optional[str] = None
    product_url: Optional[str] = None
    product_id: str = ""


@dataclass
class NutritionData:
    """Nutrition information from Open Food Facts."""
    nutriscore_grade: Optional[str] = None
    nova_group: Optional[int] = None
    sugars_100g: Optional[Decimal] = None
    salt_100g: Optional[Decimal] = None
    fat_100g: Optional[Decimal] = None
    saturated_fat_100g: Optional[Decimal] = None
    image_url: Optional[str] = None
    brands: Optional[str] = None
    categories: Optional[str] = None


@dataclass
class CombinedProduct:
    """
    A product combined from multiple grocer sources.
    
    Contains:
    - Unified product info (name, brand, barcode)
    - Prices from each retailer
    - Combined relevance score
    - Nutrition data from Open Food Facts
    """
    # Primary identifier (barcode/EAN)
    barcode: str
    
    # Basic product info (from highest relevance source)
    name: str
    brand: Optional[str] = None
    description: str = ""
    categories: list[str] = field(default_factory=list)
    image_url: Optional[str] = None
    
    # Prices from each retailer
    prices: list[RetailerPrice] = field(default_factory=list)
    
    # Relevance scoring
    relevance_score: float = 0.0  # Higher = more relevant
    retailer_count: int = 0  # Number of retailers carrying this product
    
    # Nutrition data from Open Food Facts
    nutrition: Optional[NutritionData] = None
    
    # Aggregated info
    cheapest_price: Optional[Decimal] = None
    cheapest_retailer: Optional[str] = None
    
    def calculate_cheapest(self):
        """Calculate the cheapest price across all retailers."""
        if not self.prices:
            return
        
        cheapest = min(self.prices, key=lambda p: p.price)
        self.cheapest_price = cheapest.price
        self.cheapest_retailer = cheapest.grocer_id


@dataclass
class CombinedSearchResult:
    """Result from combined multi-grocer search."""
    products: list[CombinedProduct]
    query: str
    total_products: int
    retailer_counts: dict  # Number of products found per retailer
    nutrition_match_count: int  # Products with OFF data


class CombinedSearchService:
    """
    Service for searching products across multiple grocers with deduplication.
    
    Features:
    - Parallel search across all available grocers
    - Deduplication by barcode
    - Combined relevance scoring
    - Open Food Facts nutrition enrichment
    """
    
    def __init__(self, timeout: int = 30, max_workers: int = 4):
        """
        Initialize the combined search service.
        
        Args:
            timeout: API request timeout in seconds
            max_workers: Max parallel threads for API calls
        """
        self.timeout = timeout
        self.max_workers = max_workers
    
    def _search_grocer(self, grocer_id: str, query: str, page_size: int) -> tuple[str, GrocerSearchResult]:
        """
        Search a single grocer and return results.
        
        Args:
            grocer_id: Grocer identifier
            query: Search query
            page_size: Number of results to fetch
            
        Returns:
            Tuple of (grocer_id, search_result)
        """
        try:
            service = get_grocer_service(grocer_id)
            result = service.search_products(query=query, page=1, page_size=page_size)
            logger.info(f"Found {len(result.products)} products from {grocer_id}")
            return (grocer_id, result)
        except Exception as e:
            logger.error(f"Error searching {grocer_id}: {e}")
            return (grocer_id, GrocerSearchResult(
                products=[],
                total_count=0,
                page=1,
                page_size=page_size,
                has_more=False,
            ))
    
    def _fetch_off_nutrition(self, barcode: str) -> Optional[NutritionData]:
        """
        Fetch nutrition data from Open Food Facts by barcode.
        
        Args:
            barcode: Product barcode (EAN-13)
            
        Returns:
            NutritionData if found, None otherwise
        """
        try:
            url = OFF_API_URL.format(barcode=barcode)
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') != 1:
                return None
            
            product = data.get('product', {})
            nutriments = product.get('nutriments', {})
            
            # Parse nutriscore
            nutriscore = product.get('nutriscore_grade') or product.get('nutrition_grades')
            
            # Parse NOVA group
            nova = product.get('nova_group')
            if nova:
                try:
                    nova = int(nova)
                except (ValueError, TypeError):
                    nova = None
            
            return NutritionData(
                nutriscore_grade=nutriscore.lower() if nutriscore else None,
                nova_group=nova,
                sugars_100g=self._safe_decimal(nutriments.get('sugars_100g')),
                salt_100g=self._safe_decimal(nutriments.get('salt_100g')),
                fat_100g=self._safe_decimal(nutriments.get('fat_100g')),
                saturated_fat_100g=self._safe_decimal(nutriments.get('saturated-fat_100g')),
                image_url=product.get('image_url') or product.get('image_front_url'),
                brands=product.get('brands'),
                categories=product.get('categories'),
            )
        except Exception as e:
            logger.debug(f"Failed to fetch OFF data for barcode {barcode}: {e}")
            return None
    
    def _safe_decimal(self, value) -> Optional[Decimal]:
        """Safely convert a value to Decimal."""
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except Exception:
            return None
    
    def _grocer_product_to_retailer_price(self, product: GrocerProduct, rank: int) -> tuple[RetailerPrice, float]:
        """
        Convert a GrocerProduct to RetailerPrice and calculate relevance.
        
        Args:
            product: The grocer product
            rank: Position in search results (0-indexed)
            
        Returns:
            Tuple of (RetailerPrice, relevance_score)
        """
        # Get service name
        grocer_names = {
            'tesco': 'Tesco',
            'sainsburys': "Sainsbury's",
        }
        
        price = product.get_effective_price() or (product.retail_price.price if product.retail_price else Decimal('0'))
        
        retailer_price = RetailerPrice(
            grocer_id=product.grocer_id,
            grocer_name=grocer_names.get(product.grocer_id, product.grocer_id),
            price=price,
            unit_price=product.unit_price.price if product.unit_price else None,
            unit_measure=product.unit_price.measure.value if product.unit_price else None,
            is_on_sale=product.retail_price.is_on_sale if product.retail_price else False,
            original_price=product.retail_price.original_price if product.retail_price else None,
            promotion_description=product.promotions[0].description if product.promotions else None,
            product_url=product.product_url,
            product_id=product.product_id,
        )
        
        # Calculate relevance score based on position
        # Higher position = higher relevance, decay factor of 0.9 per position
        relevance = 100 * (0.9 ** rank)
        
        return retailer_price, relevance
    
    def search(
        self,
        query: str,
        page_size: int = 20,
        include_nutrition: bool = True,
        grocer_ids: Optional[list[str]] = None,
    ) -> CombinedSearchResult:
        """
        Search for products across all grocers with deduplication.
        
        Args:
            query: Search query
            page_size: Number of results per grocer
            include_nutrition: Whether to fetch Open Food Facts data
            grocer_ids: Specific grocers to search (default: all)
            
        Returns:
            CombinedSearchResult with deduplicated, enriched products
        """
        if grocer_ids is None:
            grocer_ids = list(get_available_grocers())
        
        # Step 1: Search all grocers in parallel
        all_results: dict[str, GrocerSearchResult] = {}
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._search_grocer, gid, query, page_size): gid
                for gid in grocer_ids
            }
            
            for future in as_completed(futures):
                grocer_id, result = future.result()
                all_results[grocer_id] = result
        
        # Step 2: Group products by barcode and combine
        products_by_barcode: dict[str, CombinedProduct] = {}
        products_without_barcode: list[CombinedProduct] = []
        retailer_counts = {gid: 0 for gid in grocer_ids}
        
        for grocer_id, result in all_results.items():
            retailer_counts[grocer_id] = len(result.products)
            
            for rank, product in enumerate(result.products):
                retailer_price, relevance = self._grocer_product_to_retailer_price(product, rank)
                
                # Get primary barcode
                barcode = product.get_primary_barcode()
                
                if barcode:
                    if barcode in products_by_barcode:
                        # Add price from this retailer to existing product
                        existing = products_by_barcode[barcode]
                        existing.prices.append(retailer_price)
                        existing.relevance_score += relevance
                        existing.retailer_count += 1
                        
                        # Update image if we don't have one
                        if not existing.image_url and product.image_url:
                            existing.image_url = product.image_url
                        
                        # Merge categories
                        for cat in product.categories:
                            if cat not in existing.categories:
                                existing.categories.append(cat)
                    else:
                        # Create new combined product
                        combined = CombinedProduct(
                            barcode=barcode,
                            name=product.name,
                            brand=product.brand,
                            description=product.description,
                            categories=product.categories.copy(),
                            image_url=product.image_url,
                            prices=[retailer_price],
                            relevance_score=relevance,
                            retailer_count=1,
                        )
                        products_by_barcode[barcode] = combined
                else:
                    # Product without barcode - can't deduplicate
                    # Still include it but with lower relevance
                    combined = CombinedProduct(
                        barcode=f"no_barcode_{product.grocer_id}_{product.product_id}",
                        name=product.name,
                        brand=product.brand,
                        description=product.description,
                        categories=product.categories.copy(),
                        image_url=product.image_url,
                        prices=[retailer_price],
                        relevance_score=relevance * 0.5,  # Lower relevance for no barcode
                        retailer_count=1,
                    )
                    products_without_barcode.append(combined)
        
        # Step 3: Combine products with and without barcodes
        all_products = list(products_by_barcode.values()) + products_without_barcode
        
        # Step 4: Boost relevance for products in multiple retailers
        for product in all_products:
            if product.retailer_count > 1:
                # Boost by 50% per additional retailer
                product.relevance_score *= (1 + 0.5 * (product.retailer_count - 1))
        
        # Step 5: Calculate cheapest price for each product
        for product in all_products:
            product.calculate_cheapest()
        
        # Step 6: Fetch nutrition data from Open Food Facts
        nutrition_match_count = 0
        
        if include_nutrition:
            # First, try to get from local database
            barcodes = [p.barcode for p in all_products if not p.barcode.startswith('no_barcode_')]
            cached_products = OFFProduct.objects.filter(code__in=barcodes)
            cached_by_code = {p.code: p for p in cached_products}
            
            # Build nutrition data from cached products
            for product in all_products:
                if product.barcode in cached_by_code:
                    off_product = cached_by_code[product.barcode]
                    product.nutrition = NutritionData(
                        nutriscore_grade=off_product.nutriscore_grade,
                        nova_group=off_product.nova_group,
                        sugars_100g=off_product.sugars_100g,
                        salt_100g=off_product.salt_100g,
                        fat_100g=off_product.fat_100g,
                        saturated_fat_100g=off_product.saturated_fat_100g,
                        image_url=off_product.image_url,
                        brands=off_product.brands,
                        categories=off_product.categories,
                    )
                    nutrition_match_count += 1
                    
                    # Use OFF image if we don't have one
                    if not product.image_url and off_product.image_url:
                        product.image_url = off_product.image_url
            
            # For products without cached nutrition, fetch from OFF API
            uncached_products = [
                p for p in all_products
                if p.nutrition is None and not p.barcode.startswith('no_barcode_')
            ]
            
            # Limit API calls to avoid rate limiting
            max_api_calls = 10
            
            if uncached_products[:max_api_calls]:
                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    futures = {
                        executor.submit(self._fetch_off_nutrition, p.barcode): p
                        for p in uncached_products[:max_api_calls]
                    }
                    
                    for future in as_completed(futures):
                        product = futures[future]
                        nutrition = future.result()
                        if nutrition:
                            product.nutrition = nutrition
                            nutrition_match_count += 1
                            
                            # Use OFF image if we don't have one
                            if not product.image_url and nutrition.image_url:
                                product.image_url = nutrition.image_url
        
        # Step 7: Sort by relevance score (descending)
        all_products.sort(key=lambda p: p.relevance_score, reverse=True)
        
        return CombinedSearchResult(
            products=all_products,
            query=query,
            total_products=len(all_products),
            retailer_counts=retailer_counts,
            nutrition_match_count=nutrition_match_count,
        )
