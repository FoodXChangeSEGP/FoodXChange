"""
Serializers for grocer product data.

These serializers handle the standardized GrocerProduct format
returned by all grocer services.
"""

from rest_framework import serializers


class GrocerPriceSerializer(serializers.Serializer):
    """Serializer for price information."""
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()
    measure = serializers.CharField()
    original_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True
    )
    is_on_sale = serializers.BooleanField()


class GrocerPromotionSerializer(serializers.Serializer):
    """Serializer for promotion information."""
    description = serializers.CharField()
    original_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True
    )
    promo_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, allow_null=True
    )
    start_date = serializers.CharField(allow_null=True)
    end_date = serializers.CharField(allow_null=True)


class GrocerProductSerializer(serializers.Serializer):
    """
    Serializer for grocer product data.
    
    This is a read-only serializer that converts GrocerProduct
    dataclass instances to JSON.
    """
    # Identifiers
    grocer_id = serializers.CharField()
    product_id = serializers.CharField()
    
    # Basic info
    name = serializers.CharField()
    description = serializers.CharField()
    brand = serializers.CharField(allow_null=True)
    
    # Barcodes
    barcodes = serializers.ListField(
        child=serializers.CharField()
    )
    
    # Pricing
    retail_price = serializers.SerializerMethodField()
    unit_price = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()
    
    # Availability
    is_available = serializers.BooleanField()
    
    # Categories
    categories = serializers.ListField(
        child=serializers.CharField()
    )
    
    # Images
    image_url = serializers.URLField(allow_null=True)
    thumbnail_url = serializers.URLField(allow_null=True)
    
    # Promotions
    promotions = serializers.SerializerMethodField()
    
    # Product URL
    product_url = serializers.URLField(allow_null=True)
    
    # Reviews
    rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField(allow_null=True)
    
    def get_retail_price(self, obj):
        """Serialize retail price."""
        if obj.retail_price:
            return {
                'price': str(obj.retail_price.price),
                'currency': obj.retail_price.currency,
                'measure': obj.retail_price.measure.value,
                'original_price': str(obj.retail_price.original_price) if obj.retail_price.original_price else None,
                'is_on_sale': obj.retail_price.is_on_sale,
            }
        return None
    
    def get_unit_price(self, obj):
        """Serialize unit price."""
        if obj.unit_price:
            return {
                'price': str(obj.unit_price.price),
                'currency': obj.unit_price.currency,
                'measure': obj.unit_price.measure.value,
                'original_price': str(obj.unit_price.original_price) if obj.unit_price.original_price else None,
                'is_on_sale': obj.unit_price.is_on_sale,
            }
        return None
    
    def get_effective_price(self, obj):
        """Get the actual price to pay."""
        price = obj.get_effective_price()
        return str(price) if price else None
    
    def get_promotions(self, obj):
        """Serialize promotions list."""
        return [
            {
                'description': p.description,
                'original_price': str(p.original_price) if p.original_price else None,
                'promo_price': str(p.promo_price) if p.promo_price else None,
                'start_date': p.start_date,
                'end_date': p.end_date,
            }
            for p in obj.promotions
        ]


class GrocerSearchResultSerializer(serializers.Serializer):
    """Serializer for search results."""
    products = GrocerProductSerializer(many=True)
    total_count = serializers.IntegerField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    has_more = serializers.BooleanField()
    total_pages = serializers.IntegerField()


class GrocerListSerializer(serializers.Serializer):
    """Serializer for available grocers list."""
    id = serializers.CharField()
    name = serializers.CharField()
