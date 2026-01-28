"""
Serializers for Open Food Facts products.
"""

from rest_framework import serializers
from .off_models import OFFProduct


class OFFProductListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for OFF product list view.
    Used for search results and swap recommendations.
    """
    nutriscore_display = serializers.SerializerMethodField()
    nova_display = serializers.SerializerMethodField()
    traffic_light = serializers.SerializerMethodField()
    
    class Meta:
        model = OFFProduct
        fields = [
            'id',
            'code',
            'product_name',
            'brands',
            'image_url',
            'nutriscore_grade',
            'nutriscore_display',
            'nova_group',
            'nova_display',
            'traffic_light',
        ]
    
    def get_nutriscore_display(self, obj) -> str:
        """Human-readable nutriscore label."""
        labels = {
            'a': 'A - Excellent',
            'b': 'B - Good',
            'c': 'C - Moderate',
            'd': 'D - Low',
            'e': 'E - Poor',
            'unknown': 'Unknown',
        }
        return labels.get(obj.nutriscore_grade, 'Unknown')
    
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
        # (green_max, amber_max) - above amber_max is red
        return {
            'sugars': get_level(obj.sugars_100g, (5.0, 22.5)),
            'salt': get_level(obj.salt_100g, (0.3, 1.5)),
            'fat': get_level(obj.fat_100g, (3.0, 17.5)),
            'saturated_fat': get_level(obj.saturated_fat_100g, (1.5, 5.0)),
        }


class OFFProductDetailSerializer(serializers.ModelSerializer):
    """
    Full detail serializer for OFF product.
    Includes all nutritional data and metadata.
    """
    nutriscore_display = serializers.SerializerMethodField()
    nova_display = serializers.SerializerMethodField()
    traffic_light = serializers.SerializerMethodField()
    categories_list = serializers.SerializerMethodField()
    
    class Meta:
        model = OFFProduct
        fields = [
            'id',
            'code',
            'product_name',
            'brands',
            'image_url',
            'nutriscore_grade',
            'nutriscore_display',
            'nova_group',
            'nova_display',
            'sugars_100g',
            'salt_100g',
            'fat_100g',
            'saturated_fat_100g',
            'traffic_light',
            'completeness',
            'countries',
            'categories',
            'categories_list',
            'created_at',
            'updated_at',
            'last_fetched_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_fetched_at']
    
    def get_nutriscore_display(self, obj) -> str:
        """Human-readable nutriscore label."""
        labels = {
            'a': 'A - Excellent',
            'b': 'B - Good',
            'c': 'C - Moderate',
            'd': 'D - Low',
            'e': 'E - Poor',
            'unknown': 'Unknown',
        }
        return labels.get(obj.nutriscore_grade, 'Unknown')
    
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
        """Traffic light summary with FSA thresholds."""
        def get_level(value, thresholds):
            if value is None:
                return {'value': None, 'level': 'unknown'}
            
            value_float = float(value)
            if value_float <= thresholds[0]:
                return {'value': str(value), 'level': 'green'}
            elif value_float <= thresholds[1]:
                return {'value': str(value), 'level': 'amber'}
            else:
                return {'value': str(value), 'level': 'red'}
        
        return {
            'sugars': get_level(obj.sugars_100g, (5.0, 22.5)),
            'salt': get_level(obj.salt_100g, (0.3, 1.5)),
            'fat': get_level(obj.fat_100g, (3.0, 17.5)),
            'saturated_fat': get_level(obj.saturated_fat_100g, (1.5, 5.0)),
        }
    
    def get_categories_list(self, obj) -> list:
        """Parse categories into a list."""
        if not obj.categories:
            return []
        return [cat.strip() for cat in obj.categories.split(',') if cat.strip()]


class HealthySwapSerializer(serializers.Serializer):
    """
    Serializer for healthy swap recommendations.
    Includes original product and healthier alternatives.
    """
    original = OFFProductListSerializer()
    alternatives = OFFProductListSerializer(many=True)
    improvement_summary = serializers.SerializerMethodField()
    
    def get_improvement_summary(self, obj) -> dict:
        """
        Summary of health improvements in alternatives.
        """
        original = obj.get('original')
        alternatives = obj.get('alternatives', [])
        
        if not alternatives:
            return {'message': 'No healthier alternatives found'}
        
        best = alternatives[0] if alternatives else None
        
        return {
            'message': f"Found {len(alternatives)} healthier alternatives",
            'best_alternative': {
                'name': best.product_name if best else None,
                'nutriscore': best.nutriscore_grade.upper() if best else None,
                'nova': best.nova_group if best else None,
            } if best else None,
            'nutriscore_improvement': self._calc_nutri_improvement(original, best) if best else None,
            'nova_improvement': self._calc_nova_improvement(original, best) if best else None,
        }
    
    def _calc_nutri_improvement(self, original, alternative) -> str:
        """Calculate nutriscore improvement."""
        if not original or not alternative:
            return None
        
        grades = ['a', 'b', 'c', 'd', 'e']
        try:
            orig_idx = grades.index(original.nutriscore_grade)
            alt_idx = grades.index(alternative.nutriscore_grade)
            improvement = orig_idx - alt_idx
            if improvement > 0:
                return f"+{improvement} grade{'s' if improvement > 1 else ''}"
            return "Same grade"
        except ValueError:
            return None
    
    def _calc_nova_improvement(self, original, alternative) -> str:
        """Calculate NOVA group improvement."""
        if not original or not alternative:
            return None
        
        if original.nova_group is None or alternative.nova_group is None:
            return None
        
        improvement = original.nova_group - alternative.nova_group
        if improvement > 0:
            return f"-{improvement} processing level{'s' if improvement > 1 else ''}"
        return "Same level"
