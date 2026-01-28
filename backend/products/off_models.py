"""
Open Food Facts Product Model and Related Components.

This module contains the OFFProduct model for storing products
fetched from the Open Food Facts API, optimized for the UK market
and "Healthy Swap" functionality.
"""

from django.db import models
from django.utils import timezone
from datetime import timedelta


class OFFProduct(models.Model):
    """
    Represents a product fetched from the Open Food Facts API.
    
    Stores nutritional information including Nutri-Score, NOVA group,
    and Traffic Light values (sugar, salt, fat, saturated fat per 100g).
    Uses barcode (EAN) as unique constraint for upsert operations.
    """
    
    class NutriScoreGrade(models.TextChoices):
        A = 'a', 'A - Excellent'
        B = 'b', 'B - Good'
        C = 'c', 'C - Moderate'
        D = 'd', 'D - Low'
        E = 'e', 'E - Poor'
        UNKNOWN = 'unknown', 'Unknown'

    class NovaGroup(models.IntegerChoices):
        UNPROCESSED = 1, "Unprocessed/Minimally Processed"
        PROCESSED_INGREDIENTS = 2, "Processed Culinary Ingredients"
        PROCESSED = 3, "Processed Foods"
        ULTRA_PROCESSED = 4, "Ultra-Processed Foods"

    # Primary identifier (EAN/barcode from OFF)
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="EAN/Barcode from Open Food Facts"
    )
    
    # Basic product info
    product_name = models.CharField(max_length=500, db_index=True)
    brands = models.CharField(max_length=255, blank=True, default='')
    image_url = models.URLField(max_length=500, blank=True, default='')
    
    # Nutritional scores
    nutriscore_grade = models.CharField(
        max_length=10,
        choices=NutriScoreGrade.choices,
        default=NutriScoreGrade.UNKNOWN,
        db_index=True,
        help_text="Nutri-Score nutritional rating (a-e)"
    )
    nova_group = models.IntegerField(
        choices=NovaGroup.choices,
        null=True,
        blank=True,
        db_index=True,
        help_text="NOVA food processing classification (1-4)"
    )
    
    # Traffic Light values (per 100g)
    sugars_100g = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Sugar content per 100g"
    )
    salt_100g = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Salt content per 100g"
    )
    fat_100g = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Fat content per 100g"
    )
    saturated_fat_100g = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Saturated fat content per 100g"
    )
    
    # OFF metadata
    completeness = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0,
        help_text="Open Food Facts completeness score (0-1)"
    )
    countries = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Countries where product is sold"
    )
    categories = models.TextField(
        blank=True,
        default='',
        help_text="Product categories from OFF"
    )
    
    # Query tracking for cache invalidation
    search_query = models.CharField(
        max_length=255,
        db_index=True,
        blank=True,
        default='',
        help_text="Search query that fetched this product"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_fetched_at = models.DateTimeField(
        default=timezone.now,
        help_text="When this product was last fetched from OFF API"
    )

    class Meta:
        ordering = ['nutriscore_grade', 'nova_group', 'product_name']
        indexes = [
            models.Index(fields=['nutriscore_grade', 'nova_group']),
            models.Index(fields=['search_query', 'updated_at']),
            models.Index(fields=['brands', 'product_name']),
        ]
        verbose_name = "OFF Product"
        verbose_name_plural = "OFF Products"

    def __str__(self):
        return f"{self.product_name} ({self.brands}) - Nutri: {self.nutriscore_grade.upper()}, Nova: {self.nova_group}"

    @property
    def is_stale(self):
        """Check if product data is older than 24 hours."""
        return timezone.now() - self.last_fetched_at > timedelta(hours=24)

    @property
    def nutriscore_rank(self):
        """Convert nutriscore grade to numeric rank for sorting (a=1, e=5)."""
        grade_map = {'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'unknown': 6}
        return grade_map.get(self.nutriscore_grade, 6)

    @property
    def nova_rank(self):
        """Get NOVA group for sorting (1 is best, 4 is worst)."""
        return self.nova_group if self.nova_group else 5


class SearchQueryCache(models.Model):
    """
    Tracks search queries to enable lazy loading and cache invalidation.
    """
    query = models.CharField(max_length=255, unique=True, db_index=True)
    last_searched_at = models.DateTimeField(auto_now=True)
    result_count = models.IntegerField(default=0)
    is_complete = models.BooleanField(
        default=False,
        help_text="Whether the full CSV was processed"
    )

    class Meta:
        verbose_name = "Search Query Cache"
        verbose_name_plural = "Search Query Caches"

    def __str__(self):
        return f"'{self.query}' - {self.result_count} results"

    @property
    def is_stale(self):
        """Check if cache is older than 24 hours."""
        return timezone.now() - self.last_searched_at > timedelta(hours=24)
