"""
Business logic for shopping list price comparison.
Contains the critical "Cheapest Retailer" calculation logic.
"""

from decimal import Decimal
from typing import Dict, List, Any
from products.models import Retailer, ProductPrice
from .models import ShoppingList, ShoppingListItem


class ShoppingListComparisonService:
    """
    Service class for comparing shopping list prices across retailers.
    """

    def __init__(self, shopping_list: ShoppingList):
        self.shopping_list = shopping_list
        self._list_items = None
        self._product_quantities = None
        self._all_prices = None
        self._retailers = None

    @property
    def list_items(self) -> List[ShoppingListItem]:
        """Lazy load list items with products."""
        if self._list_items is None:
            self._list_items = list(
                ShoppingListItem.objects.filter(
                    shopping_list=self.shopping_list
                ).select_related('product')
            )
        return self._list_items

    @property
    def product_quantities(self) -> Dict[int, dict]:
        """Build a dict mapping product_id to {product, quantity}."""
        if self._product_quantities is None:
            self._product_quantities = {
                item.product_id: {
                    'product': item.product,
                    'quantity': item.quantity,
                    'is_checked': item.is_checked,
                    'notes': item.notes,
                }
                for item in self.list_items
            }
        return self._product_quantities

    @property
    def product_ids(self) -> List[int]:
        """Get list of all product IDs in the shopping list."""
        return list(self.product_quantities.keys())

    @property
    def all_prices(self) -> Dict[int, Dict[int, ProductPrice]]:
        """
        Fetch all prices for products in the list across all retailers.
        Returns: {retailer_id: {product_id: ProductPrice}}
        """
        if self._all_prices is None:
            prices = ProductPrice.objects.filter(
                product_id__in=self.product_ids,
                in_stock=True  # Only consider in-stock items
            ).select_related('retailer', 'product')

            self._all_prices = {}
            for price in prices:
                if price.retailer_id not in self._all_prices:
                    self._all_prices[price.retailer_id] = {}
                self._all_prices[price.retailer_id][price.product_id] = price

        return self._all_prices

    @property
    def retailers(self) -> List[Retailer]:
        """Get all retailers."""
        if self._retailers is None:
            self._retailers = list(Retailer.objects.all())
        return self._retailers

    def compare_prices(self) -> List[Dict[str, Any]]:
        """
        Calculate total cost of the shopping list for each retailer.
        
        Returns a list of retailer comparisons sorted by:
        1. Completeness (retailers with all items first)
        2. Total cost (cheapest first)
        
        Each comparison includes:
        - retailer info
        - total cost
        - list of stocked items with prices
        - list of not_stocked items
        - is_complete flag
        """
        if not self.product_ids:
            return []

        comparisons = []

        for retailer in self.retailers:
            retailer_prices = self.all_prices.get(retailer.id, {})
            
            stocked_items = []
            not_stocked_items = []
            total = Decimal('0.00')
            stocked_count = 0

            for product_id, item_data in self.product_quantities.items():
                product = item_data['product']
                quantity = item_data['quantity']

                if product_id in retailer_prices:
                    price_obj = retailer_prices[product_id]
                    effective_price = price_obj.effective_price
                    line_total = effective_price * quantity
                    total += line_total
                    stocked_count += 1

                    stocked_items.append({
                        'product': {
                            'id': product.id,
                            'name': product.name,
                            'image_url': product.image_url,
                            'category': product.category,
                            'nova_score': product.nova_score,
                            'nutri_score': product.nutri_score,
                        },
                        'quantity': quantity,
                        'unit_price': str(effective_price),
                        'line_total': str(line_total),
                        'currency': price_obj.currency,
                        'is_on_sale': price_obj.is_on_sale,
                        'is_checked': item_data['is_checked'],
                        'notes': item_data['notes'],
                    })
                else:
                    not_stocked_items.append({
                        'product': {
                            'id': product.id,
                            'name': product.name,
                            'image_url': product.image_url,
                            'category': product.category,
                            'nova_score': product.nova_score,
                            'nutri_score': product.nutri_score,
                        },
                        'quantity': quantity,
                        'reason': 'Not available at this retailer',
                        'is_checked': item_data['is_checked'],
                        'notes': item_data['notes'],
                    })

            is_complete = len(not_stocked_items) == 0 and len(stocked_items) > 0

            comparisons.append({
                'retailer': {
                    'id': retailer.id,
                    'name': retailer.name,
                    'logo_url': retailer.logo_url,
                },
                'total': str(total),
                'currency': 'GBP',
                'items_count': stocked_count,
                'total_items_in_list': len(self.product_quantities),
                'is_complete': is_complete,
                'stocked_items': stocked_items,
                'not_stocked_items': not_stocked_items,
            })

        # Sort by completeness first, then by total cost
        comparisons.sort(key=lambda x: (
            not x['is_complete'],  # Complete lists first (False < True)
            Decimal(x['total'])    # Then by price
        ))

        # Add rank
        for rank, comparison in enumerate(comparisons, start=1):
            comparison['rank'] = rank

        return comparisons

    def get_cheapest_complete(self) -> Dict[str, Any] | None:
        """Get the cheapest retailer that stocks all items."""
        comparisons = self.compare_prices()
        for comparison in comparisons:
            if comparison['is_complete']:
                return comparison
        return None

    def get_cheapest_overall(self) -> Dict[str, Any] | None:
        """Get the cheapest retailer regardless of completeness."""
        comparisons = self.compare_prices()
        if comparisons:
            # Re-sort by total only
            sorted_by_price = sorted(
                comparisons,
                key=lambda x: Decimal(x['total'])
            )
            return sorted_by_price[0]
        return None
