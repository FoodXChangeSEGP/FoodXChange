# Grocer Services

This module provides a unified interface for fetching product data from various grocery retailer APIs.

## Architecture

```
grocer_services/
├── __init__.py          # Service registry and factory
├── base.py              # Abstract base class and data structures
├── sainsburys.py        # Sainsbury's implementation
├── tesco.py             # Tesco implementation
└── README.md            # This file
```

## Supported Grocers

| Grocer | ID | API Type | Notes |
|--------|-----|----------|-------|
| Sainsbury's | `sainsburys` | REST | Uses product search API |
| Tesco | `tesco` | GraphQL | Uses xapi.tesco.com |

## Adding a New Grocer

To add a new grocery retailer:

1. Create a new service file (e.g., `tesco.py`)
2. Inherit from `BaseGrocerService`
3. Implement the required methods:
   - `search_products(query, page, page_size)`
   - `get_product_by_id(product_id)`
4. Register in `__init__.py`'s `GROCER_SERVICES` dict

Example:

```python
from .base import BaseGrocerService, GrocerProduct, GrocerSearchResult

class TescoService(BaseGrocerService):
    GROCER_ID = "tesco"
    GROCER_NAME = "Tesco"
    
    def search_products(self, query, page=1, page_size=20):
        # Implementation here
        pass
    
    def get_product_by_id(self, product_id):
        # Implementation here
        pass
```

## API Endpoints

- `GET /api/grocers/` - List available grocers
- `GET /api/grocers/search/combined/?q=query` - **Recommended**: Combined search with deduplication and nutrition
- `GET /api/grocers/search/all/?q=query` - Search across all grocers (raw results)
- `GET /api/grocers/{grocer_id}/search/?q=query` - Search products at specific grocer
- `GET /api/grocers/{grocer_id}/products/{product_id}/` - Get product details
- `GET /api/grocers/{grocer_id}/barcode/{barcode}/` - Search by barcode

### Combined Search (Recommended)

The `/api/grocers/search/combined/` endpoint is the recommended way to search for products. It:

1. **Searches all grocers in parallel** for better performance
2. **Deduplicates products by barcode** - same product from different retailers is merged
3. **Combines relevance scores** - products found at multiple retailers rank higher
4. **Enriches with Open Food Facts data** - adds Nutri-Score, NOVA group, and traffic light nutrition info
5. **Provides price comparison** - shows cheapest retailer and potential savings

**Query Parameters:**
- `q` (required): Search query
- `page_size` (optional, default 20, max 50): Results per grocer
- `include_nutrition` (optional, default true): Fetch Open Food Facts data
- `grocers` (optional): Comma-separated list of grocer IDs to search

**Example Response:**
```json
{
  "products": [{
    "barcode": "5000112637922",
    "name": "Coca-Cola 2L",
    "prices": [
      {"grocer_id": "tesco", "price": "2.00", ...},
      {"grocer_id": "sainsburys", "price": "2.20", ...}
    ],
    "relevance_score": 285.0,
    "retailer_count": 2,
    "nutrition": {
      "nutriscore_grade": "e",
      "nova_group": 4,
      "traffic_light": {...}
    },
    "cheapest_price": "2.00",
    "cheapest_retailer": "tesco",
    "price_comparison": {
      "cheapest": {"grocer_id": "tesco", "price": "2.00"},
      "most_expensive": {"grocer_id": "sainsburys", "price": "2.20"},
      "potential_savings": "0.20",
      "savings_percent": 9.1
    }
  }],
  "summary": {
    "total_unique_products": 15,
    "products_at_multiple_retailers": 5,
    "products_with_nutrition_data": 12
  }
}
```

## Data Structures

### GrocerProduct

Standardized product data returned by all services:

```python
@dataclass
class GrocerProduct:
    grocer_id: str        # e.g., 'sainsburys'
    product_id: str       # Grocer's internal ID
    name: str
    description: str
    brand: Optional[str]
    barcodes: list[str]   # EANs for matching with OpenFoodFacts
    retail_price: GrocerPrice
    unit_price: GrocerPrice
    is_available: bool
    categories: list[str]
    image_url: Optional[str]
    promotions: list[GrocerPromotion]
    rating: Optional[float]
    review_count: Optional[int]
```

### GrocerSearchResult

Search results with pagination:

```python
@dataclass
class GrocerSearchResult:
    products: list[GrocerProduct]
    total_count: int
    page: int
    page_size: int
    has_more: bool
```

## Anti-Bot Measures

Many grocery retailer APIs have strong anti-bot protections. The services implement:

- Browser-like headers
- Retry logic with exponential backoff
- Session management

For production use, consider:

- Using proxy rotation services
- Implementing request rate limiting
- Caching responses
- Using a headless browser for initial session setup

## Future: OpenFoodFacts Integration

Products include `barcodes` (EAN codes) which can be used to:
1. Look up nutritional information from OpenFoodFacts
2. Get NOVA scores (1-4 processing level)
3. Get Nutri-Scores (A-E nutritional rating)

This allows enriching grocer product data with health information.
