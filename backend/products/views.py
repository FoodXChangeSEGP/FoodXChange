from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from .models import MyListItem
from .serializers import MyListItemSerializer


from .models import Product, Retailer, ProductPrice
from .serializers import (
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
    RetailerSerializer,
    ProductPriceSerializer
)
from .filters import ProductFilter


class RetailerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Retailers.
    
    list: Get all retailers
    retrieve: Get a specific retailer
    create: Create a new retailer
    update: Update a retailer
    destroy: Delete a retailer
    """
    queryset = Retailer.objects.all()
    serializer_class = RetailerSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Products.
    
    list: Get all products with filtering and search
    retrieve: Get a specific product with all prices
    create: Create a new product
    update: Update a product
    destroy: Delete a product
    """
    queryset = Product.objects.prefetch_related('prices__retailer').all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ['name', 'description', 'category']
    ordering_fields = ['name', 'nova_score', 'nutri_score', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer

    @action(detail=True, methods=['get'])
    def prices(self, request, pk=None):
        """Get all prices for a specific product."""
        product = self.get_object()
        prices = product.prices.select_related('retailer').all()
        serializer = ProductPriceSerializer(prices, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all unique product categories."""
        categories = Product.objects.values_list(
            'category', flat=True
        ).distinct().order_by('category')
        return Response(list(categories))

    @action(detail=False, methods=['get'])
    def low_processing(self, request):
        """Get products with low processing (Nova score 1-2)."""
        queryset = self.filter_queryset(
            self.get_queryset().filter(nova_score__lte=2)
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ProductListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ProductListSerializer(queryset, many=True)
        return Response(serializer.data)


class ProductPriceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Product Prices.
    """
    queryset = ProductPrice.objects.select_related('product', 'retailer').all()
    serializer_class = ProductPriceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['product', 'retailer', 'in_stock', 'is_on_sale']
    ordering_fields = ['price', 'last_updated']
    ordering = ['price']

    def create(self, request, *args, **kwargs):
        """Create or update a product price."""
        product_id = request.data.get('product')
        retailer_id = request.data.get('retailer_id')
        
        # Check if price already exists for this product-retailer pair
        existing = ProductPrice.objects.filter(
            product_id=product_id,
            retailer_id=retailer_id
        ).first()
        
        if existing:
            # Update existing price
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Create new price
        return super().create(request, *args, **kwargs)
    
##class MyListItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing a user's MyList.
    
    serializer_class = MyListItemSerializer
    permission_classes = []

    def get_queryset(self):
        return MyListItem.objects.select_related('product').filter(product__isnull=False)

    def perform_create(self, serializer):
        product = serializer.validated_data['product']
        quantity = serializer.validated_data.get('quantity', 1)

        item, created = MyListItem.objects.get_or_create(
            product=product,
            defaults={'quantity': quantity}
        )

        if not created:
            item.quantity += quantity
            item.save()
"""

class MyListItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing MyList.
    """
    serializer_class = MyListItemSerializer
    permission_classes = []

    def get_queryset(self):
        return MyListItem.objects.all()

    def perform_create(self, serializer):
        barcode = serializer.validated_data['barcode']
        name = serializer.validated_data['name']
        quantity = serializer.validated_data.get('quantity', 1)

        item, created = MyListItem.objects.get_or_create(
            barcode=barcode,
            defaults={
                'name': name,
                'quantity': quantity,
            }
        )

        if not created:
            item.quantity += quantity
            item.save()
