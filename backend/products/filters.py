import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    """
    Filter for Product queryset.
    Supports filtering by name, category, nova_score, and nutri_score.
    """
    name = django_filters.CharFilter(lookup_expr='icontains')
    category = django_filters.CharFilter(lookup_expr='iexact')
    category_contains = django_filters.CharFilter(
        field_name='category',
        lookup_expr='icontains'
    )
    nova_score = django_filters.NumberFilter()
    nova_score_max = django_filters.NumberFilter(
        field_name='nova_score',
        lookup_expr='lte'
    )
    nova_score_min = django_filters.NumberFilter(
        field_name='nova_score',
        lookup_expr='gte'
    )
    nutri_score = django_filters.CharFilter(lookup_expr='iexact')
    nutri_score_max = django_filters.CharFilter(
        field_name='nutri_score',
        lookup_expr='lte'
    )

    class Meta:
        model = Product
        fields = [
            'name', 'category', 'category_contains',
            'nova_score', 'nova_score_max', 'nova_score_min',
            'nutri_score', 'nutri_score_max'
        ]
