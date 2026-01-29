"""
Serializers for combined grocer search results.

These serializers handle the CombinedProduct format that merges
products from multiple retailers with Open Food Facts nutrition data.
"""

from rest_framework import serializers


class RetailerPriceSerializer(serializers.Serializer):
    """Serializer for per-retailer price information."""
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
    """Serializer for Open Food Facts nutrition data."""
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
        """Human-readable nutriscore label."""
        if not obj.nutriscore_grade:
            return 'Unknown'
        labels = {
            'a': 'A - Excellent',
            'b': 'B - Good',
            'c': 'C - Moderate',
            'd': 'D - Low',
            'e': 'E - Poor',
        }
        return labels.get(obj.nutriscore_grade.lower(), 'Unknown')
    
    def get_nova_display(self, obj) -> str:
        """Human-readable NOVA group label."""
        if obj.nova_group is None:
            return 'Unknown'
        labels = {
            1: '1 - Unprocessed',
            2: '2 - Processed Ingredients',
            3: '3 - Processed',
            4: '4 - Ultra-Processed',
        }
        return labels.get(obj.nova_group, 'Unknown')
    
    def get_traffic_light(self, obj) -> dict:
        """
        Traffic light summary for quick health assessment.
        Returns color-coded indicators for sugar, salt, fat, saturated fat.
        """
        def get_level(value, thresholds):
            """
            Determine traffic light level (green/amber/red).
            Thresholds are (green_max, amber_max).
            """
            if value is None:
                return {'value': None, 'level': 'unknown'}
            
            value_float = float(value)
            if value_float <= thresholds[0]:
                return {'value': str(value), 'level': 'green'}
            elif value_float <= thresholds[1]:
                return {'value': str(value), 'level': 'amber'}
            else:
                return {'value': str(value), 'level': 'red'}
        
        # UK FSA traffic light thresholds per 100g
        return {
            'sugars': get_level(obj.sugars_100g, (5.0, 22.5)),
            'salt': get_level(obj.salt_100g, (0.3, 1.5)),
            'fat': get_level(obj.fat_100g, (3.0, 17.5)),
            'saturated_fat': get_level(obj.saturated_fat_100g, (1.5, 5.0)),
        }


class CombinedProductSerializer(serializers.Serializer):
    """
    Serializer for combined product from multiple retailers.
    
    Includes:
    - Unified product info
    - Prices from all retailers
    - Relevance score
    - Open Food Facts nutrition data
    """
    # Identifiers
    barcode = serializers.CharField()
    
    # Basic info
    name = serializers.CharField()
    brand = serializers.CharField(allow_null=True)
    description = serializers.CharField()
    categories = serializers.ListField(child=serializers.CharField())
    image_url = serializers.URLField(allow_null=True)
    
    # Prices from each retailer
    prices = RetailerPriceSerializer(many=True)
    
    # Relevance and availability
    relevance_score = serializers.FloatField()
    retailer_count = serializers.IntegerField()
    
    # Nutrition from Open Food Facts
    nutrition = NutritionDataSerializer(allow_null=True)
    
    # Aggregated price info
    cheapest_price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    cheapest_retailer = serializers.CharField(allow_null=True)
    
    # Computed fields
    price_comparison = serializers.SerializerMethodField()
    has_nutrition_data = serializers.SerializerMethodField()
    
    def get_price_comparison(self, obj) -> dict:
        """
        Generate a price comparison summary.
        Shows savings if available at multiple retailers.
        """
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
        """Check if nutrition data is available."""
        return obj.nutrition is not None


class CombinedSearchResultSerializer(serializers.Serializer):
    """Serializer for combined search results."""
    products = CombinedProductSerializer(many=True)
    query = serializers.CharField()
    total_products = serializers.IntegerField()
    retailer_counts = serializers.DictField(child=serializers.IntegerField())
    nutrition_match_count = serializers.IntegerField()
    
    # Computed summary
    summary = serializers.SerializerMethodField()
    
    def get_summary(self, obj) -> dict:
        """Generate a search summary."""
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
