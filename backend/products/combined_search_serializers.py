from rest_framework import serializers
from .display_utils import (
    get_nutriscore_display,
    get_nova_display,
    get_traffic_light_summary,
)

class RetailerPriceSerializer(serializers.Serializer):
    grocer_id = serializers.CharField()
    grocer_name = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    unit_measure = serializers.CharField(allow_null=True)
    is_on_sale = serializers.BooleanField()
    original_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    promotion_description = serializers.CharField(allow_null=True)
    product_url = serializers.URLField(allow_null=True)
    product_id = serializers.CharField()

class NutritionDataSerializer(serializers.Serializer):
    nutriscore_grade = serializers.CharField(allow_null=True)
    nutriscore_display = serializers.SerializerMethodField()
    nova_group = serializers.IntegerField(allow_null=True)
    nova_display = serializers.SerializerMethodField()
    sugars_100g = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    salt_100g = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    fat_100g = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    saturated_fat_100g = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    traffic_light = serializers.SerializerMethodField()
    
    def get_nutriscore_display(self, obj) -> str:
        return get_nutriscore_display(obj.nutriscore_grade)
    
    def get_nova_display(self, obj) -> str:
        return get_nova_display(obj.nova_group)
    
    def get_traffic_light(self, obj) -> dict:
        return get_traffic_light_summary(
            sugars_100g=obj.sugars_100g,
            salt_100g=obj.salt_100g,
            fat_100g=obj.fat_100g,
            saturated_fat_100g=obj.saturated_fat_100g,
        )

class CombinedProductSerializer(serializers.Serializer):
    barcode = serializers.CharField()
    
    name = serializers.CharField()
    brand = serializers.CharField(allow_null=True)
    description = serializers.CharField()
    categories = serializers.ListField(child=serializers.CharField())
    image_url = serializers.URLField(allow_null=True)
    
    match_key = serializers.CharField(allow_blank=True)
    
    prices = RetailerPriceSerializer(many=True)
    
    relevance_score = serializers.FloatField()
    retailer_count = serializers.IntegerField()
    
    nutrition = NutritionDataSerializer(allow_null=True)
    has_off_match = serializers.BooleanField()
    
    cheapest_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    cheapest_retailer = serializers.CharField(allow_null=True)
    
    price_comparison = serializers.SerializerMethodField()
    has_nutrition_data = serializers.SerializerMethodField()
    
    def get_price_comparison(self, obj) -> dict:
        if len(obj.prices) < 2:
            return None
        
        prices_sorted = sorted(obj.prices, key=lambda p: p.price)
        cheapest = prices_sorted[0]
        most_expensive = prices_sorted[-1]
        
        savings = most_expensive.price - cheapest.price
        savings_percent = (savings / most_expensive.price * 100) if most_expensive.price else 0
        
        return {
            'cheapest': {
                'grocer_id': cheapest.grocer_id,
                'grocer_name': cheapest.grocer_name,
                'price': str(cheapest.price),
            },
            'most_expensive': {
                'grocer_id': most_expensive.grocer_id,
                'grocer_name': most_expensive.grocer_name,
                'price': str(most_expensive.price),
            },
            'potential_savings': str(savings),
            'savings_percent': round(savings_percent, 1),
        }
    
    def get_has_nutrition_data(self, obj) -> bool:
        return obj.nutrition is not None

class CombinedSearchResultSerializer(serializers.Serializer):
    products = CombinedProductSerializer(many=True)
    query = serializers.CharField()
    total_products = serializers.IntegerField()
    retailer_counts = serializers.DictField(child=serializers.IntegerField())
    nutrition_match_count = serializers.IntegerField()
    
    summary = serializers.SerializerMethodField()
    
    def get_summary(self, obj) -> dict:
        products_with_multiple_retailers = sum(
            1 for p in obj.products if p.retailer_count > 1
        )
        products_with_savings = sum(
            1 for p in obj.products 
            if p.retailer_count > 1 and len(p.prices) > 1
        )
        
        return {
            'total_unique_products': obj.total_products,
            'products_at_multiple_retailers': products_with_multiple_retailers,
            'products_with_price_comparison': products_with_savings,
            'products_with_nutrition_data': obj.nutrition_match_count,
            'retailers_searched': len(obj.retailer_counts),
        }
