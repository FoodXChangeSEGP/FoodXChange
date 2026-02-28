from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProductViewSet, RetailerViewSet, ProductPriceViewSet,
    UserListViewSet, MyListItemViewSet, CartItemViewSet,
    NewsArticleViewSet,
)


router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'retailers', RetailerViewSet, basename='retailer')
router.register(r'prices', ProductPriceViewSet, basename='price')
router.register(r'user-lists', UserListViewSet, basename='userlist')
router.register(r'mylist', MyListItemViewSet, basename='mylist')
router.register(r'cart', CartItemViewSet, basename='cart')
router.register(r'news', NewsArticleViewSet, basename='news')

urlpatterns = [
    path('', include(router.urls)),
]
