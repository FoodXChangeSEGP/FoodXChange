"""
Base classes and data structures for grocer services.

This module defines the interface that all grocer services must implement,
as well as standardized data classes for product information.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from enum import Enum

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


class PriceMeasure(Enum):
    """Standard price measurement units."""
    UNIT = "unit"
    KG = "kg"
    LITRE = "litre"
    ML_100 = "100ml"
    G_100 = "100g"


# Mapping of common measure strings to PriceMeasure enum
# Shared across all grocer services
MEASURE_MAPPINGS = {
    'unit': PriceMeasure.UNIT,
    'each': PriceMeasure.UNIT,
    'kg': PriceMeasure.KG,
    'ltr': PriceMeasure.LITRE,
    'litre': PriceMeasure.LITRE,
    'l': PriceMeasure.LITRE,
    'ml': PriceMeasure.ML_100,
    '100ml': PriceMeasure.ML_100,
    'g': PriceMeasure.G_100,
    '100g': PriceMeasure.G_100,
}


def parse_price_measure(measure: Optional[str]) -> PriceMeasure:
    """
    Convert a measure string to PriceMeasure enum.
    
    Args:
        measure: Measure string from grocer API (e.g., 'kg', 'ltr', 'each')
        
    Returns:
        Corresponding PriceMeasure enum value, defaults to UNIT
    """
    if not measure:
        return PriceMeasure.UNIT
    return MEASURE_MAPPINGS.get(measure.lower(), PriceMeasure.UNIT)


@dataclass
class GrocerPrice:
    """Standardized price information."""
    price: Decimal
    currency: str = "GBP"
    measure: PriceMeasure = PriceMeasure.UNIT
    original_price: Optional[Decimal] = None  # For sale items
    is_on_sale: bool = False


@dataclass
class GrocerPromotion:
    """Promotion/offer information."""
    description: str
    original_price: Optional[Decimal] = None
    promo_price: Optional[Decimal] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@dataclass
class GrocerProduct:
    """
    Standardized product data from any grocer.
    
    This is the common format that all grocer services return,
    regardless of the underlying API structure.
    """
    # Identifiers
    grocer_id: str  # Which grocer this came from (e.g., 'sainsburys')
    product_id: str  # Grocer's internal product ID
    
    # Basic info
    name: str
    description: str = ""
    brand: Optional[str] = None
    
    # Barcodes (EANs) - used to match with Open Food Facts
    barcodes: list[str] = field(default_factory=list)
    
    # Pricing
    retail_price: Optional[GrocerPrice] = None
    unit_price: Optional[GrocerPrice] = None  # Price per kg/litre/etc
    
    # Availability
    is_available: bool = True
    
    # Categories
    categories: list[str] = field(default_factory=list)
    
    # Images (for future use)
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    
    # Promotions
    promotions: list[GrocerPromotion] = field(default_factory=list)
    
    # Product URL on grocer's website
    product_url: Optional[str] = None
    
    # Reviews
    rating: Optional[float] = None
    review_count: Optional[int] = None
    
    # Raw data from API (for debugging/future use)
    raw_data: Optional[dict] = None

    def get_effective_price(self) -> Optional[Decimal]:
        """Get the actual price to pay (considering promotions)."""
        if self.promotions and self.promotions[0].promo_price:
            return self.promotions[0].promo_price
        return self.retail_price.price if self.retail_price else None

    def get_primary_barcode(self) -> Optional[str]:
        """Get the primary barcode (first valid EAN-13)."""
        for barcode in self.barcodes:
            # EAN-13 barcodes are 13 digits, EAN-8 are 8 digits
            cleaned = barcode.replace(" ", "").lstrip("0")
            if len(barcode) in (8, 13) and barcode.isdigit():
                return barcode
        return self.barcodes[0] if self.barcodes else None


@dataclass
class GrocerSearchResult:
    """Result from a product search."""
    products: list[GrocerProduct]
    total_count: int
    page: int
    page_size: int
    has_more: bool
    
    @property
    def total_pages(self) -> int:
        """Calculate total number of pages."""
        if self.page_size <= 0:
            return 0
        return (self.total_count + self.page_size - 1) // self.page_size


class BaseGrocerService(ABC):
    """
    Abstract base class for grocer services.
    
    All grocer implementations must inherit from this class and
    implement the required abstract methods.
    
    Provides common functionality for HTTP session management,
    retry logic, and request tracing.
    """
    
    # Subclasses should set these
    GROCER_ID: str = ""
    GROCER_NAME: str = ""
    BASE_URL: str = ""
    
    # Default headers - subclasses can override
    DEFAULT_HEADERS: dict = {
        'Accept': 'application/json',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Connection': 'keep-alive',
    }
    
    # Status codes to retry on - subclasses can override
    RETRY_STATUS_CODES: list = [429, 502, 503, 504]
    
    # HTTP method for retry strategy - subclasses should override
    RETRY_METHODS: list = ["GET"]
    
    def __init__(self, timeout: int = 30, max_retries: int = 3):
        """
        Initialize the grocer service.
        
        Args:
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
        """
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """
        Create a requests session with retry logic.
        
        Subclasses can override to customize session setup.
        """
        session = requests.Session()
        session.headers.update(self.DEFAULT_HEADERS)
        
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=0.5,
            status_forcelist=self.RETRY_STATUS_CODES,
            allowed_methods=self.RETRY_METHODS,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        
        return session
    
    def _generate_trace_id(self) -> str:
        """Generate a unique trace ID for request tracing (UUID format)."""
        return str(uuid.uuid4())
    
    def _generate_hex_trace_id(self, length: int = 32) -> str:
        """Generate a hex trace ID of specified length."""
        full_hex = uuid.uuid4().hex
        return full_hex[:length] if length < 32 else full_hex
    
    @abstractmethod
    def search_products(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> GrocerSearchResult:
        """
        Search for products by keyword.
        
        Args:
            query: Search term (e.g., "orange juice")
            page: Page number (1-indexed)
            page_size: Number of results per page
            
        Returns:
            GrocerSearchResult containing matching products
        """
        pass
    
    @abstractmethod
    def get_product_by_id(self, product_id: str) -> Optional[GrocerProduct]:
        """
        Get a specific product by its grocer-specific ID.
        
        Args:
            product_id: The grocer's internal product ID
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        pass
    
    def get_product_by_barcode(self, barcode: str) -> Optional[GrocerProduct]:
        """
        Get a product by its barcode/EAN.
        
        Default implementation searches for the barcode.
        Subclasses can override for more efficient lookup.
        
        Args:
            barcode: EAN/UPC barcode
            
        Returns:
            GrocerProduct if found, None otherwise
        """
        result = self.search_products(barcode, page_size=5)
        for product in result.products:
            if barcode in product.barcodes:
                return product
        return None
