from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Retailer(models.Model):
    name = models.CharField(max_length=100, unique=True)
    logo_url = models.URLField(blank=True, null=True)
    website_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    class NovaScore(models.IntegerChoices):
        UNPROCESSED = 1, "Unprocessed/Minimally Processed"
        PROCESSED_INGREDIENTS = 2, "Processed Culinary Ingredients"
        PROCESSED = 3, "Processed Foods"
        ULTRA_PROCESSED = 4, "Ultra-Processed Foods"

    class NutriScore(models.TextChoices):
        A = 'A', 'A - Excellent'
        B = 'B', 'B - Good'
        C = 'C', 'C - Moderate'
        D = 'D', 'D - Low'
        E = 'E', 'E - Poor'

    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True, null=True)
    category = models.CharField(max_length=100, db_index=True)
    nova_score = models.IntegerField(
        choices=NovaScore.choices,
        help_text="NOVA food processing classification (1-4)"
    )
    nutri_score = models.CharField(
        max_length=1,
        choices=NutriScore.choices,
        help_text="Nutri-Score nutritional rating (A-E)"
    )
    barcode = models.CharField(max_length=50, blank=True, null=True, unique=True)
    unit = models.CharField(
        max_length=20, 
        default='item',
        help_text="Unit of measurement (e.g., 'item', 'kg', 'litre')"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    retailers = models.ManyToManyField(
        Retailer,
        through='ProductPrice',
        related_name='products'
    )

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['category', 'nova_score']),
            models.Index(fields=['nova_score']),
        ]

    def __str__(self):
        return f"{self.name} (Nova: {self.nova_score}, Nutri: {self.nutri_score})"


class ProductPrice(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='prices'
    )
    retailer = models.ForeignKey(
        Retailer,
        on_delete=models.CASCADE,
        related_name='product_prices'
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='GBP')
    is_on_sale = models.BooleanField(default=False)
    sale_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        blank=True, 
        null=True
    )
    in_stock = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('product', 'retailer')
        ordering = ['price']
        indexes = [
            models.Index(fields=['retailer', 'product']),
            models.Index(fields=['product', 'price']),
        ]

    def __str__(self):
        return f"{self.product.name} @ {self.retailer.name}: {self.currency} {self.price}"

    @property
    def effective_price(self):
        """Returns the sale price if on sale, otherwise regular price."""
        if self.is_on_sale and self.sale_price:
            return self.sale_price
        return self.price

class MyListItem(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='mylist_items',
        null=True,
        blank=True,
    )
    barcode = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'barcode')

    def __str__(self):
        owner = self.user.username if self.user else 'anonymous'
        return f"{owner} - {self.name} x{self.quantity}"


class CartItem(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='cart_items',
    )
    barcode = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    image_url = models.URLField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    retailer_name = models.CharField(max_length=100, blank=True)
    product_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'barcode')

    def __str__(self):
        return f"{self.user.username} - {self.name} x{self.quantity}"



