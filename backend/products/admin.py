from django.contrib import admin
from .models import Product, Retailer, ProductPrice
from .off_models import OFFProduct, SearchQueryCache


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


@admin.register(OFFProduct)
class OFFProductAdmin(admin.ModelAdmin):
    list_display = [
        'product_name', 'brands', 'nutriscore_grade', 'nova_group',
        'code', 'updated_at'
    ]
    list_filter = ['nutriscore_grade', 'nova_group', 'search_query']
    search_fields = ['product_name', 'brands', 'code', 'categories']
    ordering = ['nutriscore_grade', 'nova_group', 'product_name']
    readonly_fields = ['created_at', 'updated_at', 'last_fetched_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('code', 'product_name', 'brands', 'image_url')
        }),
        ('Nutrition Scores', {
            'fields': ('nutriscore_grade', 'nova_group')
        }),
        ('Traffic Light Values (per 100g)', {
            'fields': ('sugars_100g', 'salt_100g', 'fat_100g', 'saturated_fat_100g')
        }),
        ('Metadata', {
            'fields': (
                'completeness', 'countries', 'categories',
                'search_query', 'created_at', 'updated_at', 'last_fetched_at'
            )
        }),
    )


@admin.register(SearchQueryCache)
class SearchQueryCacheAdmin(admin.ModelAdmin):
    list_display = ['query', 'result_count', 'is_complete', 'last_searched_at']
    search_fields = ['query']
    ordering = ['-last_searched_at']
    readonly_fields = ['last_searched_at']
