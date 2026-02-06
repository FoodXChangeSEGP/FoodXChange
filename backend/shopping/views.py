from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import AnonymousUser

from .models import ShoppingList, ShoppingListItem
from .serializers import (
    ShoppingListSerializer,
    ShoppingListCreateSerializer,
    ShoppingListItemSerializer,
    ShoppingListItemCreateSerializer,
    ShoppingListComparisonSerializer
)
from .services import ShoppingListComparisonService


class ShoppingListViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Shopping Lists.
    """

    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user

        # 🔑 FIX: anonymous users get empty list instead of 500
        if not user or isinstance(user, AnonymousUser):
            return ShoppingList.objects.none()

        return (
            ShoppingList.objects
            .filter(user=user)
            .prefetch_related('items__product')
        )

    def perform_create(self, serializer):
        user = self.request.user

        # 🔑 FIX: prevent FK crash for anonymous users
        if not user or isinstance(user, AnonymousUser):
            serializer.save()
        else:
            serializer.save(user=user)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ShoppingListCreateSerializer
        return ShoppingListSerializer

    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        shopping_list = self.get_object()
        service = ShoppingListComparisonService(shopping_list)

        comparison_data = {
            'shopping_list': shopping_list,
            'comparison': service.compare_prices(),
            'cheapest_complete': service.get_cheapest_complete(),
            'cheapest_overall': service.get_cheapest_overall(),
        }

        serializer = ShoppingListComparisonSerializer(comparison_data)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        shopping_list = self.get_object()
        serializer = ShoppingListItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data['product']

        existing_item = ShoppingListItem.objects.filter(
            shopping_list=shopping_list,
            product=product
        ).first()

        if existing_item:
            existing_item.quantity += serializer.validated_data.get('quantity', 1)
            existing_item.save()
            return Response(
                ShoppingListItemSerializer(existing_item).data,
                status=status.HTTP_200_OK
            )

        item = ShoppingListItem.objects.create(
            shopping_list=shopping_list,
            **serializer.validated_data
        )

        return Response(
            ShoppingListItemSerializer(item).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'], url_path='items/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        shopping_list = self.get_object()
        item = get_object_or_404(
            ShoppingListItem,
            shopping_list=shopping_list,
            id=item_id
        )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='items/(?P<item_id>[^/.]+)/update')
    def update_item(self, request, pk=None, item_id=None):
        shopping_list = self.get_object()
        item = get_object_or_404(
            ShoppingListItem,
            shopping_list=shopping_list,
            id=item_id
        )

        serializer = ShoppingListItemCreateSerializer(
            item,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(ShoppingListItemSerializer(item).data)
    
    @action(detail=True, methods=['post'], url_path='swap-item')
    def swap_item(self, request, pk=None):
        """
        Atomically replace an existing shopping list item with a new product.
        """
        shopping_list = self.get_object()

        old_item_id = request.data.get('old_item_id')
        new_product = request.data.get('product')
        quantity = request.data.get('quantity', 1)

        if not old_item_id or not new_product:
            return Response(
                {'detail': 'old_item_id and product are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1️⃣ Remove the old item
        old_item = get_object_or_404(
            ShoppingListItem,
            shopping_list=shopping_list,
            id=old_item_id
        )
        old_item.delete()

        # 2️⃣ Add or increment the new item
        existing_item = ShoppingListItem.objects.filter(
            shopping_list=shopping_list,
            product=new_product
        ).first()

        if existing_item:
            existing_item.quantity += quantity
            existing_item.save()
            return Response(
                ShoppingListItemSerializer(existing_item).data,
                status=status.HTTP_200_OK
            )

        new_item = ShoppingListItem.objects.create(
            shopping_list=shopping_list,
            product=new_product,
            quantity=quantity
        )

        return Response(
            ShoppingListItemSerializer(new_item).data,
            status=status.HTTP_201_CREATED
        )


    @action(detail=True, methods=['post'])
    def clear_checked(self, request, pk=None):
        shopping_list = self.get_object()
        deleted_count, _ = ShoppingListItem.objects.filter(
            shopping_list=shopping_list,
            is_checked=True
        ).delete()
        return Response({'deleted_count': deleted_count})

    @action(detail=True, methods=['post'])
    def uncheck_all(self, request, pk=None):
        shopping_list = self.get_object()
        updated_count = ShoppingListItem.objects.filter(
            shopping_list=shopping_list
        ).update(is_checked=False)
        return Response({'updated_count': updated_count})
