from django.contrib import admin
from .models import ShoppingList, ShoppingListItem


class ShoppingListItemInline(admin.TabularInline):
    model = ShoppingListItem
    extra = 1
    fields = ['product', 'quantity', 'is_checked', 'notes']
    autocomplete_fields = ['product']


@admin.register(ShoppingList)
class ShoppingListAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'total_items', 'is_active', 'created_at', 'updated_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'user__username']
    ordering = ['-updated_at']
    inlines = [ShoppingListItemInline]


@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ['product', 'shopping_list', 'quantity', 'is_checked', 'added_at']
    list_filter = ['is_checked', 'added_at']
    search_fields = ['product__name', 'shopping_list__name']
    ordering = ['-added_at']
