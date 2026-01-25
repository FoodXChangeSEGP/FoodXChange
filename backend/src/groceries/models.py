from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    nova_score = models.IntegerField()
    calories_per_100g = models.FloatField()
    protein_per_100g = models.FloatField()
    carbs_per_100g = models.FloatField()
    fat_per_100g = models.FloatField()


def __str__(self):
    return self.name


class Retailer(models.Model):
    name = models.CharField(max_length=100)


def __str__(self):
    return self.name


class RetailerProduct(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    retailer = models.ForeignKey(Retailer, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    unit = models.CharField(max_length=50)

    class Meta:
        unique_together = ('product', 'retailer')

