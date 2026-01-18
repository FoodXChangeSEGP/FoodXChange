from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShoppingListViewSet

router = DefaultRouter()
router.register(r'shopping-lists', ShoppingListViewSet, basename='shopping-list')

urlpatterns = [
    path('', include(router.urls)),
]
