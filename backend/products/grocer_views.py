"""
Views for grocer product search API.

These views provide endpoints for searching products across
different grocery retailers using their respective APIs.
"""

import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .grocer_services import (
    get_grocer_service,
    get_available_grocers,
    GROCER_SERVICES,
)
from .grocer_serializers import (
    GrocerProductSerializer,
    GrocerSearchResultSerializer,
)
from .combined_search_service import CombinedSearchService
from .combined_search_serializers import CombinedSearchResultSerializer


logger = logging.getLogger(__name__)


class GrocerListView(APIView):
    """
    List all available grocery retailers.
    
    GET /api/grocers/
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """Return list of available grocers."""
        grocers = []
        for grocer_id, service_class in GROCER_SERVICES.items():
            grocers.append({
                'id': grocer_id,
                'name': service_class.GROCER_NAME,
            })
        return Response(grocers)


class GrocerSearchView(APIView):
    """
    Search for products at a specific grocer.
    
    GET /api/grocers/{grocer_id}/search/?q=query&page=1&page_size=20
    """
    permission_classes = [AllowAny]
    
    def get(self, request, grocer_id):
        """
        Search for products.
        
        Query params:
            q: Search query (required)
            page: Page number (default: 1)
            page_size: Results per page (default: 20, max: 60)
        """
        # Validate grocer_id
        try:
            service = get_grocer_service(grocer_id)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get query params
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'error': 'Search query (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            page = int(request.query_params.get('page', 1))
            page = max(1, page)  # Ensure page >= 1
        except (ValueError, TypeError):
            page = 1
        
        try:
            page_size = int(request.query_params.get('page_size', 20))
            page_size = max(1, min(60, page_size))  # Clamp between 1 and 60
        except (ValueError, TypeError):
            page_size = 20
        
        # Perform search
        try:
            result = service.search_products(
                query=query,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.error(f"Search error for {grocer_id}: {e}")
            return Response(
                {'error': 'Failed to search products. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Serialize and return
        serializer = GrocerSearchResultSerializer(result)
        return Response(serializer.data)


class GrocerProductDetailView(APIView):
    """
    Get a specific product from a grocer.
    
    GET /api/grocers/{grocer_id}/products/{product_id}/
    """
    permission_classes = [AllowAny]
    
    def get(self, request, grocer_id, product_id):
        """Get product details by ID."""
        # Validate grocer_id
        try:
            service = get_grocer_service(grocer_id)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get product
        try:
            product = service.get_product_by_id(product_id)
        except Exception as e:
            logger.error(f"Product lookup error for {grocer_id}: {e}")
            return Response(
                {'error': 'Failed to fetch product. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        if not product:
            return Response(
                {'error': f'Product {product_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = GrocerProductSerializer(product)
        return Response(serializer.data)


class GrocerBarcodeSearchView(APIView):
    """
    Search for a product by barcode across a specific grocer.
    
    GET /api/grocers/{grocer_id}/barcode/{barcode}/
    """
    permission_classes = [AllowAny]
    
    def get(self, request, grocer_id, barcode):
        """Get product by barcode."""
        # Validate grocer_id
        try:
            service = get_grocer_service(grocer_id)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Search by barcode
        try:
            product = service.get_product_by_barcode(barcode)
        except Exception as e:
            logger.error(f"Barcode search error for {grocer_id}: {e}")
            return Response(
                {'error': 'Failed to search by barcode. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        if not product:
            return Response(
                {'error': f'Product with barcode {barcode} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = GrocerProductSerializer(product)
        return Response(serializer.data)


class MultiGrocerSearchView(APIView):
    """
    Search for products across all available grocers.
    
    GET /api/grocers/search/all/?q=query&page_size=10
    
    This searches each grocer and combines results.
    Useful for price comparison across retailers.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Search across all grocers.
        
        Query params:
            q: Search query (required)
            page_size: Results per grocer (default: 10, max: 20)
        """
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'error': 'Search query (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            page_size = int(request.query_params.get('page_size', 10))
            page_size = max(1, min(20, page_size))
        except (ValueError, TypeError):
            page_size = 10
        
        results = {}
        errors = []
        
        for grocer_id in get_available_grocers():
            try:
                service = get_grocer_service(grocer_id)
                result = service.search_products(
                    query=query,
                    page=1,
                    page_size=page_size,
                )
                serializer = GrocerSearchResultSerializer(result)
                results[grocer_id] = serializer.data
            except Exception as e:
                logger.error(f"Multi-search error for {grocer_id}: {e}")
                errors.append({
                    'grocer': grocer_id,
                    'error': str(e),
                })
        
        return Response({
            'query': query,
            'results': results,
            'errors': errors if errors else None,
        })


class CombinedSearchView(APIView):
    """
    Search for products across Tesco and Sainsbury's with deduplication and nutrition data.
    
    GET /api/grocers/search/combined/?q=query&page_size=20&include_nutrition=true
    
    This is the recommended endpoint for product search as it:
    - Searches Tesco and Sainsbury's in parallel
    - Deduplicates products by barcode
    - Uses grocer-provided relevance ordering
    - Enriches with Open Food Facts nutrition data ONLY when barcode matches
    - Provides price comparison across retailers
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        """
        Search with deduplication and nutrition enrichment.
        
        Query params:
            q: Search query (required)
            page_size: Results per grocer (default: 20, max: 50)
            include_nutrition: Whether to fetch OFF data (default: true)
            grocers: Comma-separated list of grocer IDs (default: tesco,sainsburys)
        """
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'error': 'Search query (q) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            page_size = int(request.query_params.get('page_size', 20))
            page_size = max(1, min(50, page_size))
        except (ValueError, TypeError):
            page_size = 20
        
        # Parse include_nutrition (default True)
        include_nutrition_param = request.query_params.get('include_nutrition', 'true')
        include_nutrition = include_nutrition_param.lower() not in ('false', '0', 'no')
        
        # Parse grocer list (optional)
        grocers_param = request.query_params.get('grocers', '').strip()
        grocer_ids = None
        if grocers_param:
            grocer_ids = [g.strip() for g in grocers_param.split(',') if g.strip()]
        
        # Perform combined search
        try:
            service = CombinedSearchService()
            result = service.search(
                query=query,
                page_size=page_size,
                include_nutrition=include_nutrition,
                grocer_ids=grocer_ids,
            )
        except Exception as e:
            logger.error(f"Combined search error: {e}")
            return Response(
                {'error': 'Failed to search products. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Serialize and return
        serializer = CombinedSearchResultSerializer(result)
        return Response(serializer.data)


class BarcodeCompareView(APIView):
    """
    Compare prices for a product across retailers by barcode.
    
    GET /api/grocers/compare/{barcode}/
    
    This endpoint:
    - Searches all primary grocers (Tesco, Sainsbury's) for the barcode
    - Returns combined pricing information if found
    - Enriches with Open Food Facts nutrition data if barcode matches
    - Useful for price comparison of specific products
    """
    permission_classes = [AllowAny]
    
    def get(self, request, barcode):
        """
        Get price comparison for a specific barcode.
        
        Path params:
            barcode: Product barcode (EAN-13 or EAN-8)
        
        Returns:
            Product with prices from all retailers that stock it,
            or 404 if not found at any retailer.
        """
        # Validate barcode format
        cleaned_barcode = barcode.strip()

        # Normalise 14-digit barcodes
        if len(cleaned_barcode) == 14 and cleaned_barcode.startswith("0"):
            cleaned_barcode = cleaned_barcode[1:]

        if not cleaned_barcode.isdigit():
            return Response(
                {'error': 'Invalid barcode format. Must contain only digits.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Remove leading zero if 14 digits
        if len(cleaned_barcode) == 14 and cleaned_barcode.startswith("0"):
            cleaned_barcode = cleaned_barcode[1:]

        if len(cleaned_barcode) not in (8, 13):
            return Response(
                {'error': 'Invalid barcode format. Expected EAN-8 or EAN-13.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = CombinedSearchService()
            product = service.compare_by_barcode(cleaned_barcode)
        except Exception as e:
            logger.error(f"Barcode compare error for {barcode}: {e}")
            return Response(
                {'error': 'Failed to compare prices. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        if not product:
            return Response(
                {'error': f'Product with barcode {barcode} not found at any retailer'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Serialize and return
        from .combined_search_serializers import CombinedProductSerializer
        serializer = CombinedProductSerializer(product)
        return Response(serializer.data)


class ShoppingListCompareView(APIView):
    """
    Compare prices for a shopping list across retailers.
    
    POST /api/grocers/compare-list/
    
    This endpoint:
    - Accepts a list of products (barcodes or product names with quantities)
    - Calculates total price at each retailer
    - Finds the cheapest single retailer option
    - Finds the cheapest combination of retailers (if applicable)
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """
        Compare shopping list prices across retailers.
        
        Request body:
            {
                "items": [
                    {"barcode": "5000128000000", "quantity": 2},
                    {"barcode": "5000157000000", "quantity": 1}
                ]
            }
        
        Returns:
            {
                "items": [...],  // Products with prices
                "retailer_totals": {...},  // Total by retailer
                "cheapest_single_retailer": {...},  // Best single retailer
                "cheapest_combination": {...},  // Optimal multi-retailer split
                "summary": {...}
            }
        """
        items_data = request.data.get('items', [])
        
        if not items_data:
            return Response(
                {'error': 'No items provided. Expected: {"items": [{"barcode": "...", "quantity": 1}]}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = CombinedSearchService()
        
        # Fetch all products
        products_with_prices = []
        missing_products = []
        
        for item in items_data:
            barcode = item.get('barcode', '').strip()
            quantity = item.get('quantity', 1)
            
            if not barcode:
                continue
            
            try:
                product = service.compare_by_barcode(barcode)
                if product:
                    products_with_prices.append({
                        'barcode': barcode,
                        'name': product.name,
                        'quantity': quantity,
                        'prices': [
                            {
                                'grocer_id': p.grocer_id,
                                'grocer_name': p.grocer_name,
                                'price': str(p.price),
                                'total': str(p.price * quantity),
                            }
                            for p in product.prices
                        ],
                        'cheapest_price': str(product.cheapest_price) if product.cheapest_price else None,
                        'cheapest_retailer': product.cheapest_retailer,
                    })
                else:
                    missing_products.append(barcode)
            except Exception as e:
                logger.error(f"Error fetching product {barcode}: {e}")
                missing_products.append(barcode)
        
        # Calculate totals by retailer
        retailer_totals = {}
        for product in products_with_prices:
            for price_info in product['prices']:
                grocer_id = price_info['grocer_id']
                grocer_name = price_info['grocer_name']
                if grocer_id not in retailer_totals:
                    retailer_totals[grocer_id] = {
                        'grocer_id': grocer_id,
                        'grocer_name': grocer_name,
                        'total': 0,
                        'items_available': 0,
                        'items_total': len(products_with_prices),
                        'products': [],
                    }
                
                total_for_item = float(price_info['total'])
                retailer_totals[grocer_id]['total'] += total_for_item
                retailer_totals[grocer_id]['items_available'] += 1
                retailer_totals[grocer_id]['products'].append({
                    'name': product['name'],
                    'quantity': product['quantity'],
                    'unit_price': price_info['price'],
                    'total': price_info['total'],
                })
        
        # Format totals
        for grocer_id in retailer_totals:
            retailer_totals[grocer_id]['total'] = f"{retailer_totals[grocer_id]['total']:.2f}"
            retailer_totals[grocer_id]['is_complete'] = (
                retailer_totals[grocer_id]['items_available'] == retailer_totals[grocer_id]['items_total']
            )
        
        # Find cheapest single retailer (with all items)
        complete_retailers = [
            r for r in retailer_totals.values() if r['is_complete']
        ]
        cheapest_single = None
        if complete_retailers:
            cheapest_single = min(complete_retailers, key=lambda r: float(r['total']))
        
        # Find cheapest combination (pick cheapest price for each item)
        cheapest_combination = self._calculate_cheapest_combination(products_with_prices)
        
        # Calculate potential savings
        savings = None
        if cheapest_single and cheapest_combination:
            single_total = float(cheapest_single['total'])
            combo_total = float(cheapest_combination['total'])
            if combo_total < single_total:
                savings = {
                    'amount': f"{single_total - combo_total:.2f}",
                    'percentage': f"{((single_total - combo_total) / single_total) * 100:.1f}",
                }
        
        return Response({
            'items': products_with_prices,
            'missing_products': missing_products,
            'retailer_totals': list(retailer_totals.values()),
            'cheapest_single_retailer': cheapest_single,
            'cheapest_combination': cheapest_combination,
            'potential_savings': savings,
            'summary': {
                'total_items': len(items_data),
                'items_found': len(products_with_prices),
                'items_missing': len(missing_products),
                'retailers_checked': list(retailer_totals.keys()),
            }
        })
    
    def _calculate_cheapest_combination(self, products):
        """
        Calculate the cheapest combination of retailers for a shopping list.
        
        For each product, picks the cheapest available retailer.
        """
        if not products:
            return None
        
        total = 0
        retailer_items = {}  # grocer_id -> list of items
        
        for product in products:
            if not product['prices']:
                continue
            
            # Find cheapest price for this product
            cheapest_price = min(product['prices'], key=lambda p: float(p['price']))
            grocer_id = cheapest_price['grocer_id']
            grocer_name = cheapest_price['grocer_name']
            
            if grocer_id not in retailer_items:
                retailer_items[grocer_id] = {
                    'grocer_id': grocer_id,
                    'grocer_name': grocer_name,
                    'items': [],
                    'subtotal': 0,
                }
            
            item_total = float(cheapest_price['total'])
            retailer_items[grocer_id]['items'].append(product['name'])
            retailer_items[grocer_id]['subtotal'] += item_total
            total += item_total
        
        # Format subtotals
        for grocer_id in retailer_items:
            retailer_items[grocer_id]['subtotal'] = f"{retailer_items[grocer_id]['subtotal']:.2f}"
        
        return {
            'retailers': list(retailer_items.values()),
            'total': f"{total:.2f}",
            'num_retailers': len(retailer_items),
        }

