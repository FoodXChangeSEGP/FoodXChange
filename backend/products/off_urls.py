"""
URL configuration for Open Food Facts product endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .off_views import (
    OFFProductViewSet,
    OFFSearchView,
    HealthySwapView,
    ProductLookupView,
)


router = DefaultRouter()
router.register(r'products', OFFProductViewSet, basename='off-product')

urlpatterns = [
    # Search endpoint - main entry point for finding products
    path('search/', OFFSearchView.as_view(), name='off-search'),
    
    # Healthy Swap endpoint - find healthier alternatives
    path('swap/', HealthySwapView.as_view(), name='off-swap'),
    
    # Single product lookup by barcode
    path('product/<str:code>/', ProductLookupView.as_view(), name='off-product-lookup'),
    
    # ViewSet routes (browsing cached products)
    path('', include(router.urls)),
]
