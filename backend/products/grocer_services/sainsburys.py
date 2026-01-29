"""
Sainsbury's Grocer Service

Implements the BaseGrocerService interface for Sainsbury's grocery API.
"""

import logging
import time
from decimal import Decimal
from typing import Optional
from urllib.parse import urlencode, quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.conf import settings

from .base import (
    BaseGrocerService,
    GrocerProduct,
    GrocerSearchResult,
    GrocerPrice,
    GrocerPromotion,
    PriceMeasure,
)


logger = logging.getLogger(__name__)


class SainsburysService(BaseGrocerService):
    """
    Service for fetching product data from Sainsbury's API.
    
    Note: Sainsbury's has strong anti-bot measures. This service uses
    browser-like headers and retry logic to handle rate limiting.
    """
    
    GROCER_ID = "sainsburys"
    GROCER_NAME = "Sainsbury's"
    
    BASE_URL = "https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1"
    
    # Default headers to mimic browser requests
    DEFAULT_HEADERS = {
        'Accept': 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Referer': 'https://www.sainsburys.co.uk/gol-ui/SearchResults/',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
    }
    
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        """
        Initialize the Sainsbury's service.
        
        Args:
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create a session with retry logic."""
        session = requests.Session()
        session.headers.update(self.DEFAULT_HEADERS)
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        return session
    
    def _make_request(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """
        Make a request to the Sainsbury's API.
        
        Args:
            endpoint: API endpoint path
            params: Query parameters
            
        Returns:
            JSON response as dict
            
        Raises:
            requests.RequestException: On API errors
        """
        url = f"{self.BASE_URL}/{endpoint}"
        
        try:
            response = self.session.get(
                url,
                params=params,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Sainsbury's API error: {e}")
            raise
    
    def _parse_price_measure(self, measure: str) -> PriceMeasure:
        """Convert Sainsbury's measure format to our standard format."""
        measure_map = {
            'unit': PriceMeasure.UNIT,
            'kg': PriceMeasure.KG,
            'ltr': PriceMeasure.LITRE,
            'litre': PriceMeasure.LITRE,
            'ml': PriceMeasure.ML_100,  # They usually show per 100ml
            'g': PriceMeasure.G_100,    # They usually show per 100g
        }
        return measure_map.get(measure.lower(), PriceMeasure.UNIT)
    
    def _parse_product(self, data: dict) -> GrocerProduct:
        """
        Parse a product from Sainsbury's API response format.
        
        Args:
            data: Raw product data from API
            
        Returns:
            Standardized GrocerProduct
        """
        # Parse retail price
        retail_price = None
        if 'retail_price' in data:
            rp = data['retail_price']
            retail_price = GrocerPrice(
                price=Decimal(str(rp.get('price', 0))),
                currency='GBP',
                measure=self._parse_price_measure(rp.get('measure', 'unit')),
            )
        
        # Parse unit price (price per kg/litre/etc)
        unit_price = None
        if 'unit_price' in data:
            up = data['unit_price']
            unit_price = GrocerPrice(
                price=Decimal(str(up.get('price', 0))),
                currency='GBP',
                measure=self._parse_price_measure(up.get('measure', 'unit')),
            )
        
        # Parse promotions
        promotions = []
        for promo in data.get('promotions', []):
            promotions.append(GrocerPromotion(
                description=promo.get('strap_line', ''),
                original_price=Decimal(str(promo['original_price'])) if promo.get('original_price') else None,
                promo_price=retail_price.price if retail_price else None,
                start_date=promo.get('start_date'),
                end_date=promo.get('end_date'),
            ))
        
        # If there's a promotion, mark the retail price as on sale
        if promotions and retail_price:
            retail_price.is_on_sale = True
            if promotions[0].original_price:
                retail_price.original_price = promotions[0].original_price
        
        # Parse categories
        categories = [cat.get('name', '') for cat in data.get('categories', []) if cat.get('name')]
        
        # Get brand from attributes
        brand = None
        attributes = data.get('attributes', {})
        if 'brand' in attributes and attributes['brand']:
            brand = attributes['brand'][0] if isinstance(attributes['brand'], list) else attributes['brand']
        
        # Parse reviews
        reviews = data.get('reviews', {})
        rating = reviews.get('average_rating')
        review_count = reviews.get('total')
        
        return GrocerProduct(
            grocer_id=self.GROCER_ID,
            product_id=str(data.get('product_uid', '')),
            name=data.get('name', ''),
            description='',  # Not provided in search results
            brand=brand,
            barcodes=data.get('eans', []),
            retail_price=retail_price,
            unit_price=unit_price,
            is_available=data.get('is_available', True),
            categories=categories,
            image_url=data.get('image'),
            thumbnail_url=data.get('image_thumbnail'),
            promotions=promotions,
            product_url=data.get('full_url'),
            rating=float(rating) if rating else None,
            review_count=int(review_count) if review_count else None,
            raw_data=data,
        )
    
    def search_products(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> GrocerSearchResult:
        """
        Search for products on Sainsbury's.
        
        Args:
            query: Search term
            page: Page number (1-indexed)
            page_size: Results per page (max 60)
            
        Returns:
            GrocerSearchResult with matching products
        """
        # Sainsbury's max page size is 60
        page_size = min(page_size, 60)
        
        # Build the URL with properly encoded parameters
        # Sainsbury's uses filter[keyword] format
        params = {
            'filter[keyword]': query,
            'page_number': page,
            'page_size': page_size,
            'sort_order': 'RELEVANCE',
        }
        
        # Make the request
        # We need to manually construct the URL because filter[keyword] needs special handling
        query_string = f"filter%5Bkeyword%5D={quote(query)}&page_number={page}&page_size={page_size}&sort_order=RELEVANCE"
        url = f"{self.BASE_URL}/product?{query_string}"
        
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            logger.error(f"Sainsbury's search error: {e}")
            # Return empty result on error
            return GrocerSearchResult(
                products=[],
                total_count=0,
                page=page,
                page_size=page_size,
                has_more=False,
            )
        
        # Parse products
        products = []
        for item in data.get('products', []):
            try:
                product = self._parse_product(item)
                products.append(product)
            except Exception as e:
                logger.warning(f"Failed to parse product: {e}")
                continue
        
        # Get pagination info from controls
        controls = data.get('controls', {})
        total_count = controls.get('total_record_count', len(products))
        page_info = controls.get('page', {})
        current_page = page_info.get('active', page)
        last_page = page_info.get('last', 1)
        
        return GrocerSearchResult(
            products=products,
            total_count=total_count,
            page=current_page,
            page_size=page_size,
            has_more=current_page < last_page,
        )
    
    def get_product_by_id(self, product_id: str) -> Optional[GrocerProduct]:
        """
        Get a specific product by its Sainsbury's product UID.
        
        Note: Sainsbury's doesn't have a direct product lookup endpoint,
        so this searches for the product ID.
        
        Args:
            product_id: Sainsbury's product_uid
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        # Try searching for the product ID
        result = self.search_products(product_id, page_size=10)
        
        for product in result.products:
            if product.product_id == product_id:
                return product
        
        return None
    
    def get_product_by_barcode(self, barcode: str) -> Optional[GrocerProduct]:
        """
        Get a product by its barcode/EAN.
        
        Args:
            barcode: EAN/UPC barcode
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        # Search for the barcode
        result = self.search_products(barcode, page_size=20)
        
        for product in result.products:
            # Check if any of the product's barcodes match
            for ean in product.barcodes:
                if ean == barcode or ean.lstrip('0') == barcode.lstrip('0'):
                    return product
        
        return None
