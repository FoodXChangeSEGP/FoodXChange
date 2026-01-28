"""
URL configuration for foodxchange project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    """Health check endpoint for Render deployment."""
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('healthz', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/', include('products.urls')),
    path('api/', include('shopping.urls')),
    path('api/', include('users.urls')),
    # Open Food Facts API endpoints for Healthy Swap feature
    path('api/off/', include('products.off_urls')),
]
