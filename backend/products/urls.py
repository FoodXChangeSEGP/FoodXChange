from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, RetailerViewSet, ProductPriceViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'retailers', RetailerViewSet, basename='retailer')
router.register(r'prices', ProductPriceViewSet, basename='price')

urlpatterns = [
    path('', include(router.urls)),
]
