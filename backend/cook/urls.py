from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import RecipeViewSet, CookingHackViewSet

router = DefaultRouter()
router.register('recipes', RecipeViewSet, basename='recipe')
router.register('hacks', CookingHackViewSet, basename='cooking-hack')

urlpatterns = [
    path('', include(router.urls)),
]
