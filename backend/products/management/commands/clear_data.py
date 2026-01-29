"""
Management command to clear all cached/seeded data from the database.
Useful for starting fresh with live grocer data.
"""

from django.core.management.base import BaseCommand
from products.models import Retailer, Product, ProductPrice
from products.off_models import OFFProduct, SearchQueryCache
from shopping.models import ShoppingList, ShoppingListItem


class Command(BaseCommand):
    help = 'Clears all product, pricing, and cached data from the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--keep-users',
            action='store_true',
            help='Keep user shopping lists and items',
        )
        parser.add_argument(
            '--off-only',
            action='store_true',
            help='Only clear Open Food Facts cache data',
        )

    def handle(self, *args, **options):
        if options['off_only']:
            self.clear_off_data()
            return

        self.stdout.write('Clearing all cached and seeded data...\n')
        
        # Clear Open Food Facts data
        self.clear_off_data()
        
        # Clear product prices
        price_count = ProductPrice.objects.count()
        ProductPrice.objects.all().delete()
        self.stdout.write(f'  Deleted {price_count} product prices')
        
        # Clear products
        product_count = Product.objects.count()
        Product.objects.all().delete()
        self.stdout.write(f'  Deleted {product_count} products')
        
        # Clear retailers
        retailer_count = Retailer.objects.count()
        Retailer.objects.all().delete()
        self.stdout.write(f'  Deleted {retailer_count} retailers')
        
        # Optionally clear shopping lists
        if not options['keep_users']:
            list_item_count = ShoppingListItem.objects.count()
            ShoppingListItem.objects.all().delete()
            self.stdout.write(f'  Deleted {list_item_count} shopping list items')
            
            list_count = ShoppingList.objects.count()
            ShoppingList.objects.all().delete()
            self.stdout.write(f'  Deleted {list_count} shopping lists')
        else:
            self.stdout.write('  Kept user shopping lists (--keep-users)')
        
        self.stdout.write(self.style.SUCCESS('\nDatabase cleared successfully!'))

    def clear_off_data(self):
        """Clear Open Food Facts cached data."""
        off_count = OFFProduct.objects.count()
        OFFProduct.objects.all().delete()
        self.stdout.write(f'  Deleted {off_count} OFF cached products')
        
        cache_count = SearchQueryCache.objects.count()
        SearchQueryCache.objects.all().delete()
        self.stdout.write(f'  Deleted {cache_count} search query caches')
