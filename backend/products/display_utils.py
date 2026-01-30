"""
Shared display utilities for nutrition and health data.

This module contains reusable functions for formatting nutritional
data for display, including NutriScore, NOVA groups, and traffic lights.
These are used across multiple serializers to ensure consistent formatting.
"""

from decimal import Decimal
from typing import Optional, Union


# ==============================================================================
# NutriScore Display Helpers
# ==============================================================================

NUTRISCORE_LABELS = {
    'a': 'A - Excellent',
    'b': 'B - Good',
    'c': 'C - Moderate',
    'd': 'D - Low',
    'e': 'E - Poor',
    'unknown': 'Unknown',
}


def get_nutriscore_display(grade: Optional[str]) -> str:
    """
    Get human-readable NutriScore label.
    
    Args:
        grade: NutriScore grade (a-e) or 'unknown'/None
        
    Returns:
        Human-readable label like 'A - Excellent'
    """
    if not grade:
        return 'Unknown'
    return NUTRISCORE_LABELS.get(grade.lower(), 'Unknown')


# ==============================================================================
# NOVA Group Display Helpers
# ==============================================================================

NOVA_LABELS = {
    1: '1 - Unprocessed',
    2: '2 - Processed Ingredients',
    3: '3 - Processed',
    4: '4 - Ultra-Processed',
}


def get_nova_display(nova_group: Optional[int]) -> str:
    """
    Get human-readable NOVA group label.
    
    Args:
        nova_group: NOVA group (1-4) or None
        
    Returns:
        Human-readable label like '1 - Unprocessed'
    """
    if nova_group is None:
        return 'Unknown'
    return NOVA_LABELS.get(nova_group, 'Unknown')


# ==============================================================================
# Traffic Light Display Helpers
# ==============================================================================

# UK FSA traffic light thresholds per 100g
# Format: (green_max, amber_max) - above amber_max is red
TRAFFIC_LIGHT_THRESHOLDS = {
    'sugars': (5.0, 22.5),
    'salt': (0.3, 1.5),
    'fat': (3.0, 17.5),
    'saturated_fat': (1.5, 5.0),
}


def get_traffic_light_level(
    value: Optional[Union[Decimal, float, str]],
    thresholds: tuple[float, float]
) -> dict:
    """
    Determine traffic light level (green/amber/red) for a nutrient value.
    
    Args:
        value: The nutrient value per 100g
        thresholds: Tuple of (green_max, amber_max)
        
    Returns:
        Dict with 'value' and 'level' keys
    """
    if value is None:
        return {'value': None, 'level': 'unknown'}
    
    try:
        value_float = float(value)
    except (ValueError, TypeError):
        return {'value': None, 'level': 'unknown'}
    
    green_max, amber_max = thresholds
    
    if value_float <= green_max:
        level = 'green'
    elif value_float <= amber_max:
        level = 'amber'
    else:
        level = 'red'
    
    return {'value': str(value), 'level': level}


def get_traffic_light_summary(
    sugars_100g: Optional[Decimal] = None,
    salt_100g: Optional[Decimal] = None,
    fat_100g: Optional[Decimal] = None,
    saturated_fat_100g: Optional[Decimal] = None,
) -> dict:
    """
    Generate a complete traffic light summary for a product.
    
    Returns color-coded indicators for sugar, salt, fat, saturated fat
    based on UK FSA thresholds per 100g.
    
    Args:
        sugars_100g: Sugar content per 100g
        salt_100g: Salt content per 100g
        fat_100g: Fat content per 100g
        saturated_fat_100g: Saturated fat content per 100g
        
    Returns:
        Dict with traffic light levels for each nutrient
    """
    return {
        'sugars': get_traffic_light_level(
            sugars_100g, 
            TRAFFIC_LIGHT_THRESHOLDS['sugars']
        ),
        'salt': get_traffic_light_level(
            salt_100g, 
            TRAFFIC_LIGHT_THRESHOLDS['salt']
        ),
        'fat': get_traffic_light_level(
            fat_100g, 
            TRAFFIC_LIGHT_THRESHOLDS['fat']
        ),
        'saturated_fat': get_traffic_light_level(
            saturated_fat_100g, 
            TRAFFIC_LIGHT_THRESHOLDS['saturated_fat']
        ),
    }
