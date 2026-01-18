"""
Management command to seed the database with test data.
Creates retailers, products, and prices for testing the comparison feature.
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from products.models import Retailer, Product, ProductPrice
from shopping.models import ShoppingList, ShoppingListItem


class Command(BaseCommand):
    help = 'Seeds the database with sample retailers, products, and prices'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            ProductPrice.objects.all().delete()
            Product.objects.all().delete()
            Retailer.objects.all().delete()
            ShoppingListItem.objects.all().delete()
            ShoppingList.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing data cleared.'))

        self.stdout.write('Seeding database...')
        
        # Create retailers
        retailers = self.create_retailers()
        
        # Create products
        products = self.create_products()
        
        # Create product prices (with intentional gaps for testing)
        self.create_prices(retailers, products)
        
        # Create a test user and sample shopping list
        self.create_test_user_and_list(products)
        
        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))
        self.print_summary()

    def create_retailers(self):
        """Create 3 dummy retailers."""
        retailers_data = [
            {
                'name': 'BudgetMart',
                'logo_url': 'https://example.com/logos/budgetmart.png',
                'website_url': 'https://budgetmart.example.com',
            },
            {
                'name': 'FreshFoods',
                'logo_url': 'https://example.com/logos/freshfoods.png',
                'website_url': 'https://freshfoods.example.com',
            },
            {
                'name': 'SuperStore',
                'logo_url': 'https://example.com/logos/superstore.png',
                'website_url': 'https://superstore.example.com',
            },
        ]

        retailers = []
        for data in retailers_data:
            retailer, created = Retailer.objects.get_or_create(
                name=data['name'],
                defaults=data
            )
            retailers.append(retailer)
            status = 'Created' if created else 'Already exists'
            self.stdout.write(f'  Retailer: {retailer.name} - {status}')

        return retailers

    def create_products(self):
        """Create 10 common grocery items with varying processing levels."""
        products_data = [
            # Low processing (Nova 1) - Unprocessed/Minimally Processed
            {
                'name': 'Organic Whole Milk',
                'description': 'Fresh organic whole milk from grass-fed cows',
                'category': 'Dairy',
                'nova_score': 1,
                'nutri_score': 'A',
                'unit': 'litre',
                'image_url': 'https://example.com/images/milk.jpg',
            },
            {
                'name': 'Free Range Eggs (6 pack)',
                'description': 'Farm fresh free range eggs',
                'category': 'Dairy',
                'nova_score': 1,
                'nutri_score': 'A',
                'unit': 'pack',
                'image_url': 'https://example.com/images/eggs.jpg',
            },
            {
                'name': 'Fresh Apples (1kg)',
                'description': 'Crispy red apples, locally sourced',
                'category': 'Fruits & Vegetables',
                'nova_score': 1,
                'nutri_score': 'A',
                'unit': 'kg',
                'image_url': 'https://example.com/images/apples.jpg',
            },
            {
                'name': 'Brown Rice (1kg)',
                'description': 'Whole grain brown rice',
                'category': 'Grains & Cereals',
                'nova_score': 1,
                'nutri_score': 'A',
                'unit': 'kg',
                'image_url': 'https://example.com/images/rice.jpg',
            },
            # Processed Culinary Ingredients (Nova 2)
            {
                'name': 'Extra Virgin Olive Oil',
                'description': 'Cold-pressed extra virgin olive oil',
                'category': 'Oils & Condiments',
                'nova_score': 2,
                'nutri_score': 'C',
                'unit': 'bottle',
                'image_url': 'https://example.com/images/olive-oil.jpg',
            },
            {
                'name': 'Raw Honey',
                'description': 'Pure unprocessed raw honey',
                'category': 'Spreads & Sweeteners',
                'nova_score': 2,
                'nutri_score': 'D',
                'unit': 'jar',
                'image_url': 'https://example.com/images/honey.jpg',
            },
            # Processed Foods (Nova 3)
            {
                'name': 'Sourdough Bread',
                'description': 'Artisan sourdough bread, freshly baked',
                'category': 'Bakery',
                'nova_score': 3,
                'nutri_score': 'B',
                'unit': 'loaf',
                'image_url': 'https://example.com/images/bread.jpg',
            },
            {
                'name': 'Cheddar Cheese',
                'description': 'Mature cheddar cheese block',
                'category': 'Dairy',
                'nova_score': 3,
                'nutri_score': 'D',
                'unit': 'block',
                'image_url': 'https://example.com/images/cheese.jpg',
            },
            # Ultra-Processed Foods (Nova 4) - for comparison
            {
                'name': 'Breakfast Cereal',
                'description': 'Fortified breakfast cereal with vitamins',
                'category': 'Grains & Cereals',
                'nova_score': 4,
                'nutri_score': 'C',
                'unit': 'box',
                'image_url': 'https://example.com/images/cereal.jpg',
            },
            {
                'name': 'Protein Energy Bar',
                'description': 'High protein snack bar',
                'category': 'Snacks',
                'nova_score': 4,
                'nutri_score': 'D',
                'unit': 'bar',
                'image_url': 'https://example.com/images/protein-bar.jpg',
            },
        ]

        products = []
        for data in products_data:
            product, created = Product.objects.get_or_create(
                name=data['name'],
                defaults=data
            )
            products.append(product)
            status = 'Created' if created else 'Already exists'
            self.stdout.write(f'  Product: {product.name} (Nova: {product.nova_score}) - {status}')

        return products

    def create_prices(self, retailers, products):
        """
        Create prices for products at each retailer.
        Intentionally leave some gaps to test "Not Stocked" logic.
        """
        # Price matrix: [BudgetMart, FreshFoods, SuperStore]
        # None means the retailer doesn't stock this item
        price_matrix = {
            'Organic Whole Milk': [Decimal('1.49'), Decimal('1.79'), Decimal('1.59')],
            'Free Range Eggs (6 pack)': [Decimal('2.29'), Decimal('2.99'), Decimal('2.49')],
            'Fresh Apples (1kg)': [Decimal('1.99'), Decimal('2.49'), Decimal('2.19')],
            'Brown Rice (1kg)': [Decimal('2.49'), Decimal('2.99'), Decimal('2.79')],
            'Extra Virgin Olive Oil': [Decimal('5.99'), Decimal('7.49'), Decimal('6.49')],
            'Raw Honey': [Decimal('4.99'), Decimal('6.99'), None],  # SuperStore doesn't stock
            'Sourdough Bread': [Decimal('2.99'), Decimal('3.49'), Decimal('3.29')],
            'Cheddar Cheese': [Decimal('3.49'), None, Decimal('3.79')],  # FreshFoods doesn't stock
            'Breakfast Cereal': [Decimal('3.29'), Decimal('3.99'), Decimal('3.49')],
            'Protein Energy Bar': [None, Decimal('2.49'), Decimal('2.29')],  # BudgetMart doesn't stock
        }

        # Some items on sale
        sale_items = {
            ('Fresh Apples (1kg)', 'BudgetMart'): Decimal('1.49'),
            ('Sourdough Bread', 'FreshFoods'): Decimal('2.99'),
        }

        for product in products:
            prices = price_matrix.get(product.name, [])
            for i, retailer in enumerate(retailers):
                if i < len(prices) and prices[i] is not None:
                    price = prices[i]
                    is_on_sale = (product.name, retailer.name) in sale_items
                    sale_price = sale_items.get((product.name, retailer.name))

                    product_price, created = ProductPrice.objects.get_or_create(
                        product=product,
                        retailer=retailer,
                        defaults={
                            'price': price,
                            'is_on_sale': is_on_sale,
                            'sale_price': sale_price,
                            'in_stock': True,
                        }
                    )
                    if not created:
                        product_price.price = price
                        product_price.is_on_sale = is_on_sale
                        product_price.sale_price = sale_price
                        product_price.save()

                    sale_info = f' (SALE: £{sale_price})' if is_on_sale else ''
                    self.stdout.write(
                        f'    Price: {product.name} @ {retailer.name}: £{price}{sale_info}'
                    )

    def create_test_user_and_list(self, products):
        """Create a test user and a sample shopping list."""
        # Create test user
        test_user, created = User.objects.get_or_create(
            username='testuser',
            defaults={
                'email': 'test@example.com',
                'first_name': 'Test',
                'last_name': 'User',
            }
        )
        if created:
            test_user.set_password('testpass123')
            test_user.save()
            self.stdout.write(f'  Created test user: testuser (password: testpass123)')
        else:
            self.stdout.write(f'  Test user already exists')

        # Create a sample shopping list
        shopping_list, created = ShoppingList.objects.get_or_create(
            user=test_user,
            name='Weekly Groceries',
            defaults={'description': 'Our weekly grocery shopping list'}
        )

        if created:
            # Add some items to the list
            items_to_add = [
                ('Organic Whole Milk', 2),
                ('Fresh Apples (1kg)', 1),
                ('Sourdough Bread', 1),
                ('Cheddar Cheese', 1),
                ('Raw Honey', 1),  # Not stocked at SuperStore
            ]

            for product_name, quantity in items_to_add:
                product = next((p for p in products if p.name == product_name), None)
                if product:
                    ShoppingListItem.objects.create(
                        shopping_list=shopping_list,
                        product=product,
                        quantity=quantity
                    )
                    self.stdout.write(f'    Added to list: {quantity}x {product_name}')

            self.stdout.write(f'  Created shopping list: {shopping_list.name}')
        else:
            self.stdout.write(f'  Shopping list already exists')

    def print_summary(self):
        """Print a summary of the seeded data."""
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write('SEED DATA SUMMARY')
        self.stdout.write('=' * 50)
        self.stdout.write(f'Retailers: {Retailer.objects.count()}')
        self.stdout.write(f'Products: {Product.objects.count()}')
        self.stdout.write(f'Product Prices: {ProductPrice.objects.count()}')
        self.stdout.write(f'Shopping Lists: {ShoppingList.objects.count()}')
        self.stdout.write(f'Shopping List Items: {ShoppingListItem.objects.count()}')
        self.stdout.write('=' * 50)
        self.stdout.write('\nTest user credentials:')
        self.stdout.write('  Username: testuser')
        self.stdout.write('  Password: testpass123')
        self.stdout.write('=' * 50)
