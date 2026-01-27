from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from .models import Retailer, Product, ProductPrice


class RetailerModelTest(TestCase):
    def setUp(self):
        self.retailer = Retailer.objects.create(
            name="Tesco",
            logo_url="https://example.com/tesco.png",
            website_url="https://tesco.com",
        )

    def test_str(self):
        self.assertEqual(str(self.retailer), "Tesco")

    def test_unique_name(self):
        with self.assertRaises(Exception):
            Retailer.objects.create(name="Tesco")

    def test_ordering(self):
        Retailer.objects.create(name="Aldi")
        retailers = list(Retailer.objects.values_list("name", flat=True))
        self.assertEqual(retailers, ["Aldi", "Tesco"])


class ProductModelTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            name="Organic Milk",
            description="Fresh organic whole milk",
            category="Dairy",
            nova_score=1,
            nutri_score="A",
            barcode="1234567890123",
            unit="litre",
        )

    def test_str(self):
        self.assertIn("Organic Milk", str(self.product))
        self.assertIn("Nova: 1", str(self.product))
        self.assertIn("Nutri: A", str(self.product))

    def test_unique_barcode(self):
        with self.assertRaises(Exception):
            Product.objects.create(
                name="Another Product",
                category="Dairy",
                nova_score=1,
                nutri_score="A",
                barcode="1234567890123",
            )

    def test_null_barcode_allowed(self):
        p1 = Product.objects.create(
            name="Product A", category="Fruit", nova_score=1, nutri_score="A"
        )
        p2 = Product.objects.create(
            name="Product B", category="Fruit", nova_score=1, nutri_score="A"
        )
        self.assertIsNone(p1.barcode)
        self.assertIsNone(p2.barcode)

    def test_nova_score_choices(self):
        self.assertEqual(
            Product.NovaScore.UNPROCESSED, 1
        )
        self.assertEqual(
            Product.NovaScore.ULTRA_PROCESSED, 4
        )

    def test_nutri_score_choices(self):
        self.assertEqual(Product.NutriScore.A, "A")
        self.assertEqual(Product.NutriScore.E, "E")


class ProductPriceModelTest(TestCase):
    def setUp(self):
        self.retailer = Retailer.objects.create(name="Tesco")
        self.product = Product.objects.create(
            name="Bread", category="Bakery", nova_score=3, nutri_score="C"
        )
        self.price = ProductPrice.objects.create(
            product=self.product,
            retailer=self.retailer,
            price=Decimal("1.50"),
            currency="GBP",
        )

    def test_str(self):
        self.assertIn("Bread", str(self.price))
        self.assertIn("Tesco", str(self.price))
        self.assertIn("1.50", str(self.price))

    def test_effective_price_regular(self):
        self.assertEqual(self.price.effective_price, Decimal("1.50"))

    def test_effective_price_on_sale(self):
        self.price.is_on_sale = True
        self.price.sale_price = Decimal("0.99")
        self.price.save()
        self.assertEqual(self.price.effective_price, Decimal("0.99"))

    def test_effective_price_on_sale_no_sale_price(self):
        self.price.is_on_sale = True
        self.price.sale_price = None
        self.price.save()
        self.assertEqual(self.price.effective_price, Decimal("1.50"))

    def test_unique_together(self):
        with self.assertRaises(Exception):
            ProductPrice.objects.create(
                product=self.product,
                retailer=self.retailer,
                price=Decimal("2.00"),
            )

    def test_ordering_by_price(self):
        retailer2 = Retailer.objects.create(name="Aldi")
        ProductPrice.objects.create(
            product=self.product,
            retailer=retailer2,
            price=Decimal("0.99"),
        )
        prices = list(
            ProductPrice.objects.filter(product=self.product)
            .values_list("price", flat=True)
        )
        self.assertEqual(prices, [Decimal("0.99"), Decimal("1.50")])


class RetailerAPITest(APITestCase):
    def setUp(self):
        self.retailer = Retailer.objects.create(
            name="Tesco", website_url="https://tesco.com"
        )

    def test_list_retailers(self):
        response = self.client.get("/api/retailers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Tesco")

    def test_retrieve_retailer(self):
        response = self.client.get(f"/api/retailers/{self.retailer.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Tesco")

    def test_search_retailers(self):
        Retailer.objects.create(name="Aldi")
        response = self.client.get("/api/retailers/", {"search": "tesco"})
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Tesco")


class ProductAPITest(APITestCase):
    def setUp(self):
        self.product1 = Product.objects.create(
            name="Organic Milk",
            category="Dairy",
            nova_score=1,
            nutri_score="A",
            barcode="111",
        )
        self.product2 = Product.objects.create(
            name="Crisps",
            category="Snacks",
            nova_score=4,
            nutri_score="D",
            barcode="222",
        )
        self.retailer = Retailer.objects.create(name="Tesco")
        ProductPrice.objects.create(
            product=self.product1,
            retailer=self.retailer,
            price=Decimal("1.20"),
        )

    def test_list_products(self):
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 2)

    def test_retrieve_product_detail(self):
        response = self.client.get(f"/api/products/{self.product1.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Organic Milk")
        self.assertIn("prices", response.data)

    def test_search_products(self):
        response = self.client.get("/api/products/", {"search": "milk"})
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Organic Milk")

    def test_filter_by_category(self):
        response = self.client.get("/api/products/", {"category": "dairy"})
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Organic Milk")

    def test_filter_by_nova_score(self):
        response = self.client.get("/api/products/", {"nova_score": 4})
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Crisps")

    def test_filter_by_nutri_score(self):
        response = self.client.get("/api/products/", {"nutri_score": "A"})
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Organic Milk")

    def test_categories_endpoint(self):
        response = self.client.get("/api/products/categories/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Dairy", response.data)
        self.assertIn("Snacks", response.data)

    def test_low_processing_endpoint(self):
        response = self.client.get("/api/products/low_processing/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Organic Milk")

    def test_product_prices_endpoint(self):
        response = self.client.get(
            f"/api/products/{self.product1.id}/prices/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_product_list_includes_lowest_price(self):
        response = self.client.get("/api/products/")
        results = response.data.get("results", response.data)
        milk = next(r for r in results if r["name"] == "Organic Milk")
        self.assertIsNotNone(milk["lowest_price"])
        self.assertEqual(milk["lowest_price"]["price"], "1.20")
        self.assertEqual(milk["lowest_price"]["retailer"], "Tesco")

    def test_product_list_no_price(self):
        response = self.client.get("/api/products/")
        results = response.data.get("results", response.data)
        crisps = next(r for r in results if r["name"] == "Crisps")
        self.assertIsNone(crisps["lowest_price"])
