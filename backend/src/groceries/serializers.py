from rest_framework import serializers
from .models import Product, RetailerProduct


class RetailerProductSerializer(serializers.ModelSerializer):
    retailer = serializers.CharField(source='retailer.name')

    class Meta:
        model = RetailerProduct
        fields = ['retailer', 'price', 'unit']


class ProductSerializer(serializers.ModelSerializer):
    prices = RetailerProductSerializer(source='retailerproduct_set', many=True)

    class Meta:
        model = Product
        fields = '__all__'