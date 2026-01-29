"""
Tests for product_matcher module.

Tests the name normalization and matching logic.
"""

from django.test import TestCase
from products.product_matcher import (
    normalize_product_name,
    generate_match_key,
    similarity_score,
    are_same_product,
    extract_quantity,
    group_products_by_match_key,
)


class NormalizeProductNameTests(TestCase):
    """Tests for normalize_product_name function."""
    
    def test_strips_sainsburys_prefix(self):
        """Test that Sainsbury's prefix is removed."""
        self.assertEqual(
            normalize_product_name("Sainsbury's Iceberg Lettuce"),
            "iceberg lettuce"
        )
    
    def test_strips_tesco_prefix(self):
        """Test that Tesco prefix is removed."""
        self.assertEqual(
            normalize_product_name("Tesco Iceberg Lettuce"),
            "iceberg lettuce"
        )
    
    def test_strips_by_sainsburys_suffix(self):
        """Test that 'by Sainsbury's' suffix is removed."""
        self.assertEqual(
            normalize_product_name("Iceberg Lettuce by Sainsbury's"),
            "iceberg lettuce"
        )
    
    def test_removes_filler_words(self):
        """Test that filler words like 'each' are removed."""
        self.assertEqual(
            normalize_product_name("Iceberg Lettuce Each"),
            "iceberg lettuce"
        )
    
    def test_normalizes_units(self):
        """Test that units are normalized (2 L -> 2l)."""
        result = normalize_product_name("Semi Skimmed Milk 2 Litre")
        self.assertIn("2l", result)
    
    def test_lowercase(self):
        """Test that result is lowercase."""
        result = normalize_product_name("ASDA SEMI SKIMMED MILK")
        self.assertEqual(result, result.lower())
    
    def test_empty_string(self):
        """Test that empty string returns empty."""
        self.assertEqual(normalize_product_name(""), "")
        self.assertEqual(normalize_product_name(None), "")


class GenerateMatchKeyTests(TestCase):
    """Tests for generate_match_key function."""
    
    def test_same_key_different_retailers(self):
        """Test that same product from different retailers gets same key."""
        key1 = generate_match_key("Sainsbury's Iceberg Lettuce")
        key2 = generate_match_key("Tesco Iceberg Lettuce Each")
        self.assertEqual(key1, key2)
    
    def test_different_products_different_keys(self):
        """Test that different products get different keys."""
        key1 = generate_match_key("Lurpak Butter 250g")
        key2 = generate_match_key("Lurpak Spreadable 250g")
        self.assertNotEqual(key1, key2)
    
    def test_key_format(self):
        """Test that key uses underscores."""
        key = generate_match_key("Semi Skimmed Milk")
        self.assertIn("_", key)
        self.assertNotIn(" ", key)


class SimilarityScoreTests(TestCase):
    """Tests for similarity_score function."""
    
    def test_identical_names(self):
        """Test that identical names return 1.0."""
        score = similarity_score("Iceberg Lettuce", "Iceberg Lettuce")
        self.assertEqual(score, 1.0)
    
    def test_same_after_normalization(self):
        """Test high score for same product different retailers."""
        score = similarity_score(
            "Sainsbury's Iceberg Lettuce",
            "Tesco Iceberg Lettuce Each"
        )
        self.assertGreaterEqual(score, 0.85)
    
    def test_different_products_low_score(self):
        """Test low score for different products."""
        score = similarity_score("Lurpak Butter", "Lurpak Spreadable")
        self.assertLess(score, 0.85)


class AreSameProductTests(TestCase):
    """Tests for are_same_product function."""
    
    def test_same_product_different_retailers(self):
        """Test matching same product from different retailers."""
        self.assertTrue(are_same_product(
            "Sainsbury's Iceberg Lettuce",
            "Tesco Iceberg Lettuce Each"
        ))
    
    def test_same_milk_different_retailers(self):
        """Test matching milk from different retailers."""
        self.assertTrue(are_same_product(
            "ASDA Semi Skimmed Milk 2L",
            "Tesco Semi-Skimmed Milk 2 Litre"
        ))
    
    def test_different_variants(self):
        """Test that different variants don't match."""
        self.assertFalse(are_same_product(
            "Lurpak Butter 250g",
            "Lurpak Spreadable 250g"
        ))
    
    def test_custom_threshold(self):
        """Test custom threshold."""
        # With a lower threshold, more products might match
        result = are_same_product("Milk 2L", "Milk 1L", threshold=0.5)
        self.assertTrue(result)  # Very similar structure


class ExtractQuantityTests(TestCase):
    """Tests for extract_quantity function."""
    
    def test_extracts_liters(self):
        """Test extracting liters."""
        qty = extract_quantity("Milk 2L")
        self.assertEqual(qty, "2l")
    
    def test_extracts_grams(self):
        """Test extracting grams."""
        qty = extract_quantity("Butter 250g")
        self.assertEqual(qty, "250g")
    
    def test_extracts_pack_count(self):
        """Test extracting pack count."""
        qty = extract_quantity("Eggs 6 Pack")
        self.assertIn("6", qty)
    
    def test_no_quantity_returns_none(self):
        """Test that no quantity returns None."""
        qty = extract_quantity("Iceberg Lettuce")
        self.assertIsNone(qty)


class GroupProductsTests(TestCase):
    """Tests for group_products_by_match_key function."""
    
    def test_groups_by_key(self):
        """Test grouping products by match key."""
        products = [
            "Sainsbury's Iceberg Lettuce",
            "Tesco Iceberg Lettuce",
            "Milk 2L",
        ]
        
        groups = group_products_by_match_key(products)
        
        # Iceberg lettuce should be grouped together
        lettuce_key = generate_match_key("Iceberg Lettuce")
        self.assertIn(lettuce_key, groups)
        self.assertEqual(len(groups[lettuce_key]), 2)
    
    def test_custom_name_getter(self):
        """Test with custom name getter function."""
        products = [
            {"name": "Milk 2L", "id": 1},
            {"name": "Milk 2 Litre", "id": 2},
        ]
        
        groups = group_products_by_match_key(products, lambda p: p["name"])
        
        # Both should be in same group (2l normalized)
        self.assertEqual(len(groups), 1)
