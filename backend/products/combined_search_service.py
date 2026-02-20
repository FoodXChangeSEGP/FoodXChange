"""
Combined Grocer Search Service (v2).

Searches across Tesco and Sainsbury's, using their relevance ordering,
and enriches with Open Food Facts nutrition data only when barcode matches.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from datetime import timedelta

import requests
from django.utils import timezone

from .grocer_services import (
    get_grocer_service,
    get_available_grocers,
    GrocerProduct,
    GrocerSearchResult,
)
from .off_models import OFFProduct
from .product_matcher import (
    normalize_product_name,
    generate_match_key,
    similarity_score,
)


logger = logging.getLogger(__name__)


# Open Food Facts API for barcode lookup
OFF_API_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"

# Data cache expiry (12 hours)
CACHE_EXPIRY_HOURS = 12


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
    """Nutrition information from Open Food Facts (only if barcode matched)."""
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
    A product combined from Tesco and/or Sainsbury's sources.
    
    Contains:
    - Unified product info (name, brand, barcode)
    - Prices from each retailer that stocks it
    - Nutrition data ONLY if barcode matches in Open Food Facts
    """
    # Primary identifier (barcode/EAN)
    barcode: str
    
    # Basic product info (from the first grocer that returned it)
    name: str
    brand: Optional[str] = None
    description: str = ""
    categories: list[str] = field(default_factory=list)
    image_url: Optional[str] = None
    
    # Prices from each retailer
    prices: list[RetailerPrice] = field(default_factory=list)
    
    # Original search position (lower = more relevant)
    # This preserves grocer relevance ordering
    search_position: int = 0
    retailer_count: int = 0
    
    # Normalized match key for name-based grouping
    match_key: str = ""
    
    # Backwards compatible relevance_score (computed from position)
    @property
    def relevance_score(self) -> float:
        """Compute relevance score from search position for backwards compatibility."""
        # Higher score = more relevant (inverse of position)
        base_score = max(0, 100 - self.search_position)
        # Boost for multi-retailer products
        boost = 1 + (0.5 * (self.retailer_count - 1)) if self.retailer_count > 1 else 1
        return base_score * boost
    
    # Nutrition data from Open Food Facts (None if no barcode match)
    nutrition: Optional[NutritionData] = None
    has_off_match: bool = False
    
    # Aggregated info
    cheapest_price: Optional[Decimal] = None
    cheapest_retailer: Optional[str] = None
    
    #Info for other retailers 
    matches: list["CombinedProduct"] = field(default_factory=list)
    
    def calculate_cheapest(self):
        """Calculate the cheapest price across all retailers."""
        if not self.prices:
            return
        
        cheapest = min(self.prices, key=lambda p: p.price)
        self.cheapest_price = cheapest.price
        self.cheapest_retailer = cheapest.grocer_id


@dataclass
class CombinedSearchResult:
    """Result from combined Tesco+Sainsbury's search."""
    products: list[CombinedProduct]
    query: str
    total_products: int
    retailer_counts: dict  # Number of products found per retailer
    nutrition_match_count: int  # Products with OFF barcode match


class CombinedSearchService:
    """
    Service for searching products across Tesco and Sainsbury's.
    
    Key improvements:
    - Uses grocer-provided relevance ordering
    - Only shows nutri-score/nova from OFF when barcode matches
    - Includes full price info from both retailers
    - Deduplicates by barcode for comparison
    """
    
    # Primary grocers to search (Tesco and Sainsbury's only)
    PRIMARY_GROCERS = ['tesco', 'sainsburys']
    
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
    
    def _fetch_off_by_barcode(self, barcode: str) -> Optional[NutritionData]:
        """
        Fetch nutrition data from Open Food Facts by barcode.
        Only returns data if there's an exact barcode match.
        """
        try:
            # First check if we have it cached and not stale
            cache_cutoff = timezone.now() - timedelta(hours=CACHE_EXPIRY_HOURS)
            cached = OFFProduct.objects.filter(
                code=barcode,
                last_fetched_at__gte=cache_cutoff
            ).first()
            
            if cached:
                return NutritionData(
                    nutriscore_grade=cached.nutriscore_grade if cached.nutriscore_grade != 'unknown' else None,
                    nova_group=cached.nova_group,
                    sugars_100g=cached.sugars_100g,
                    salt_100g=cached.salt_100g,
                    fat_100g=cached.fat_100g,
                    saturated_fat_100g=cached.saturated_fat_100g,
                    image_url=cached.image_url,
                    brands=cached.brands,
                    categories=cached.categories,
                )
            
            # Fetch from OFF API
            url = OFF_API_URL.format(barcode=barcode)
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Only return if we have a match (status=1 means found)
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
            
            nutrition_data = NutritionData(
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
            
            # Cache the result
            self._cache_off_product(barcode, product, nutriments)
            
            return nutrition_data
            
        except Exception as e:
            logger.debug(f"Failed to fetch OFF data for barcode {barcode}: {e}")
            return None
    
    def _cache_off_product(self, barcode: str, product: dict, nutriments: dict):
        """Cache an OFF product in the database."""
        try:
            nutriscore = product.get('nutriscore_grade') or product.get('nutrition_grades')
            nova = product.get('nova_group')
            
            OFFProduct.objects.update_or_create(
                code=barcode,
                defaults={
                    'product_name': product.get('product_name', '')[:500],
                    'brands': product.get('brands', '')[:255],
                    'image_url': (product.get('image_url') or product.get('image_front_url') or '')[:500],
                    'nutriscore_grade': nutriscore.lower() if nutriscore else 'unknown',
                    'nova_group': int(nova) if nova else None,
                    'sugars_100g': self._safe_decimal(nutriments.get('sugars_100g')),
                    'salt_100g': self._safe_decimal(nutriments.get('salt_100g')),
                    'fat_100g': self._safe_decimal(nutriments.get('fat_100g')),
                    'saturated_fat_100g': self._safe_decimal(nutriments.get('saturated-fat_100g')),
                    'categories': product.get('categories', '')[:500] if product.get('categories') else '',
                    'countries': product.get('countries', '')[:500] if product.get('countries') else '',
                    'last_fetched_at': timezone.now(),
                }
            )
        except Exception as e:
            logger.debug(f"Failed to cache OFF product {barcode}: {e}")
    
    def _safe_decimal(self, value) -> Optional[Decimal]:
        """Safely convert a value to Decimal."""
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except Exception:
            return None
    
    def _grocer_product_to_retailer_price(self, product: GrocerProduct) -> RetailerPrice:
        """Convert a GrocerProduct to RetailerPrice."""
        grocer_names = {
            'tesco': 'Tesco',
            'sainsburys': "Sainsbury's",
        }
        
        price = product.get_effective_price() or (product.retail_price.price if product.retail_price else Decimal('0'))
        
        return RetailerPrice(
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
    
    def search(
        self,
        query: str,
        page_size: int = 20,
        include_nutrition: bool = True,
        grocer_ids: Optional[list[str]] = None,
    ) -> CombinedSearchResult:
        """
        Search for products across Tesco and Sainsbury's.
        
        Uses grocer-provided relevance ordering and only enriches
        with OFF data when there's a barcode match.
        
        Args:
            query: Search query
            page_size: Number of results per grocer
            include_nutrition: Whether to fetch Open Food Facts data
            grocer_ids: Specific grocers to search (default: Tesco + Sainsbury's)
            
        Returns:
            CombinedSearchResult with products ordered by grocer relevance
        """
        # Default to primary grocers only (Tesco + Sainsbury's)
        if grocer_ids is None:
            grocer_ids = self.PRIMARY_GROCERS
        else:
            # Filter to only supported grocers
            grocer_ids = [g for g in grocer_ids if g in self.PRIMARY_GROCERS]
            if not grocer_ids:
                grocer_ids = self.PRIMARY_GROCERS
        
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
        
        # Step 2: Merge products by barcode, preserving grocer ordering
        # Also track by normalized name for name-based matching
        products_by_barcode: dict[str, CombinedProduct] = {}
        products_by_name_key: dict[str, CombinedProduct] = {}  # For products without shared barcode
        products_without_barcode: list[CombinedProduct] = []
        retailer_counts = {gid: 0 for gid in grocer_ids}
        
        # Global position counter to preserve relevance across grocers
        # We interleave results from each grocer to maintain their ordering
        position = 0
        
        # Get max results across all grocers
        max_results = max(len(r.products) for r in all_results.values()) if all_results else 0
        
        # Interleave results from grocers to preserve their relative ordering
        for idx in range(max_results):
            for grocer_id in grocer_ids:
                result = all_results.get(grocer_id)
                if not result or idx >= len(result.products):
                    continue
                
                product = result.products[idx]
                retailer_price = self._grocer_product_to_retailer_price(product)
                retailer_counts[grocer_id] += 1
                
                # Get primary barcode
                barcode = product.get_primary_barcode()
                
                # Generate normalized name key for matching
                name_key = generate_match_key(product.name)
                
                if barcode:
                    if barcode in products_by_barcode:
                        # Add price from this retailer to existing product
                        existing = products_by_barcode[barcode]
                        existing.prices.append(retailer_price)
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
                            search_position=position,
                            retailer_count=1,
                            match_key=name_key,
                        )
                        products_by_barcode[barcode] = combined
                        
                        # Also track by name key for potential merging
                        if name_key not in products_by_name_key:
                            products_by_name_key[name_key] = combined
                else:
                    # Product without barcode - try to match by normalized name
                    if name_key and name_key in products_by_name_key:
                        # Check if it's from a different retailer (avoid self-merge)
                        existing = products_by_name_key[name_key]
                        existing_retailers = {p.grocer_id for p in existing.prices}
                        
                        if grocer_id not in existing_retailers:
                            # Name-based match! Add price from this retailer
                            existing.prices.append(retailer_price)
                            existing.retailer_count += 1
                            
                            if not existing.image_url and product.image_url:
                                existing.image_url = product.image_url
                            
                            for cat in product.categories:
                                if cat not in existing.categories:
                                    existing.categories.append(cat)
                            
                            logger.info(
                                f"Name-matched '{product.name}' to '{existing.name}' "
                                f"(key: {name_key})"
                            )
                            position += 1
                            continue
                    
                    # No match - create as standalone product
                    combined = CombinedProduct(
                        barcode=f"no_barcode_{product.grocer_id}_{product.product_id}",
                        name=product.name,
                        brand=product.brand,
                        description=product.description,
                        categories=product.categories.copy(),
                        image_url=product.image_url,
                        prices=[retailer_price],
                        search_position=position,
                        retailer_count=1,
                        match_key=name_key,
                    )
                    products_without_barcode.append(combined)
                    
                    # Track by name key for potential future matches
                    if name_key and name_key not in products_by_name_key:
                        products_by_name_key[name_key] = combined
                
                position += 1
        
        # Step 3: Combine products
        all_products = list(products_by_barcode.values()) + products_without_barcode
        
        # Step 4: Calculate cheapest price for each product
        for product in all_products:
            product.calculate_cheapest()
        
        # Step 5: Fetch nutrition data from Open Food Facts (only for products with barcodes)
        nutrition_match_count = 0
        
        if include_nutrition:
            # Only products with real barcodes can have OFF data
            products_with_barcode = [
                p for p in all_products 
                if not p.barcode.startswith('no_barcode_')
            ]
            
            # Limit API calls to avoid rate limiting
            max_api_calls = 15
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {
                    executor.submit(self._fetch_off_by_barcode, p.barcode): p
                    for p in products_with_barcode[:max_api_calls]
                }
                
                for future in as_completed(futures):
                    product = futures[future]
                    nutrition = future.result()
                    if nutrition:
                        product.nutrition = nutrition
                        product.has_off_match = True
                        nutrition_match_count += 1
                        
                        # Use OFF image if we don't have one
                        if not product.image_url and nutrition.image_url:
                            product.image_url = nutrition.image_url
        
        # Step 6: Sort by search position (grocer relevance)
        # Products at multiple retailers get slightly better position
        all_products.sort(key=lambda p: (
            p.search_position - (10 * (p.retailer_count - 1))  # Boost multi-retailer items
        ))
        
        return CombinedSearchResult(
            products=all_products,
            query=query,
            total_products=len(all_products),
            retailer_counts=retailer_counts,
            nutrition_match_count=nutrition_match_count,
        )
    
    def compare_by_barcode(self, barcode: str) -> Optional[CombinedProduct]:
        """
        Get price comparison for a specific product by barcode.
        
        Searches all primary grocers for the barcode and returns
        combined pricing information.
        
        Args:
            barcode: Product barcode (EAN-13)
            
        Returns:
            CombinedProduct with prices from all retailers that stock it,
            or None if not found at any retailer.
        """
        combined: Optional[CombinedProduct] = None
        
        for grocer_id in self.PRIMARY_GROCERS:
            try:
                service = get_grocer_service(grocer_id)
                product = service.get_product_by_barcode(barcode)
                
                if product:
                    retailer_price = self._grocer_product_to_retailer_price(product)
                    
                    if combined is None:
                        combined = CombinedProduct(
                            barcode=barcode,
                            name=product.name,
                            brand=product.brand,
                            description=product.description,
                            categories=product.categories.copy(),
                            image_url=product.image_url,
                            prices=[retailer_price],
                            retailer_count=1,
                        )
                    else:
                        combined.prices.append(retailer_price)
                        combined.retailer_count += 1
                        if not combined.image_url and product.image_url:
                            combined.image_url = product.image_url
                            
            except Exception as e:
                logger.error(f"Error fetching barcode {barcode} from {grocer_id}: {e}")
        
        if combined:
            # Calculate cheapest price
            combined.calculate_cheapest()
            
            # Try to get nutrition data
            nutrition = self._fetch_off_by_barcode(barcode)
            if nutrition:
                combined.nutrition = nutrition
                combined.has_off_match = True
        
        return combined
