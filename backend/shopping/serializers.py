from rest_framework import serializers
from .models import ShoppingList, ShoppingListItem
from products.models import Product
from products.serializers import ProductListSerializer


class ShoppingListItemSerializer(serializers.ModelSerializer):
    """Serializer for ShoppingListItem model."""
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True
    )

    class Meta:
        model = ShoppingListItem
        fields = [
            'id', 'product', 'product_id', 'quantity',
            'is_checked', 'notes', 'added_at', 'updated_at'
        ]
        read_only_fields = ['id', 'added_at', 'updated_at']


class ShoppingListItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating ShoppingListItem."""
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product'
    )

    class Meta:
        model = ShoppingListItem
        fields = ['id', 'product_id', 'quantity', 'is_checked', 'notes']
        read_only_fields = ['id']


class ShoppingListSerializer(serializers.ModelSerializer):
    """Serializer for ShoppingList model."""
    items = ShoppingListItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    total_quantity = serializers.IntegerField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ShoppingList
        fields = [
            'id', 'name', 'description', 'is_active',
            'items', 'total_items', 'total_quantity',
            'user_username', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'user_username']


class ShoppingListCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ShoppingList."""

    class Meta:
        model = ShoppingList
        fields = ['id', 'name', 'description', 'is_active']
        read_only_fields = ['id']

    def create(self, validated_data):
        # Automatically set the user from the request context
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ShoppingListComparisonSerializer(serializers.Serializer):
    """Serializer for the shopping list comparison response."""
    
    class RetailerComparisonSerializer(serializers.Serializer):
        rank = serializers.IntegerField()
        retailer = serializers.DictField()
        total = serializers.CharField()
        currency = serializers.CharField()
        items_count = serializers.IntegerField()
        total_items_in_list = serializers.IntegerField()
        is_complete = serializers.BooleanField()
        stocked_items = serializers.ListField()
        not_stocked_items = serializers.ListField()

    shopping_list = serializers.SerializerMethodField()
    comparison = RetailerComparisonSerializer(many=True)
    cheapest_complete = serializers.DictField(allow_null=True)
    cheapest_overall = serializers.DictField(allow_null=True)

    def get_shopping_list(self, obj):
        return {
            'id': obj['shopping_list'].id,
            'name': obj['shopping_list'].name,
            'total_items': obj['shopping_list'].total_items,
        }
