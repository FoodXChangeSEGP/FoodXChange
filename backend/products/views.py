from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import AnonymousUser
from .models import UserList, MyListItem, CartItem, NewsArticle
from .serializers import UserListSerializer, MyListItemSerializer, CartItemSerializer, NewsArticleSerializer


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


class UserListViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing named user lists (multiple lists per user).
    """
    serializer_class = UserListSerializer
    permission_classes = [AllowAny]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if not user or isinstance(user, AnonymousUser):
            return UserList.objects.none()
        return UserList.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user or isinstance(user, AnonymousUser):
            return Response(
                {'detail': 'Authentication required.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


class MyListItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing items within a named user list.
    Pass ?list_id=<id> to filter by list.
    POST requires list_id in the body.
    """
    serializer_class = MyListItemSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        if not user or isinstance(user, AnonymousUser):
            return MyListItem.objects.none()
        qs = MyListItem.objects.filter(user_list__user=user)
        list_id = self.request.query_params.get('list_id')
        if list_id:
            qs = qs.filter(user_list_id=list_id)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user or isinstance(user, AnonymousUser):
            return Response(
                {'detail': 'Authentication required to save items.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        list_id = request.data.get('list_id')
        if not list_id:
            return Response(
                {'detail': 'list_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_list = UserList.objects.get(id=list_id, user=user)
        except UserList.DoesNotExist:
            return Response(
                {'detail': 'List not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        barcode = serializer.validated_data['barcode']
        name = serializer.validated_data['name']
        quantity = serializer.validated_data.get('quantity', 1)

        item, created = MyListItem.objects.get_or_create(
            user_list=user_list,
            barcode=barcode,
            defaults={'name': name, 'quantity': quantity},
        )

        if not created:
            item.quantity += quantity
            item.save()

        out_serializer = self.get_serializer(item)
        return Response(
            out_serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CartItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing shopping cart (user-scoped).
    Authenticated users get their own cart; anonymous users get empty.
    """
    serializer_class = CartItemSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        if not user or isinstance(user, AnonymousUser):
            return CartItem.objects.none()
        return CartItem.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user or isinstance(user, AnonymousUser):
            return Response(
                {'detail': 'Authentication required to save cart items.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        barcode = serializer.validated_data['barcode']
        defaults = {
            'name': serializer.validated_data.get('name', ''),
            'image_url': serializer.validated_data.get('image_url'),
            'quantity': serializer.validated_data.get('quantity', 1),
            'price': serializer.validated_data.get('price'),
            'retailer_name': serializer.validated_data.get('retailer_name', ''),
            'product_data': serializer.validated_data.get('product_data', {}),
        }

        item, created = CartItem.objects.update_or_create(
            user=user,
            barcode=barcode,
            defaults=defaults,
        )

        out_serializer = self.get_serializer(item)
        return Response(
            out_serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=['delete'])
    def clear(self, request):
        """Clear all cart items for the authenticated user."""
        user = request.user
        if not user or isinstance(user, AnonymousUser):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        CartItem.objects.filter(user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NewsArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for published news articles."""
    queryset = NewsArticle.objects.filter(is_published=True)
    serializer_class = NewsArticleSerializer
    permission_classes = [AllowAny]
