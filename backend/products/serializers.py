from rest_framework import serializers
from .models import Product, Retailer, ProductPrice


class RetailerSerializer(serializers.ModelSerializer):
    """Serializer for Retailer model."""
    
    class Meta:
        model = Retailer
        fields = ['id', 'name', 'logo_url', 'website_url', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductPriceSerializer(serializers.ModelSerializer):
    """Serializer for ProductPrice model."""
    retailer = RetailerSerializer(read_only=True)
    retailer_id = serializers.PrimaryKeyRelatedField(
        queryset=Retailer.objects.all(),
        source='retailer',
        write_only=True
    )
    effective_price = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        read_only=True
    )

    class Meta:
        model = ProductPrice
        fields = [
            'id', 'retailer', 'retailer_id', 'price', 'currency',
            'is_on_sale', 'sale_price', 'effective_price', 
            'in_stock', 'last_updated'
        ]
        read_only_fields = ['id', 'last_updated', 'effective_price']


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer for Product list view (lightweight)."""
    nova_score_display = serializers.CharField(
        source='get_nova_score_display', 
        read_only=True
    )
    nutri_score_display = serializers.CharField(
        source='get_nutri_score_display', 
        read_only=True
    )
    lowest_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'image_url', 'category',
            'nova_score', 'nova_score_display',
            'nutri_score', 'nutri_score_display',
            'lowest_price'
        ]

    def get_lowest_price(self, obj):
        """Get the lowest available price across all retailers."""
        prices = obj.prices.filter(in_stock=True)
        if prices.exists():
            lowest = min(prices, key=lambda p: p.effective_price)
            return {
                'price': str(lowest.effective_price),
                'currency': lowest.currency,
                'retailer': lowest.retailer.name
            }
        return None


class ProductDetailSerializer(serializers.ModelSerializer):
    """Serializer for Product detail view (full info with all prices)."""
    nova_score_display = serializers.CharField(
        source='get_nova_score_display', 
        read_only=True
    )
    nutri_score_display = serializers.CharField(
        source='get_nutri_score_display', 
        read_only=True
    )
    prices = ProductPriceSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'image_url', 'category',
            'nova_score', 'nova_score_display',
            'nutri_score', 'nutri_score_display',
            'barcode', 'unit', 'prices',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating Products."""
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'image_url', 'category',
            'nova_score', 'nutri_score', 'barcode', 'unit'
        ]
        read_only_fields = ['id']
