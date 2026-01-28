"""
Views for Open Food Facts product search and Healthy Swap functionality.
"""

import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .off_models import OFFProduct
from .off_serializers import (
    OFFProductListSerializer,
    OFFProductDetailSerializer,
    HealthySwapSerializer,
)
from .search_service import SearchService


logger = logging.getLogger(__name__)


class OFFProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for browsing cached OFF products.
    
    Provides read-only access to products already fetched from Open Food Facts.
    For searching new products, use the /api/off/search/ endpoint.
    """
    queryset = OFFProduct.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['nutriscore_grade', 'nova_group', 'brands']
    search_fields = ['product_name', 'brands', 'categories']
    ordering_fields = ['product_name', 'nutriscore_grade', 'nova_group', 'updated_at']
    ordering = ['nutriscore_grade', 'nova_group', 'product_name']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return OFFProductListSerializer
        return OFFProductDetailSerializer
    
    @action(detail=True, methods=['get'])
    def alternatives(self, request, pk=None):
        """
        Get healthier alternatives for a specific product.
        
        Returns products with better Nutriscore and/or NOVA scores.
        """
        product = self.get_object()
        service = SearchService()
        
        limit = request.query_params.get('limit', 5)
        try:
            limit = int(limit)
        except ValueError:
            limit = 5
        
        alternatives = service.get_healthier_alternatives(product, limit=limit)
        
        serializer = HealthySwapSerializer({
            'original': product,
            'alternatives': list(alternatives),
        })
        
        return Response(serializer.data)


class OFFSearchView(APIView):
    """
    Search for products in the Open Food Facts database.
    
    This endpoint implements lazy loading:
    1. First checks local database cache
    2. If cache is empty/stale, fetches from OFF API
    3. Cleans and stores results locally
    4. Returns results ranked by health scores (Nutriscore, NOVA)
    
    Query Parameters:
        q (required): Search term
        limit (optional): Max results to return (default: 20)
        refresh (optional): Force refresh from OFF API (default: false)
    
    Example:
        GET /api/off/search/?q=chocolate+biscuits
        GET /api/off/search/?q=milk&limit=10&refresh=true
    """
    
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query:
            return Response(
                {'error': 'Search query "q" parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse optional parameters
        try:
            limit = int(request.query_params.get('limit', 20))
            limit = min(limit, 100)  # Cap at 100
        except ValueError:
            limit = 20
        
        force_refresh = request.query_params.get('refresh', 'false').lower() == 'true'
        
        # Perform search
        service = SearchService()
        
        try:
            products = service.search(
                query=query,
                force_refresh=force_refresh,
                limit=limit
            )
            
            # Serialize results
            serializer = OFFProductListSerializer(products, many=True)
            
            return Response({
                'query': query,
                'count': len(serializer.data),
                'results': serializer.data,
            })
            
        except Exception as e:
            logger.error(f"Search error for '{query}': {e}")
            return Response(
                {'error': 'Search failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class HealthySwapView(APIView):
    """
    Find healthier alternatives to a product.
    
    Can search by:
    - Product barcode (code)
    - Product ID (if already in database)
    - Search term (finds best match first, then alternatives)
    
    Query Parameters:
        code (optional): EAN/Barcode to look up
        id (optional): Database ID of product
        q (optional): Search term to find product
        limit (optional): Max alternatives to return (default: 5)
    
    Example:
        GET /api/off/swap/?code=5000159407236
        GET /api/off/swap/?q=digestive+biscuits&limit=3
    """
    
    def get(self, request):
        code = request.query_params.get('code', '').strip()
        product_id = request.query_params.get('id', '').strip()
        query = request.query_params.get('q', '').strip()
        
        try:
            limit = int(request.query_params.get('limit', 5))
            limit = min(limit, 20)  # Cap at 20
        except ValueError:
            limit = 5
        
        product = None
        service = SearchService()
        
        # Find the source product
        if code:
            try:
                product = OFFProduct.objects.get(code=code)
            except OFFProduct.DoesNotExist:
                return Response(
                    {'error': f'Product with code {code} not found. Search for it first.'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        elif product_id:
            try:
                product = OFFProduct.objects.get(id=product_id)
            except OFFProduct.DoesNotExist:
                return Response(
                    {'error': f'Product with ID {product_id} not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        elif query:
            # Search and get the first result
            products = service.search(query=query, limit=1)
            if products.exists():
                product = products.first()
            else:
                return Response(
                    {'error': f'No products found for "{query}"'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        else:
            return Response(
                {'error': 'Provide "code", "id", or "q" parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get healthier alternatives
        alternatives = service.get_healthier_alternatives(product, limit=limit)
        
        serializer = HealthySwapSerializer({
            'original': product,
            'alternatives': list(alternatives),
        })
        
        return Response(serializer.data)


class ProductLookupView(APIView):
    """
    Look up a single product by barcode.
    
    Fetches from OFF API if not in local database.
    
    Path Parameter:
        code: EAN/Barcode of the product
    
    Example:
        GET /api/off/product/5000159407236/
    """
    
    def get(self, request, code):
        if not code:
            return Response(
                {'error': 'Barcode is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try local database first
        try:
            product = OFFProduct.objects.get(code=code)
            
            # Check if stale
            if product.is_stale:
                logger.info(f"Product {code} is stale, could refresh from API")
            
            serializer = OFFProductDetailSerializer(product)
            return Response(serializer.data)
            
        except OFFProduct.DoesNotExist:
            pass
        
        # Fetch from OFF API
        # Note: For single product lookup, we'd use a different API endpoint
        # For now, we search by barcode
        service = SearchService()
        products = service.search(query=code, limit=1)
        
        if products.exists():
            product = products.filter(code=code).first()
            if product:
                serializer = OFFProductDetailSerializer(product)
                return Response(serializer.data)
        
        return Response(
            {'error': f'Product with barcode {code} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
