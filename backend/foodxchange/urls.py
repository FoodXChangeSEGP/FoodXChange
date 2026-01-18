"""
URL configuration for foodxchange project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('products.urls')),
    path('api/', include('shopping.urls')),
    path('api/', include('users.urls')),
]
