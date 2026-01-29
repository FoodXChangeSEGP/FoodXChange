"""
URL configuration for grocer product search API.

These endpoints provide access to grocery retailer APIs for
product search and lookup.
"""

from django.urls import path
from .grocer_views import (
    GrocerListView,
    GrocerSearchView,
    GrocerProductDetailView,
    GrocerBarcodeSearchView,
    MultiGrocerSearchView,
    CombinedSearchView,
)

urlpatterns = [
    # List available grocers
    path('', GrocerListView.as_view(), name='grocer-list'),
    
    # Combined search (recommended) - deduplicates and enriches with nutrition
    path('search/combined/', CombinedSearchView.as_view(), name='grocer-search-combined'),
    
    # Search across all grocers (raw, without deduplication)
    path('search/all/', MultiGrocerSearchView.as_view(), name='grocer-search-all'),
    
    # Grocer-specific endpoints
    path('<str:grocer_id>/search/', GrocerSearchView.as_view(), name='grocer-search'),
    path('<str:grocer_id>/products/<str:product_id>/', GrocerProductDetailView.as_view(), name='grocer-product-detail'),
    path('<str:grocer_id>/barcode/<str:barcode>/', GrocerBarcodeSearchView.as_view(), name='grocer-barcode-search'),
]
