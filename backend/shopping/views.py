from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

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
    
    list: Get all shopping lists for the authenticated user
    retrieve: Get a specific shopping list with all items
    create: Create a new shopping list
    update: Update a shopping list
    destroy: Delete a shopping list
    compare: Compare prices across all retailers
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ShoppingList.objects.filter(
            user=self.request.user
        ).prefetch_related('items__product')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ShoppingListCreateSerializer
        return ShoppingListSerializer

    @action(detail=True, methods=['get'])
    def compare(self, request, pk=None):
        """
        Compare the shopping list prices across all retailers.
        
        Returns:
        - comparison: List of retailer comparisons sorted by cheapest
        - cheapest_complete: The cheapest retailer with all items
        - cheapest_overall: The cheapest retailer (may have missing items)
        """
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
        """Add an item to the shopping list."""
        shopping_list = self.get_object()
        serializer = ShoppingListItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        product = serializer.validated_data['product']
        
        # Check if item already exists
        existing_item = ShoppingListItem.objects.filter(
            shopping_list=shopping_list,
            product=product
        ).first()
        
        if existing_item:
            # Update quantity instead of creating duplicate
            existing_item.quantity += serializer.validated_data.get('quantity', 1)
            existing_item.save()
            response_serializer = ShoppingListItemSerializer(existing_item)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        
        # Create new item
        item = ShoppingListItem.objects.create(
            shopping_list=shopping_list,
            **serializer.validated_data
        )
        response_serializer = ShoppingListItemSerializer(item)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='items/(?P<item_id>[^/.]+)')
    def remove_item(self, request, pk=None, item_id=None):
        """Remove an item from the shopping list."""
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
        """Update an item in the shopping list (quantity, is_checked, notes)."""
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
        
        response_serializer = ShoppingListItemSerializer(item)
        return Response(response_serializer.data)

    @action(detail=True, methods=['post'])
    def clear_checked(self, request, pk=None):
        """Remove all checked items from the shopping list."""
        shopping_list = self.get_object()
        deleted_count, _ = ShoppingListItem.objects.filter(
            shopping_list=shopping_list,
            is_checked=True
        ).delete()
        return Response({'deleted_count': deleted_count})

    @action(detail=True, methods=['post'])
    def uncheck_all(self, request, pk=None):
        """Uncheck all items in the shopping list."""
        shopping_list = self.get_object()
        updated_count = ShoppingListItem.objects.filter(
            shopping_list=shopping_list
        ).update(is_checked=False)
        return Response({'updated_count': updated_count})
