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
    
    def test_grade_a(self):
        self.assertEqual(get_nutriscore_display('a'), 'A - Excellent')
    
    def test_grade_b(self):
        self.assertEqual(get_nutriscore_display('b'), 'B - Good')
    
    def test_grade_c(self):
        self.assertEqual(get_nutriscore_display('c'), 'C - Moderate')
    
    def test_grade_d(self):
        self.assertEqual(get_nutriscore_display('d'), 'D - Low')
    
    def test_grade_e(self):
        self.assertEqual(get_nutriscore_display('e'), 'E - Poor')
    
    def test_unknown(self):
        self.assertEqual(get_nutriscore_display('unknown'), 'Unknown')
    
    def test_none(self):
        self.assertEqual(get_nutriscore_display(None), 'Unknown')
    
    def test_case_insensitive(self):
        self.assertEqual(get_nutriscore_display('A'), 'A - Excellent')
        self.assertEqual(get_nutriscore_display('B'), 'B - Good')


class NovaDisplayTests(TestCase):
    """Tests for get_nova_display function."""
    
    def test_nova_1(self):
        self.assertEqual(get_nova_display(1), '1 - Unprocessed')
    
    def test_nova_2(self):
        self.assertEqual(get_nova_display(2), '2 - Processed Ingredients')
    
    def test_nova_3(self):
        self.assertEqual(get_nova_display(3), '3 - Processed')
    
    def test_nova_4(self):
        self.assertEqual(get_nova_display(4), '4 - Ultra-Processed')
    
    def test_none(self):
        self.assertEqual(get_nova_display(None), 'Unknown')
    
    def test_invalid(self):
        self.assertEqual(get_nova_display(5), 'Unknown')
        self.assertEqual(get_nova_display(0), 'Unknown')


class TrafficLightLevelTests(TestCase):
    """Tests for get_traffic_light_level function."""
    
    def test_green_level(self):
        result = get_traffic_light_level(Decimal('3.0'), (5.0, 22.5))
        self.assertEqual(result['level'], 'green')
        self.assertEqual(result['value'], '3.0')
    
    def test_amber_level(self):
        result = get_traffic_light_level(Decimal('10.0'), (5.0, 22.5))
        self.assertEqual(result['level'], 'amber')
    
    def test_red_level(self):
        result = get_traffic_light_level(Decimal('30.0'), (5.0, 22.5))
        self.assertEqual(result['level'], 'red')
    
    def test_boundary_green_amber(self):
        result = get_traffic_light_level(Decimal('5.0'), (5.0, 22.5))
        self.assertEqual(result['level'], 'green')  # <= green_max is green
    
    def test_boundary_amber_red(self):
        result = get_traffic_light_level(Decimal('22.5'), (5.0, 22.5))
        self.assertEqual(result['level'], 'amber')  # <= amber_max is amber
    
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
        self.assertEqual(result['sugars']['level'], 'green')
        self.assertEqual(result['salt']['level'], 'green')
        self.assertEqual(result['fat']['level'], 'green')
        self.assertEqual(result['saturated_fat']['level'], 'green')
    
    def test_all_red(self):
        result = get_traffic_light_summary(
            sugars_100g=Decimal('30.0'),
            salt_100g=Decimal('2.0'),
            fat_100g=Decimal('20.0'),
            saturated_fat_100g=Decimal('6.0'),
        )
        self.assertEqual(result['sugars']['level'], 'red')
        self.assertEqual(result['salt']['level'], 'red')
        self.assertEqual(result['fat']['level'], 'red')
        self.assertEqual(result['saturated_fat']['level'], 'red')
    
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
    
    def test_unit_variations(self):
        self.assertEqual(parse_price_measure('unit'), PriceMeasure.UNIT)
        self.assertEqual(parse_price_measure('each'), PriceMeasure.UNIT)
    
    def test_kg(self):
        self.assertEqual(parse_price_measure('kg'), PriceMeasure.KG)
    
    def test_litre_variations(self):
        self.assertEqual(parse_price_measure('ltr'), PriceMeasure.LITRE)
        self.assertEqual(parse_price_measure('litre'), PriceMeasure.LITRE)
        self.assertEqual(parse_price_measure('l'), PriceMeasure.LITRE)
    
    def test_100ml(self):
        self.assertEqual(parse_price_measure('100ml'), PriceMeasure.ML_100)
        self.assertEqual(parse_price_measure('ml'), PriceMeasure.ML_100)
    
    def test_100g(self):
        self.assertEqual(parse_price_measure('100g'), PriceMeasure.G_100)
        self.assertEqual(parse_price_measure('g'), PriceMeasure.G_100)
    
    def test_case_insensitive(self):
        self.assertEqual(parse_price_measure('KG'), PriceMeasure.KG)
        self.assertEqual(parse_price_measure('Litre'), PriceMeasure.LITRE)
    
    def test_none(self):
        self.assertEqual(parse_price_measure(None), PriceMeasure.UNIT)
    
    def test_unknown_defaults_to_unit(self):
        self.assertEqual(parse_price_measure('unknown'), PriceMeasure.UNIT)
        self.assertEqual(parse_price_measure('xyz'), PriceMeasure.UNIT)
