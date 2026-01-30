"""
Open Food Facts Search Service.

Fetches, processes, and stores product data from the Open Food Facts API.
"""

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
    Service for searching products from Open Food Facts API.
    
    Usage:
        service = SearchService()
        products = service.search("chocolate biscuits")
    """
    
    # UK subdomain for geo-filtered results
    BASE_URL = "https://uk.openfoodfacts.org/cgi/search.pl"
    
    # Required fields for data integrity
    REQUIRED_FIELDS = ['code', 'product_name', 'nutriscore_grade', 'image_url']
    
    # Stop words to remove from queries for normalization
    STOP_WORDS = {
        'a', 'an', 'the', 'of', 'loaf', 'packet', 'pack', 'bag', 'box', 
        'tin', 'can', 'jar', 'bottle', 'carton', 'some', 'any', 'fresh'
    }
    
    # Category keywords that indicate a different product type
    # e.g., "bread flour" is flour, not bread
    FALSE_POSITIVE_CATEGORIES = {
        'flour': {'flour', 'baking'},
        'mix': {'mix', 'baking'},
        'sauce': {'sauce', 'condiment'},
        'seasoning': {'seasoning', 'spice'},
    }
    
    # Cache duration in hours
    CACHE_DURATION_HOURS = 24
    
    def __init__(self, page_size: int = 50, timeout: int = 45):
        """
        Initialize SearchService.
        
        Args:
            page_size: Number of results to fetch from OFF API (default 50)
            timeout: Request timeout in seconds (default 45)
        """
        self.page_size = page_size
        self.timeout = timeout
    
    def normalize_query(self, query: str) -> str:
        """
        Normalize a search query for better fuzzy matching.
        
        - Converts to lowercase
        - Removes stop words (a, of, loaf, packet, etc.)
        - Strips extra whitespace
        
        Examples:
            "loaf of bread" -> "bread"
            "a packet of biscuits" -> "biscuits"
            "wholemeal bread" -> "wholemeal bread"
        """
        words = query.lower().split()
        filtered = [w for w in words if w not in self.STOP_WORDS]
        return ' '.join(filtered).strip()
    
    def _is_false_positive(self, product_name: str, categories: str, search_terms: list[str]) -> bool:
        """
        Check if a product is likely a false positive for the search.
        
        For example, "bread flour" is a false positive when searching for "bread"
        because it's flour, not bread.
        
        Args:
            product_name: The product name
            categories: The product categories
            search_terms: List of search terms
            
        Returns:
            True if likely a false positive
        """
        name_lower = product_name.lower()
        categories_lower = categories.lower() if categories else ''
        
        # Check each false positive category
        for exclude_word, category_markers in self.FALSE_POSITIVE_CATEGORIES.items():
            # If the product name contains the exclude word
            if exclude_word in name_lower:
                # And the search doesn't explicitly include that word
                if exclude_word not in search_terms:
                    # It's a false positive (e.g., "bread flour" when searching "bread")
                    return True
            
            # Also check if categories indicate it's a different product type
            for marker in category_markers:
                if marker in categories_lower and marker not in search_terms:
                    # Check if the actual searched product name matches
                    # Only exclude if none of the search terms appear as the main product
                    main_term_in_name = any(
                        term in name_lower and name_lower.index(term) < name_lower.index(marker)
                        if marker in name_lower else term in name_lower
                        for term in search_terms if len(term) > 2
                    )
                    if not main_term_in_name:
                        return True
        
        return False
    
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
            # Ranking by popularity (real products first)
            'sort_by': 'unique_scans_n',
            # JSON format (faster than CSV)
            'json': 'true',
            # Pagination
            'page_size': self.page_size,
            'page': page,
        }
        
        url = f"{self.BASE_URL}?{urlencode(params)}"
        logger.debug(f"Built OFF search URL: {url}")
        return url
    
    def fetch_json(self, query: str, page: int = 1) -> Optional[dict]:
        """
        Fetch JSON data from Open Food Facts API.
        
        Args:
            query: Search term
            page: Page number
            
        Returns:
            JSON response as dict, or None if request failed
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
            
            return response.json()
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch from OFF API: {e}")
            return None
        except ValueError as e:
            logger.error(f"Failed to parse JSON from OFF API: {e}")
            return None
    
    def parse_json_products(self, json_response: dict) -> list[dict]:
        """
        Parse JSON response into list of product dictionaries.
        
        Maps JSON field names to our expected format.
        
        Args:
            json_response: JSON response from OFF API
            
        Returns:
            List of product dictionaries
        """
        if not json_response:
            return []
        
        products = json_response.get('products', [])
        parsed = []
        
        for product in products:
            # Map JSON fields to our expected format
            parsed.append({
                'code': product.get('code', ''),
                'product_name': product.get('product_name', ''),
                'brands': product.get('brands', ''),
                'nutriscore_grade': product.get('nutriscore_grade', ''),
                'nova_group': product.get('nova_group', ''),
                'image_url': product.get('image_url', ''),
                'sugars_100g': product.get('nutriments', {}).get('sugars_100g', ''),
                'salt_100g': product.get('nutriments', {}).get('salt_100g', ''),
                'fat_100g': product.get('nutriments', {}).get('fat_100g', ''),
                'saturated-fat_100g': product.get('nutriments', {}).get('saturated-fat_100g', ''),
                'completeness': product.get('completeness', 0),
                'countries_en': product.get('countries', ''),
                'categories_en': product.get('categories', ''),
            })
        
        logger.info(f"Parsed {len(parsed)} products from JSON")
        return parsed
    
    def clean_data(self, products: list[dict]) -> list[dict]:
        """
        Apply data cleaning and filtering pipeline.
        
        Pipeline steps:
        1. Data Integrity: Drop rows missing required fields
        2. De-duplication: Keep highest completeness per brand+product_name
        
        Note: UK filtering is handled by using uk.openfoodfacts.org subdomain
        
        Args:
            products: Raw product list from API
            
        Returns:
            Cleaned and de-duplicated product list
        """
        if not products:
            return []
        
        cleaned = []
        
        # Step 1: Data integrity check
        for product in products:
            # Check required fields
            if not self._has_required_fields(product):
                continue
            
            cleaned.append(product)
        
        logger.info(f"After integrity filter: {len(cleaned)} products")
        
        # Step 2: De-duplication by brand + product_name
        deduplicated = self._deduplicate_products(cleaned)
        
        logger.info(f"After de-duplication: {len(deduplicated)} products")
        
        return deduplicated
    
    def filter_false_positives(self, products: list[dict], search_query: str) -> list[dict]:
        """
        Filter out false positive results based on search query.
        
        For example, removes "bread flour" when searching for "bread".
        
        Args:
            products: List of product dicts
            search_query: Original search query
            
        Returns:
            Filtered product list
        """
        search_terms = search_query.lower().split()
        filtered = []
        
        for product in products:
            product_name = product.get('product_name', '')
            categories = product.get('categories_en', '') or product.get('categories', '')
            
            if not self._is_false_positive(product_name, categories, search_terms):
                filtered.append(product)
        
        removed = len(products) - len(filtered)
        if removed > 0:
            logger.info(f"Filtered out {removed} false positive results")
        
        return filtered
    
    def _has_required_fields(self, product: dict) -> bool:
        """Check if product has all required fields with non-empty values."""
        for field in self.REQUIRED_FIELDS:
            value = product.get(field, '')
            # Handle both string and non-string values
            if value is None:
                return False
            if isinstance(value, str) and value.strip() == '':
                return False
            if not value and value != 0:  # Allow 0 as valid value
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
    
    def _parse_decimal(self, value) -> Optional[Decimal]:
        """Safely parse a decimal value from string or number."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            try:
                return Decimal(str(value))
            except (InvalidOperation, ValueError):
                return None
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    
    def _parse_int(self, value) -> Optional[int]:
        """Safely parse an integer value from string or number."""
        if value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
    
    def _normalize_nutriscore(self, grade) -> str:
        """Normalize nutriscore grade to lowercase single letter."""
        if not grade:
            return 'unknown'
        if isinstance(grade, str):
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
            code = product_data.get('code', '')
            # Handle code as string or int
            if isinstance(code, int):
                code = str(code)
            elif isinstance(code, str):
                code = code.strip()
            if not code:
                continue
            
            # Helper to safely get string values
            def get_str(key, default='', max_len=None):
                val = product_data.get(key, default)
                if val is None:
                    val = default
                if not isinstance(val, str):
                    val = str(val) if val else default
                if max_len:
                    val = val[:max_len]
                return val
            
            defaults = {
                'product_name': get_str('product_name', '', 500),
                'brands': get_str('brands', '', 255),
                'image_url': get_str('image_url', '', 500),
                'nutriscore_grade': self._normalize_nutriscore(
                    product_data.get('nutriscore_grade', '')
                ),
                'nova_group': self._parse_int(product_data.get('nova_group')),
                'sugars_100g': self._parse_decimal(product_data.get('sugars_100g')),
                'salt_100g': self._parse_decimal(product_data.get('salt_100g')),
                'fat_100g': self._parse_decimal(product_data.get('fat_100g')),
                'saturated_fat_100g': self._parse_decimal(
                    product_data.get('saturated-fat_100g')
                ),
                'completeness': self._parse_decimal(
                    product_data.get('completeness', 0)
                ) or Decimal('0'),
                'countries': get_str('countries_en', '', 500),
                'categories': get_str('categories_en', ''),
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
        sort_by: str = 'relevance',
        nutriscore_filter: Optional[list[str]] = None,
        nova_filter: Optional[list[int]] = None,
        exclude_no_nova: bool = False,
        exclude_no_nutriscore: bool = False,
    ) -> QuerySet:
        """
        Search for products with lazy loading from OFF API.
        
        Workflow:
        1. Normalize query (remove stop words for fuzzy matching)
        2. Check local DB cache first
        3. If empty/stale, fetch from OFF API
        4. Clean, filter false positives, and store results
        5. Return with configurable sorting and filtering
        
        Args:
            query: Search term
            force_refresh: Force fetch from API even if cached
            sort_by: Sort order - 'relevance', 'nutriscore', 'nova', 'name'
            nutriscore_filter: List of nutriscore grades to include (e.g., ['a', 'b'])
            nova_filter: List of NOVA groups to include (e.g., [1, 2])
            exclude_no_nova: Exclude products without NOVA score
            exclude_no_nutriscore: Exclude products with unknown nutriscore
            
        Returns:
            QuerySet of OFFProduct with applied sorting and filtering
        """
        if not query or not query.strip():
            return OFFProduct.objects.none()
        
        # Normalize query for better fuzzy matching
        # "loaf of bread" -> "bread", "a packet of biscuits" -> "biscuits"
        normalized_query = self.normalize_query(query)
        if not normalized_query:
            normalized_query = query.lower().strip()
        
        logger.info(f"Search query '{query}' normalized to '{normalized_query}'")
        
        # Step 1: Check cache (unless force refresh)
        if not force_refresh:
            cached = self._get_cached_results(normalized_query)
            if cached is not None:
                return self._apply_ranking_and_filters(
                    cached,
                    sort_by=sort_by,
                    search_query=normalized_query,
                    nutriscore_filter=nutriscore_filter,
                    nova_filter=nova_filter,
                    exclude_no_nova=exclude_no_nova,
                    exclude_no_nutriscore=exclude_no_nutriscore,
                )
        
        # Step 2: Fetch from OFF API (using JSON for better performance)
        logger.info(f"Fetching from OFF API for query '{normalized_query}'")
        json_response = self.fetch_json(normalized_query)
        
        if not json_response:
            logger.warning(f"No response from OFF API for query '{normalized_query}'")
            # Fall back to any existing cached data
            existing = OFFProduct.objects.filter(search_query=normalized_query)
            return self._apply_ranking_and_filters(
                existing,
                sort_by=sort_by,
                search_query=normalized_query,
                nutriscore_filter=nutriscore_filter,
                nova_filter=nova_filter,
                exclude_no_nova=exclude_no_nova,
                exclude_no_nutriscore=exclude_no_nutriscore,
            )
        
        # Step 3: Parse and clean
        raw_products = self.parse_json_products(json_response)
        cleaned_products = self.clean_data(raw_products)
        
        # Step 4: Filter false positives (e.g., "bread flour" for "bread" search)
        filtered_products = self.filter_false_positives(cleaned_products, normalized_query)
        
        # Step 5: Store in database
        stored = self.store_products(filtered_products, normalized_query)
        
        # Update cache tracking
        self._update_query_cache(normalized_query, len(stored))
        
        # Step 6: Return sorted results with filtering
        products = OFFProduct.objects.filter(search_query=normalized_query)
        return self._apply_ranking_and_filters(
            products,
            sort_by=sort_by,
            search_query=normalized_query,
            nutriscore_filter=nutriscore_filter,
            nova_filter=nova_filter,
            exclude_no_nova=exclude_no_nova,
            exclude_no_nutriscore=exclude_no_nutriscore,
        )
    
    def _apply_ranking_and_filters(
        self,
        queryset: QuerySet,
        sort_by: str = 'relevance',
        search_query: Optional[str] = None,
        nutriscore_filter: Optional[list[str]] = None,
        nova_filter: Optional[list[int]] = None,
        exclude_no_nova: bool = False,
        exclude_no_nutriscore: bool = False,
    ) -> QuerySet:
        """
        Apply sorting, ranking and filtering to queryset.
        
        Args:
            queryset: Base queryset to filter/sort
            sort_by: Sort order - 'relevance', 'nutriscore', 'nova', 'name'
            search_query: Original search query for false positive filtering
            nutriscore_filter: List of nutriscore grades to include
            nova_filter: List of NOVA groups to include
            exclude_no_nova: Exclude products without NOVA score
            exclude_no_nutriscore: Exclude products with unknown nutriscore
            
        Returns:
            Filtered and sorted QuerySet
        """
        from django.db.models import Case, When, Value, IntegerField, Q
        
        # Filter out false positives at query time
        if search_query:
            search_terms = search_query.lower().split()
            
            # Build exclusion filters for common false positive patterns
            exclusions = Q()
            for exclude_word in self.FALSE_POSITIVE_CATEGORIES.keys():
                if exclude_word not in search_terms:
                    # Exclude products with this word in the name
                    exclusions |= Q(product_name__icontains=exclude_word)
            
            if exclusions:
                queryset = queryset.exclude(exclusions)
                logger.debug(f"Applied false positive filter for query '{search_query}'")
        
        # Apply nutriscore filter
        if nutriscore_filter:
            queryset = queryset.filter(nutriscore_grade__in=nutriscore_filter)
        
        # Apply nova filter
        if nova_filter:
            queryset = queryset.filter(nova_group__in=nova_filter)
        
        # Exclude products without NOVA score
        if exclude_no_nova:
            queryset = queryset.exclude(nova_group__isnull=True)
        
        # Exclude products with unknown nutriscore
        if exclude_no_nutriscore:
            queryset = queryset.exclude(nutriscore_grade='unknown')
        
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
        
        # Annotate for sorting
        queryset = queryset.annotate(
            nutri_order=nutriscore_order,
            nova_order=nova_order
        )
        
        # Apply sort order
        if sort_by == 'relevance':
            # Sort by completeness (popularity proxy) descending, then nutriscore
            queryset = queryset.order_by('-completeness', 'nutri_order', 'nova_order', 'product_name')
        elif sort_by == 'nutriscore':
            # Sort by nutriscore (healthiest first)
            queryset = queryset.order_by('nutri_order', 'nova_order', 'product_name')
        elif sort_by == 'nova':
            # Sort by NOVA (least processed first)
            queryset = queryset.order_by('nova_order', 'nutri_order', 'product_name')
        elif sort_by == 'name':
            # Sort alphabetically
            queryset = queryset.order_by('product_name', 'nutri_order')
        else:
            # Default to relevance
            queryset = queryset.order_by('-completeness', 'nutri_order', 'nova_order', 'product_name')
        
        return queryset
    
    # Keep old method for backwards compatibility
    def _apply_swap_ranking(
        self,
        queryset: QuerySet,
        limit: Optional[int] = None,
        search_query: Optional[str] = None
    ) -> QuerySet:
        """
        Apply "Healthy Swap" ranking to queryset (legacy method).
        
        Sorts by:
        1. Nutriscore Grade (A → E, with unknown last)
        2. NOVA Group (1 → 4, with null last)
        
        This ensures healthiest swaps appear first.
        """
        result = self._apply_ranking_and_filters(
            queryset,
            sort_by='nutriscore',
            search_query=search_query
        )
        
        if limit:
            return result[:limit]
        
        return result
    
    def get_healthier_alternatives(
        self,
        product: OFFProduct,
        limit: int = 5
    ) -> QuerySet:
        """
        Find healthier alternatives to a given product.
        
        Searches products in the same category with better
        Nutriscore and/or NOVA scores. If no alternatives found
        in cache, searches OFF API for the product category.
        
        Args:
            product: Source product to find alternatives for
            limit: Maximum number of alternatives
            
        Returns:
            QuerySet of healthier OFFProduct alternatives
        """
        from django.db.models import Q
        
        # Must be in same category (basic similarity) - this is required
        first_category = None
        category_filter = Q()
        if product.categories:
            # Use first category for matching
            first_category = product.categories.split(',')[0].strip()
            if first_category:
                category_filter = Q(categories__icontains=first_category)
        
        # If no category, try matching by product name keywords
        if not first_category and product.product_name:
            # Extract main keywords from product name for similarity
            name_words = product.product_name.lower().split()
            # Filter out short/common words
            keywords = [w for w in name_words if len(w) > 3 and w not in self.STOP_WORDS]
            if keywords:
                # Use first significant keyword
                first_category = keywords[0]
                category_filter = Q(product_name__icontains=first_category)
        
        # If still no category info, we can't find meaningful alternatives
        if not category_filter:
            logger.warning(f"Cannot find alternatives for product {product.code}: no category or name info")
            return OFFProduct.objects.none()
        
        # Build health score filters (nutriscore OR nova must be better)
        health_filter = Q()
        grade_order = ['a', 'b', 'c', 'd', 'e']
        
        # Better nutriscore
        if product.nutriscore_grade and product.nutriscore_grade != 'a' and product.nutriscore_grade in grade_order:
            current_idx = grade_order.index(product.nutriscore_grade)
            better_grades = grade_order[:current_idx]
            if better_grades:
                health_filter |= Q(nutriscore_grade__in=better_grades)
        
        # Better nova group
        if product.nova_group and product.nova_group > 1:
            better_nova = list(range(1, product.nova_group))
            if better_nova:
                health_filter |= Q(nova_group__in=better_nova)
        
        # If product already has best scores, look for equally healthy alternatives
        if not health_filter:
            # Product is already very healthy (nutriscore A or nova 1)
            # Find alternatives with same or better scores in same category
            if product.nutriscore_grade == 'a':
                health_filter = Q(nutriscore_grade='a')
            elif product.nova_group == 1:
                health_filter = Q(nova_group=1)
            else:
                # Fallback: just find healthier products in category
                health_filter = Q(nutriscore_grade__in=['a', 'b']) | Q(nova_group__in=[1, 2])
        
        # Combine: must be in same category AND have better health scores
        filters = category_filter & health_filter
        
        # Exclude the source product
        alternatives = OFFProduct.objects.filter(filters).exclude(
            code=product.code
        )
        
        result = self._apply_swap_ranking(alternatives, limit)
        
        # If no alternatives found and we have a category, search OFF API
        if not result.exists() and first_category:
            logger.info(f"No cached alternatives found, searching OFF API for category '{first_category}'")
            
            # Search for products in the same category
            self.search(query=first_category, force_refresh=False)
            
            # Re-query after populating cache
            alternatives = OFFProduct.objects.filter(filters).exclude(
                code=product.code
            )
            result = self._apply_swap_ranking(alternatives, limit)
        
        return result
