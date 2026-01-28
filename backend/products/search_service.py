"""
Open Food Facts Search Service.

This module provides the SearchService class for fetching, processing,
and storing product data from the Open Food Facts API for the UK market.
"""

import csv
import io
import logging
from decimal import Decimal, InvalidOperation
from typing import Optional
from urllib.parse import urlencode

import requests
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from .off_models import OFFProduct, SearchQueryCache


logger = logging.getLogger(__name__)


class SearchService:
    """
    Service for searching and fetching products from Open Food Facts API.
    
    Implements:
    - Dynamic URL construction with UK geo-fence
    - CSV fetching and parsing
    - Data cleaning and de-duplication
    - Database upsert with barcode as unique constraint
    - Lazy loading with cache invalidation
    
    Usage:
        service = SearchService()
        products = service.search("chocolate biscuits")
    """
    
    BASE_URL = "https://world.openfoodfacts.org/cgi/search.pl"
    
    # Required fields for data integrity
    REQUIRED_FIELDS = ['code', 'product_name', 'nutriscore_grade', 'image_url']
    
    # Fields we want from the CSV
    CSV_FIELDS = [
        'code', 'product_name', 'brands', 'nutriscore_grade', 'nova_group',
        'image_url', 'sugars_100g', 'salt_100g', 'fat_100g', 'saturated-fat_100g',
        'completeness', 'countries_en', 'categories_en'
    ]
    
    # Cache duration in hours
    CACHE_DURATION_HOURS = 24
    
    def __init__(self, page_size: int = 100, timeout: int = 30):
        """
        Initialize SearchService.
        
        Args:
            page_size: Number of results to fetch from OFF API (default 100)
            timeout: Request timeout in seconds (default 30)
        """
        self.page_size = page_size
        self.timeout = timeout
    
    def build_search_url(self, query: str, page: int = 1) -> str:
        """
        Construct the Open Food Facts search URL with UK geo-fence.
        
        Args:
            query: Search term
            page: Page number for pagination (default 1)
            
        Returns:
            Fully constructed search URL
        """
        params = {
            'action': 'process',
            'search_terms': query,
            # UK Geo-fence
            'tagtype_0': 'countries',
            'tag_contains_0': 'contains',
            'tag_0': 'United Kingdom',
            # Ranking by popularity (real products first)
            'sort_by': 'unique_scans_n',
            # CSV format
            'format': 'csv',
            'download': 'on',
            # Pagination
            'page_size': self.page_size,
            'page': page,
        }
        
        url = f"{self.BASE_URL}?{urlencode(params)}"
        logger.debug(f"Built OFF search URL: {url}")
        return url
    
    def fetch_csv(self, query: str, page: int = 1) -> Optional[str]:
        """
        Fetch CSV data from Open Food Facts API.
        
        Args:
            query: Search term
            page: Page number
            
        Returns:
            CSV content as string, or None if request failed
        """
        url = self.build_search_url(query, page)
        
        try:
            response = requests.get(
                url,
                timeout=self.timeout,
                headers={
                    'User-Agent': 'FoodXchange-HealthySwap/1.0 (contact@foodxchange.com)'
                }
            )
            response.raise_for_status()
            
            # Check if we got CSV content
            content_type = response.headers.get('Content-Type', '')
            if 'text/csv' not in content_type and 'text/plain' not in content_type:
                logger.warning(f"Unexpected content type: {content_type}")
            
            return response.text
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch CSV from OFF API: {e}")
            return None
    
    def parse_csv(self, csv_content: str) -> list[dict]:
        """
        Parse CSV content into list of dictionaries.
        
        Args:
            csv_content: Raw CSV string from OFF API
            
        Returns:
            List of product dictionaries
        """
        if not csv_content:
            return []
        
        products = []
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content), delimiter='\t')
            
            for row in reader:
                products.append(row)
                
        except csv.Error as e:
            logger.error(f"CSV parsing error: {e}")
            return []
        
        logger.info(f"Parsed {len(products)} products from CSV")
        return products
    
    def clean_data(self, products: list[dict]) -> list[dict]:
        """
        Apply data cleaning and filtering pipeline.
        
        Pipeline steps:
        1. Data Integrity: Drop rows missing required fields
        2. UK Focus: Filter to products sold in United Kingdom
        3. De-duplication: Keep highest completeness per brand+product_name
        
        Args:
            products: Raw product list from CSV
            
        Returns:
            Cleaned and de-duplicated product list
        """
        if not products:
            return []
        
        cleaned = []
        
        # Step 1 & 2: Data integrity and UK focus
        for product in products:
            # Check required fields
            if not self._has_required_fields(product):
                continue
            
            # Check UK presence
            countries = product.get('countries_en', '')
            if 'United Kingdom' not in countries:
                continue
            
            cleaned.append(product)
        
        logger.info(f"After integrity/UK filter: {len(cleaned)} products")
        
        # Step 3: De-duplication by brand + product_name
        deduplicated = self._deduplicate_products(cleaned)
        
        logger.info(f"After de-duplication: {len(deduplicated)} products")
        
        return deduplicated
    
    def _has_required_fields(self, product: dict) -> bool:
        """Check if product has all required fields with non-empty values."""
        for field in self.REQUIRED_FIELDS:
            value = product.get(field, '')
            if not value or value.strip() == '':
                return False
        return True
    
    def _deduplicate_products(self, products: list[dict]) -> list[dict]:
        """
        Group by brand + product_name, keep highest completeness score.
        
        This eliminates duplicate sizes and junk entries.
        """
        groups = {}
        
        for product in products:
            # Create grouping key
            brand = (product.get('brands', '') or '').strip().lower()
            name = (product.get('product_name', '') or '').strip().lower()
            key = (brand, name)
            
            # Parse completeness score
            try:
                completeness = float(product.get('completeness', 0) or 0)
            except (ValueError, TypeError):
                completeness = 0
            
            # Keep the one with highest completeness
            if key not in groups:
                groups[key] = (product, completeness)
            else:
                if completeness > groups[key][1]:
                    groups[key] = (product, completeness)
        
        return [product for product, _ in groups.values()]
    
    def _parse_decimal(self, value: str) -> Optional[Decimal]:
        """Safely parse a decimal value from string."""
        if not value or value.strip() == '':
            return None
        try:
            return Decimal(str(value).strip())
        except (InvalidOperation, ValueError):
            return None
    
    def _parse_int(self, value: str) -> Optional[int]:
        """Safely parse an integer value from string."""
        if not value or value.strip() == '':
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    def _normalize_nutriscore(self, grade: str) -> str:
        """Normalize nutriscore grade to lowercase single letter."""
        if not grade:
            return 'unknown'
        grade = grade.strip().lower()
        if grade in ('a', 'b', 'c', 'd', 'e'):
            return grade
        return 'unknown'
    
    @transaction.atomic
    def store_products(self, products: list[dict], search_query: str) -> list[OFFProduct]:
        """
        Store products in database using upsert pattern.
        
        Uses barcode (code) as unique constraint.
        
        Args:
            products: Cleaned product list
            search_query: Original search query for cache tracking
            
        Returns:
            List of stored OFFProduct instances
        """
        stored = []
        now = timezone.now()
        
        for product_data in products:
            code = product_data.get('code', '').strip()
            if not code:
                continue
            
            defaults = {
                'product_name': product_data.get('product_name', '')[:500],
                'brands': product_data.get('brands', '')[:255],
                'image_url': product_data.get('image_url', '')[:500],
                'nutriscore_grade': self._normalize_nutriscore(
                    product_data.get('nutriscore_grade', '')
                ),
                'nova_group': self._parse_int(product_data.get('nova_group', '')),
                'sugars_100g': self._parse_decimal(product_data.get('sugars_100g', '')),
                'salt_100g': self._parse_decimal(product_data.get('salt_100g', '')),
                'fat_100g': self._parse_decimal(product_data.get('fat_100g', '')),
                'saturated_fat_100g': self._parse_decimal(
                    product_data.get('saturated-fat_100g', '')
                ),
                'completeness': self._parse_decimal(
                    product_data.get('completeness', '0')
                ) or Decimal('0'),
                'countries': product_data.get('countries_en', '')[:500],
                'categories': product_data.get('categories_en', ''),
                'search_query': search_query[:255],
                'last_fetched_at': now,
            }
            
            try:
                obj, created = OFFProduct.objects.update_or_create(
                    code=code,
                    defaults=defaults
                )
                stored.append(obj)
                
            except Exception as e:
                logger.error(f"Failed to store product {code}: {e}")
                continue
        
        logger.info(f"Stored {len(stored)} products for query '{search_query}'")
        return stored
    
    def _update_query_cache(self, query: str, result_count: int, is_complete: bool = True):
        """Update or create search query cache entry."""
        SearchQueryCache.objects.update_or_create(
            query=query.lower().strip(),
            defaults={
                'result_count': result_count,
                'is_complete': is_complete,
            }
        )
    
    def _get_cached_results(self, query: str) -> Optional[QuerySet]:
        """
        Check if we have fresh cached results for query.
        
        Returns:
            QuerySet of cached products if fresh, None if stale/missing
        """
        normalized_query = query.lower().strip()
        
        try:
            cache_entry = SearchQueryCache.objects.get(query=normalized_query)
            
            if cache_entry.is_stale:
                logger.info(f"Cache stale for query '{query}'")
                return None
            
            # Return cached products
            products = OFFProduct.objects.filter(
                search_query=normalized_query
            )
            
            if products.exists():
                logger.info(f"Cache hit for query '{query}': {products.count()} products")
                return products
            
        except SearchQueryCache.DoesNotExist:
            logger.info(f"No cache entry for query '{query}'")
        
        return None
    
    def search(
        self,
        query: str,
        force_refresh: bool = False,
        limit: Optional[int] = None
    ) -> QuerySet:
        """
        Search for products with lazy loading from OFF API.
        
        Workflow:
        1. Check local DB cache first
        2. If empty/stale, fetch from OFF API
        3. Clean and store results
        4. Return sorted by Nutriscore then NOVA
        
        Args:
            query: Search term
            force_refresh: Force fetch from API even if cached
            limit: Optional limit on results
            
        Returns:
            QuerySet of OFFProduct sorted by health score
        """
        if not query or not query.strip():
            return OFFProduct.objects.none()
        
        normalized_query = query.lower().strip()
        
        # Step 1: Check cache (unless force refresh)
        if not force_refresh:
            cached = self._get_cached_results(normalized_query)
            if cached is not None:
                return self._apply_swap_ranking(cached, limit)
        
        # Step 2: Fetch from OFF API
        logger.info(f"Fetching from OFF API for query '{query}'")
        csv_content = self.fetch_csv(query)
        
        if not csv_content:
            logger.warning(f"No CSV content for query '{query}'")
            # Fall back to any existing cached data
            existing = OFFProduct.objects.filter(search_query=normalized_query)
            return self._apply_swap_ranking(existing, limit)
        
        # Step 3: Parse and clean
        raw_products = self.parse_csv(csv_content)
        cleaned_products = self.clean_data(raw_products)
        
        # Step 4: Store in database
        stored = self.store_products(cleaned_products, normalized_query)
        
        # Update cache tracking
        self._update_query_cache(normalized_query, len(stored))
        
        # Step 5: Return sorted results
        products = OFFProduct.objects.filter(search_query=normalized_query)
        return self._apply_swap_ranking(products, limit)
    
    def _apply_swap_ranking(
        self,
        queryset: QuerySet,
        limit: Optional[int] = None
    ) -> QuerySet:
        """
        Apply "Healthy Swap" ranking to queryset.
        
        Sorts by:
        1. Nutriscore Grade (A → E, with unknown last)
        2. NOVA Group (1 → 4, with null last)
        
        This ensures healthiest swaps appear first.
        """
        from django.db.models import Case, When, Value, IntegerField
        
        # Create custom ordering for nutriscore (a=1, b=2, ..., unknown=6)
        nutriscore_order = Case(
            When(nutriscore_grade='a', then=Value(1)),
            When(nutriscore_grade='b', then=Value(2)),
            When(nutriscore_grade='c', then=Value(3)),
            When(nutriscore_grade='d', then=Value(4)),
            When(nutriscore_grade='e', then=Value(5)),
            default=Value(6),
            output_field=IntegerField(),
        )
        
        # Create custom ordering for nova (1-4, null=5)
        nova_order = Case(
            When(nova_group=1, then=Value(1)),
            When(nova_group=2, then=Value(2)),
            When(nova_group=3, then=Value(3)),
            When(nova_group=4, then=Value(4)),
            default=Value(5),
            output_field=IntegerField(),
        )
        
        ranked = queryset.annotate(
            nutri_order=nutriscore_order,
            nova_order=nova_order
        ).order_by('nutri_order', 'nova_order', 'product_name')
        
        if limit:
            return ranked[:limit]
        
        return ranked
    
    def get_healthier_alternatives(
        self,
        product: OFFProduct,
        limit: int = 5
    ) -> QuerySet:
        """
        Find healthier alternatives to a given product.
        
        Searches products in the same category with better
        Nutriscore and/or NOVA scores.
        
        Args:
            product: Source product to find alternatives for
            limit: Maximum number of alternatives
            
        Returns:
            QuerySet of healthier OFFProduct alternatives
        """
        from django.db.models import Q
        
        # Build query for healthier products
        filters = Q()
        
        # Must be in same category (basic similarity)
        if product.categories:
            # Use first category for matching
            first_category = product.categories.split(',')[0].strip()
            if first_category:
                filters &= Q(categories__icontains=first_category)
        
        # Better nutriscore OR better nova
        if product.nutriscore_grade != 'a':
            grade_order = ['a', 'b', 'c', 'd', 'e']
            current_idx = grade_order.index(product.nutriscore_grade) if product.nutriscore_grade in grade_order else 4
            better_grades = grade_order[:current_idx]
            if better_grades:
                filters &= Q(nutriscore_grade__in=better_grades)
        
        if product.nova_group and product.nova_group > 1:
            better_nova = list(range(1, product.nova_group))
            filters |= Q(nova_group__in=better_nova)
        
        # Exclude the source product
        alternatives = OFFProduct.objects.filter(filters).exclude(
            code=product.code
        )
        
        return self._apply_swap_ranking(alternatives, limit)
