from django.contrib import admin
from .models import Product, Retailer, ProductPrice


class ProductPriceInline(admin.TabularInline):
    model = ProductPrice
    extra = 1
    fields = ['retailer', 'price', 'currency', 'is_on_sale', 'sale_price', 'in_stock']


@admin.register(Retailer)
class RetailerAdmin(admin.ModelAdmin):
    list_display = ['name', 'website_url', 'created_at']
    search_fields = ['name']
    ordering = ['name']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'nova_score', 'nutri_score', 'created_at']
    list_filter = ['category', 'nova_score', 'nutri_score']
    search_fields = ['name', 'description', 'barcode']
    ordering = ['name']
    inlines = [ProductPriceInline]


@admin.register(ProductPrice)
class ProductPriceAdmin(admin.ModelAdmin):
    list_display = ['product', 'retailer', 'price', 'currency', 'is_on_sale', 'in_stock']
    list_filter = ['retailer', 'in_stock', 'is_on_sale']
    search_fields = ['product__name', 'retailer__name']
    ordering = ['product__name', 'retailer__name']
