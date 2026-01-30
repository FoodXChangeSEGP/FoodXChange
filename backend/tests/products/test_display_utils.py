"""
Tests for display_utils module.

Tests the shared display formatting utilities used across serializers.
"""

from decimal import Decimal
from django.test import TestCase

from products.display_utils import (
    get_nutriscore_display,
    get_nova_display,
    get_traffic_light_level,
    get_traffic_light_summary,
    NUTRISCORE_LABELS,
    NOVA_LABELS,
)
from products.grocer_services.base import (
    parse_price_measure,
    PriceMeasure,
)


class NutriscoreDisplayTests(TestCase):
    """Tests for get_nutriscore_display function."""
    
    def test_all_valid_grades(self):
        """Test all valid nutriscore grades return correct labels."""
        expected = {
            'a': 'A - Excellent',
            'b': 'B - Good',
            'c': 'C - Moderate',
            'd': 'D - Low',
            'e': 'E - Poor',
            'A': 'A - Excellent',  # Case insensitivity
            'B': 'B - Good',
        }
        for grade, label in expected.items():
            self.assertEqual(get_nutriscore_display(grade), label)
    
    def test_unknown_and_none(self):
        """Test unknown values and None return 'Unknown'."""
        self.assertEqual(get_nutriscore_display('unknown'), 'Unknown')
        self.assertEqual(get_nutriscore_display(None), 'Unknown')


class NovaDisplayTests(TestCase):
    """Tests for get_nova_display function."""
    
    def test_all_valid_nova_scores(self):
        """Test all valid NOVA scores return correct labels."""
        expected = {
            1: '1 - Unprocessed',
            2: '2 - Processed Ingredients',
            3: '3 - Processed',
            4: '4 - Ultra-Processed',
        }
        for score, label in expected.items():
            self.assertEqual(get_nova_display(score), label)
    
    def test_invalid_and_none(self):
        """Test invalid values and None return 'Unknown'."""
        self.assertEqual(get_nova_display(None), 'Unknown')
        self.assertEqual(get_nova_display(5), 'Unknown')
        self.assertEqual(get_nova_display(0), 'Unknown')


class TrafficLightLevelTests(TestCase):
    """Tests for get_traffic_light_level function."""
    
    def test_levels_and_boundaries(self):
        """Test green/amber/red levels including boundary values."""
        thresholds = (5.0, 22.5)
        
        # Green: value <= 5.0
        result = get_traffic_light_level(Decimal('3.0'), thresholds)
        self.assertEqual(result['level'], 'green')
        self.assertEqual(result['value'], '3.0')
        
        # Boundary: 5.0 is green
        result = get_traffic_light_level(Decimal('5.0'), thresholds)
        self.assertEqual(result['level'], 'green')
        
        # Amber: 5.0 < value <= 22.5
        result = get_traffic_light_level(Decimal('10.0'), thresholds)
        self.assertEqual(result['level'], 'amber')
        
        # Boundary: 22.5 is amber
        result = get_traffic_light_level(Decimal('22.5'), thresholds)
        self.assertEqual(result['level'], 'amber')
        
        # Red: value > 22.5
        result = get_traffic_light_level(Decimal('30.0'), thresholds)
        self.assertEqual(result['level'], 'red')
    
    def test_none_value(self):
        result = get_traffic_light_level(None, (5.0, 22.5))
        self.assertEqual(result['level'], 'unknown')
        self.assertIsNone(result['value'])


class TrafficLightSummaryTests(TestCase):
    """Tests for get_traffic_light_summary function."""
    
    def test_all_green(self):
        result = get_traffic_light_summary(
            sugars_100g=Decimal('3.0'),
            salt_100g=Decimal('0.2'),
            fat_100g=Decimal('2.0'),
            saturated_fat_100g=Decimal('1.0'),
        )
        for nutrient in ['sugars', 'salt', 'fat', 'saturated_fat']:
            self.assertEqual(result[nutrient]['level'], 'green')
    
    def test_all_red(self):
        result = get_traffic_light_summary(
            sugars_100g=Decimal('30.0'),
            salt_100g=Decimal('2.0'),
            fat_100g=Decimal('20.0'),
            saturated_fat_100g=Decimal('6.0'),
        )
        for nutrient in ['sugars', 'salt', 'fat', 'saturated_fat']:
            self.assertEqual(result[nutrient]['level'], 'red')
    
    def test_mixed_levels(self):
        result = get_traffic_light_summary(
            sugars_100g=Decimal('3.0'),   # green
            salt_100g=Decimal('1.0'),     # amber
            fat_100g=Decimal('20.0'),     # red
            saturated_fat_100g=None,      # unknown
        )
        self.assertEqual(result['sugars']['level'], 'green')
        self.assertEqual(result['salt']['level'], 'amber')
        self.assertEqual(result['fat']['level'], 'red')
        self.assertEqual(result['saturated_fat']['level'], 'unknown')


class PriceMeasureParsingTests(TestCase):
    """Tests for parse_price_measure function."""
    
    def test_all_measure_types(self):
        """Test all price measure mappings."""
        expected = {
            'unit': PriceMeasure.UNIT,
            'each': PriceMeasure.UNIT,
            'kg': PriceMeasure.KG,
            'KG': PriceMeasure.KG,  # Case insensitivity
            'ltr': PriceMeasure.LITRE,
            'litre': PriceMeasure.LITRE,
            'Litre': PriceMeasure.LITRE,
            'l': PriceMeasure.LITRE,
            '100ml': PriceMeasure.ML_100,
            'ml': PriceMeasure.ML_100,
            '100g': PriceMeasure.G_100,
            'g': PriceMeasure.G_100,
        }
        for measure, expected_type in expected.items():
            self.assertEqual(parse_price_measure(measure), expected_type)
    
    def test_defaults_to_unit(self):
        """Test unknown values and None default to UNIT."""
        self.assertEqual(parse_price_measure(None), PriceMeasure.UNIT)
        self.assertEqual(parse_price_measure('unknown'), PriceMeasure.UNIT)
        self.assertEqual(parse_price_measure('xyz'), PriceMeasure.UNIT)
