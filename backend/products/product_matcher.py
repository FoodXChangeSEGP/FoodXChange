"""
Product name normalization and matching utilities.

Simple, cheap approach to match products across retailers without NLP.
Handles cases like:
- "Sainsbury's Iceberg Lettuce" → "iceberg lettuce"
- "Tesco Iceberg Lettuce Each" → "iceberg lettuce"
"""

import re
from typing import Optional
from difflib import SequenceMatcher


# Retailer prefixes/suffixes to strip
RETAILER_PATTERNS = [
    r"^sainsbury'?s?\s+",
    r"^tesco\s+",
    r"^asda\s+",
    r"^morrisons?\s+",
    r"^waitrose\s+",
    r"^aldi\s+",
    r"^lidl\s+",
    r"^co-?op\s+",
    r"^m&s\s+",
    r"^marks\s*&?\s*spencer'?s?\s+",
    r"\s+by\s+sainsbury'?s?$",
    r"\s+tesco$",
    r"\s+asda$",
]

# Filler words to remove
FILLER_WORDS = {
    'each', 'pack', 'packs', 'bag', 'bags', 'bunch', 'bunches',
    'single', 'fresh', 'british', 'organic', 'free', 'range',
    'class', 'essential', 'basics', 'value', 'finest', 'extra',
    'special', 'selected', 'premium', 'everyday', 'standard',
}

# Unit patterns to normalize
UNIT_PATTERNS = [
    (r'(\d+)\s*g\b', r'\1g'),        # 500 g → 500g
    (r'(\d+)\s*kg\b', r'\1kg'),      # 1 kg → 1kg
    (r'(\d+)\s*ml\b', r'\1ml'),      # 500 ml → 500ml
    (r'(\d+)\s*l\b', r'\1l'),        # 2 l → 2l
    (r'(\d+)\s*litre?s?\b', r'\1l'), # 2 litres → 2l
    (r'(\d+)\s*pint\b', r'\1pint'),  # 2 pint → 2pint
    (r'(\d+)\s*x\s*(\d+)', r'\1x\2'), # 6 x 4 → 6x4
]


def normalize_product_name(name: str) -> str:
    """
    Normalize a product name for matching across retailers.
    
    Steps:
    1. Lowercase
    2. Strip retailer prefixes/suffixes
    3. Normalize units
    4. Remove filler words
    5. Collapse whitespace
    6. Strip punctuation (except numbers/units)
    
    Examples:
        "Sainsbury's Iceberg Lettuce" → "iceberg lettuce"
        "Tesco Iceberg Lettuce Each" → "iceberg lettuce"
        "ASDA Semi Skimmed Milk 2L" → "semi skimmed milk 2l"
    """
    if not name:
        return ""
    
    # Lowercase
    result = name.lower().strip()
    
    # Strip retailer patterns
    for pattern in RETAILER_PATTERNS:
        result = re.sub(pattern, '', result, flags=re.IGNORECASE)
    
    # Normalize units
    for pattern, replacement in UNIT_PATTERNS:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    
    # Remove filler words
    words = result.split()
    words = [w for w in words if w not in FILLER_WORDS]
    result = ' '.join(words)
    
    # Remove punctuation except alphanumeric and spaces
    result = re.sub(r'[^\w\s]', ' ', result)
    
    # Collapse whitespace
    result = re.sub(r'\s+', ' ', result).strip()
    
    return result


def extract_quantity(name: str) -> Optional[str]:
    """
    Extract quantity/size from product name.
    
    Returns normalized quantity string or None.
    
    Examples:
        "Milk 2L" → "2l"
        "Eggs 6 Pack" → "6"
        "Chicken Breast 500g" → "500g"
    """
    if not name:
        return None
    
    # Common quantity patterns
    patterns = [
        r'(\d+(?:\.\d+)?)\s*(?:kg|g|ml|l|litre?s?|pints?)\b',
        r'(\d+)\s*x\s*(\d+)',  # multipacks
        r'\b(\d+)\s*(?:pack|packs)\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, name, re.IGNORECASE)
        if match:
            return match.group(0).lower().replace(' ', '')
    
    return None


def similarity_score(name1: str, name2: str) -> float:
    """
    Calculate similarity between two normalized product names.
    
    Returns a score between 0.0 and 1.0.
    """
    if not name1 or not name2:
        return 0.0
    
    # Normalize both names
    norm1 = normalize_product_name(name1)
    norm2 = normalize_product_name(name2)
    
    if norm1 == norm2:
        return 1.0
    
    # Use SequenceMatcher for fuzzy matching
    return SequenceMatcher(None, norm1, norm2).ratio()


def are_same_product(name1: str, name2: str, threshold: float = 0.85) -> bool:
    """
    Check if two product names likely refer to the same product.
    
    Args:
        name1: First product name
        name2: Second product name
        threshold: Minimum similarity score (default 0.85)
    
    Returns:
        True if products are likely the same
    """
    return similarity_score(name1, name2) >= threshold


def generate_match_key(name: str) -> str:
    """
    Generate a key for grouping similar products.
    
    The key is a heavily normalized version of the product name
    that should be identical for equivalent products.
    
    Examples:
        "Sainsbury's Iceberg Lettuce" → "iceberg_lettuce"
        "Tesco Iceberg Lettuce Each" → "iceberg_lettuce"
    """
    normalized = normalize_product_name(name)
    
    # Extract core product words (remove quantities for grouping)
    # Keep quantity separate for exact matching
    words = normalized.split()
    
    # Filter out pure numbers and very short words
    core_words = [w for w in words if len(w) > 1 and not w.isdigit()]
    
    # Sort for consistency (optional - may lose ordering meaning)
    # Keeping original order is usually better for food products
    
    return '_'.join(core_words) if core_words else normalized.replace(' ', '_')


def group_products_by_match_key(products: list, name_getter=None) -> dict:
    """
    Group products by their normalized match key.
    
    Args:
        products: List of products
        name_getter: Function to get name from product (default: str())
    
    Returns:
        Dict mapping match_key to list of products
    """
    if name_getter is None:
        name_getter = str
    
    groups = {}
    for product in products:
        name = name_getter(product)
        key = generate_match_key(name)
        
        if key not in groups:
            groups[key] = []
        groups[key].append(product)
    
    return groups


# Quick tests
if __name__ == '__main__':
    test_cases = [
        ("Sainsbury's Iceberg Lettuce", "Tesco Iceberg Lettuce Each"),
        ("ASDA Semi Skimmed Milk 2L", "Tesco Semi-Skimmed Milk 2 Litre"),
        ("Sainsbury's British Free Range Eggs x6", "Tesco Free Range Eggs 6 Pack"),
        ("Warburtons Medium White Bread 800g", "Warburtons Medium Sliced White Bread 800g"),
        ("Lurpak Butter 250g", "Lurpak Spreadable 250g"),  # Should NOT match
    ]
    
    print("Product Matching Tests:")
    print("=" * 60)
    
    for name1, name2 in test_cases:
        norm1 = normalize_product_name(name1)
        norm2 = normalize_product_name(name2)
        score = similarity_score(name1, name2)
        match = are_same_product(name1, name2)
        
        print(f"\n{name1}")
        print(f"  → {norm1}")
        print(f"{name2}")
        print(f"  → {norm2}")
        print(f"Similarity: {score:.2f} | Match: {match}")
