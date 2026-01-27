from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from products.models import Retailer, Product, ProductPrice
from .models import ShoppingList, ShoppingListItem
from .services import ShoppingListComparisonService


class ShoppingListModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="TestPass123!"
        )
        self.shopping_list = ShoppingList.objects.create(
            user=self.user, name="Weekly Shop"
        )
        self.product = Product.objects.create(
            name="Milk", category="Dairy", nova_score=1, nutri_score="A"
        )

    def test_str(self):
        self.assertIn("Weekly Shop", str(self.shopping_list))
        self.assertIn("testuser", str(self.shopping_list))

    def test_total_items_empty(self):
        self.assertEqual(self.shopping_list.total_items, 0)

    def test_total_items_with_items(self):
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product, quantity=2
        )
        self.assertEqual(self.shopping_list.total_items, 1)

    def test_total_quantity(self):
        product2 = Product.objects.create(
            name="Bread", category="Bakery", nova_score=3, nutri_score="C"
        )
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product, quantity=2
        )
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=product2, quantity=3
        )
        self.assertEqual(self.shopping_list.total_quantity, 5)

    def test_ordering_by_updated_at(self):
        list2 = ShoppingList.objects.create(user=self.user, name="Second List")
        lists = list(ShoppingList.objects.values_list("name", flat=True))
        # Most recently updated first
        self.assertEqual(lists[0], "Second List")


class ShoppingListItemModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="TestPass123!"
        )
        self.shopping_list = ShoppingList.objects.create(
            user=self.user, name="My List"
        )
        self.product = Product.objects.create(
            name="Eggs", category="Dairy", nova_score=1, nutri_score="A"
        )

    def test_str(self):
        item = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product, quantity=6
        )
        self.assertIn("6x", str(item))
        self.assertIn("Eggs", str(item))

    def test_unique_together(self):
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product
        )
        with self.assertRaises(Exception):
            ShoppingListItem.objects.create(
                shopping_list=self.shopping_list, product=self.product
            )

    def test_default_quantity(self):
        item = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product
        )
        self.assertEqual(item.quantity, 1)

    def test_default_is_checked(self):
        item = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product
        )
        self.assertFalse(item.is_checked)


class ShoppingListComparisonServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="TestPass123!"
        )
        self.shopping_list = ShoppingList.objects.create(
            user=self.user, name="Comparison Test"
        )

        # Create retailers
        self.tesco = Retailer.objects.create(name="Tesco")
        self.aldi = Retailer.objects.create(name="Aldi")

        # Create products
        self.milk = Product.objects.create(
            name="Milk", category="Dairy", nova_score=1, nutri_score="A"
        )
        self.bread = Product.objects.create(
            name="Bread", category="Bakery", nova_score=3, nutri_score="C"
        )

        # Add items to shopping list
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.milk, quantity=2
        )
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.bread, quantity=1
        )

        # Create prices - Tesco has both, Aldi only has milk
        ProductPrice.objects.create(
            product=self.milk, retailer=self.tesco, price=Decimal("1.20")
        )
        ProductPrice.objects.create(
            product=self.bread, retailer=self.tesco, price=Decimal("0.80")
        )
        ProductPrice.objects.create(
            product=self.milk, retailer=self.aldi, price=Decimal("0.99")
        )

    def test_compare_prices(self):
        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        self.assertEqual(len(comparisons), 2)

    def test_complete_retailer_ranked_first(self):
        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        # Tesco has all items, should be ranked first
        self.assertEqual(comparisons[0]["retailer"]["name"], "Tesco")
        self.assertTrue(comparisons[0]["is_complete"])

    def test_tesco_total_cost(self):
        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        tesco = comparisons[0]
        # 2x Milk @ 1.20 + 1x Bread @ 0.80 = 3.20
        self.assertEqual(Decimal(tesco["total"]), Decimal("3.20"))

    def test_aldi_incomplete(self):
        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        aldi = next(c for c in comparisons if c["retailer"]["name"] == "Aldi")
        self.assertFalse(aldi["is_complete"])
        self.assertEqual(len(aldi["not_stocked_items"]), 1)

    def test_cheapest_complete(self):
        service = ShoppingListComparisonService(self.shopping_list)
        result = service.get_cheapest_complete()
        self.assertIsNotNone(result)
        self.assertEqual(result["retailer"]["name"], "Tesco")

    def test_cheapest_overall(self):
        service = ShoppingListComparisonService(self.shopping_list)
        result = service.get_cheapest_overall()
        self.assertIsNotNone(result)
        # Aldi total is 2x0.99 = 1.98, Tesco is 3.20
        self.assertEqual(result["retailer"]["name"], "Aldi")

    def test_empty_list(self):
        empty_list = ShoppingList.objects.create(
            user=self.user, name="Empty"
        )
        service = ShoppingListComparisonService(empty_list)
        self.assertEqual(service.compare_prices(), [])
        self.assertIsNone(service.get_cheapest_complete())
        self.assertIsNone(service.get_cheapest_overall())

    def test_sale_price_used(self):
        # Put milk on sale at Tesco
        price = ProductPrice.objects.get(
            product=self.milk, retailer=self.tesco
        )
        price.is_on_sale = True
        price.sale_price = Decimal("0.90")
        price.save()

        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        tesco = comparisons[0]
        # 2x Milk @ 0.90 (sale) + 1x Bread @ 0.80 = 2.60
        self.assertEqual(Decimal(tesco["total"]), Decimal("2.60"))

    def test_rank_assignment(self):
        service = ShoppingListComparisonService(self.shopping_list)
        comparisons = service.compare_prices()
        ranks = [c["rank"] for c in comparisons]
        self.assertEqual(ranks, [1, 2])


class ShoppingListAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="TestPass123!"
        )
        self.client.force_authenticate(user=self.user)
        self.shopping_list = ShoppingList.objects.create(
            user=self.user, name="My List", description="Test list"
        )
        self.product = Product.objects.create(
            name="Apples", category="Fruit", nova_score=1, nutri_score="A"
        )

    def test_list_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/shopping-lists/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_shopping_lists(self):
        response = self.client.get("/api/shopping-lists/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)

    def test_user_isolation(self):
        other_user = User.objects.create_user(
            username="other", password="OtherPass123!"
        )
        ShoppingList.objects.create(user=other_user, name="Other's List")
        response = self.client.get("/api/shopping-lists/")
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "My List")

    def test_create_shopping_list(self):
        response = self.client.post(
            "/api/shopping-lists/",
            {"name": "New List", "description": "A new list"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New List")

    def test_update_shopping_list(self):
        response = self.client.patch(
            f"/api/shopping-lists/{self.shopping_list.id}/",
            {"name": "Updated Name"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Name")

    def test_delete_shopping_list(self):
        response = self.client.delete(
            f"/api/shopping-lists/{self.shopping_list.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ShoppingList.objects.count(), 0)

    def test_add_item(self):
        response = self.client.post(
            f"/api/shopping-lists/{self.shopping_list.id}/add_item/",
            {"product_id": self.product.id, "quantity": 3},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["quantity"], 3)

    def test_add_duplicate_item_increments_quantity(self):
        self.client.post(
            f"/api/shopping-lists/{self.shopping_list.id}/add_item/",
            {"product_id": self.product.id, "quantity": 2},
        )
        response = self.client.post(
            f"/api/shopping-lists/{self.shopping_list.id}/add_item/",
            {"product_id": self.product.id, "quantity": 3},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["quantity"], 5)

    def test_remove_item(self):
        item = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product
        )
        response = self.client.delete(
            f"/api/shopping-lists/{self.shopping_list.id}/items/{item.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ShoppingListItem.objects.count(), 0)

    def test_update_item(self):
        item = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product, quantity=1
        )
        response = self.client.patch(
            f"/api/shopping-lists/{self.shopping_list.id}/items/{item.id}/update/",
            {"quantity": 5},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 5)

    def test_clear_checked(self):
        item1 = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list,
            product=self.product,
            is_checked=True,
        )
        product2 = Product.objects.create(
            name="Bananas", category="Fruit", nova_score=1, nutri_score="A"
        )
        item2 = ShoppingListItem.objects.create(
            shopping_list=self.shopping_list,
            product=product2,
            is_checked=False,
        )
        response = self.client.post(
            f"/api/shopping-lists/{self.shopping_list.id}/clear_checked/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["deleted_count"], 1)
        self.assertEqual(ShoppingListItem.objects.count(), 1)

    def test_uncheck_all(self):
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list,
            product=self.product,
            is_checked=True,
        )
        response = self.client.post(
            f"/api/shopping-lists/{self.shopping_list.id}/uncheck_all/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_count"], 1)
        item = ShoppingListItem.objects.first()
        self.assertFalse(item.is_checked)

    def test_compare_endpoint(self):
        retailer = Retailer.objects.create(name="Tesco")
        ProductPrice.objects.create(
            product=self.product,
            retailer=retailer,
            price=Decimal("2.00"),
        )
        ShoppingListItem.objects.create(
            shopping_list=self.shopping_list, product=self.product
        )
        response = self.client.get(
            f"/api/shopping-lists/{self.shopping_list.id}/compare/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("comparison", response.data)
        self.assertIn("cheapest_complete", response.data)
        self.assertIn("cheapest_overall", response.data)
