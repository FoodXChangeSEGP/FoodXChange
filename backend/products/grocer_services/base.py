"""
Base classes and data structures for grocer services.

This module defines the interface that all grocer services must implement,
as well as standardized data classes for product information.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional
from enum import Enum


class PriceMeasure(Enum):
    """Standard price measurement units."""
    UNIT = "unit"
    KG = "kg"
    LITRE = "litre"
    ML_100 = "100ml"
    G_100 = "100g"


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
    """
    
    # Subclasses should set this
    GROCER_ID: str = ""
    GROCER_NAME: str = ""
    
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
