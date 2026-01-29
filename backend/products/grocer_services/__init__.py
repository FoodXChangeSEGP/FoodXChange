"""
Grocer Services Module

This module provides a unified interface for fetching product data from various
grocery retailer APIs. Each grocer has its own service implementation that
conforms to the BaseGrocerService interface.

The design is extensible - to add a new grocer:
1. Create a new service class inheriting from BaseGrocerService
2. Implement the required methods (search_products, get_product_by_id)
3. Register it in GROCER_SERVICES dict

Supported grocers:
- Sainsbury's (sainsburys)
- Tesco (tesco)
"""

from .base import BaseGrocerService, GrocerProduct, GrocerSearchResult
from .sainsburys import SainsburysService
from .tesco import TescoService

# Registry of available grocer services
GROCER_SERVICES = {
    'sainsburys': SainsburysService,
    'tesco': TescoService,
}


def get_grocer_service(grocer_id: str) -> BaseGrocerService:
    """
    Factory function to get a grocer service instance.
    
    Args:
        grocer_id: Identifier for the grocer (e.g., 'sainsburys', 'tesco')
        
    Returns:
        An instance of the appropriate grocer service
        
    Raises:
        ValueError: If the grocer_id is not recognized
    """
    service_class = GROCER_SERVICES.get(grocer_id.lower())
    if not service_class:
        available = ', '.join(GROCER_SERVICES.keys())
        raise ValueError(
            f"Unknown grocer: {grocer_id}. Available grocers: {available}"
        )
    return service_class()


def get_available_grocers() -> list[str]:
    """Return list of available grocer IDs."""
    return list(GROCER_SERVICES.keys())


__all__ = [
    'BaseGrocerService',
    'GrocerProduct', 
    'GrocerSearchResult',
    'SainsburysService',
    'TescoService',
    'get_grocer_service',
    'get_available_grocers',
    'GROCER_SERVICES',
]
