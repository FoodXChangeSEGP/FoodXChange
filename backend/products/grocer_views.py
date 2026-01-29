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
    Search for products across all grocers with deduplication and nutrition data.
    
    GET /api/grocers/search/combined/?q=query&page_size=20&include_nutrition=true
    
    This is the recommended endpoint for product search as it:
    - Searches all grocers in parallel
    - Deduplicates products by barcode
    - Combines relevance scores (products at multiple retailers rank higher)
    - Enriches with Open Food Facts nutrition data (Nutri-Score, NOVA, traffic lights)
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
            grocers: Comma-separated list of grocer IDs (default: all)
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
