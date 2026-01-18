from django.db import models
from django.conf import settings
from products.models import Product


class ShoppingList(models.Model):
    """
    Represents a user's shopping list.
    A user can have multiple named shopping lists.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shopping_lists'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})"

    @property
    def total_items(self):
        """Get total number of unique items in the list."""
        return self.items.count()

    @property
    def total_quantity(self):
        """Get total quantity of all items in the list."""
        return sum(item.quantity for item in self.items.all())


class ShoppingListItem(models.Model):
    """
    Represents an item in a shopping list.
    Links a product to a shopping list with quantity and checked status.
    """
    shopping_list = models.ForeignKey(
        ShoppingList,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='shopping_list_items'
    )
    quantity = models.PositiveIntegerField(default=1)
    is_checked = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True)
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('shopping_list', 'product')
        ordering = ['added_at']
        indexes = [
            models.Index(fields=['shopping_list', 'is_checked']),
        ]

    def __str__(self):
        return f"{self.quantity}x {self.product.name} in {self.shopping_list.name}"
