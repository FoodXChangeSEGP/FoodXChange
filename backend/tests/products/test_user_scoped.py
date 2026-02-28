from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from products.models import UserList, MyListItem, CartItem


class UserListTest(APITestCase):
    """Tests for the /api/user-lists/ endpoint."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", email="user1@example.com", password="TestPass123!",
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="TestPass123!",
        )

    def test_anonymous_gets_empty_lists(self):
        response = self.client.get("/api/user-lists/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 0)

    def test_create_list_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/user-lists/", {"name": "Weekly Shop"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Weekly Shop")
        self.assertEqual(UserList.objects.filter(user=self.user1).count(), 1)

    def test_anonymous_cannot_create_list(self):
        response = self.client.post("/api/user-lists/", {"name": "Test"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_sees_only_own_lists(self):
        UserList.objects.create(user=self.user1, name="List A")
        UserList.objects.create(user=self.user2, name="List B")

        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/user-lists/")
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "List A")

    def test_rename_list(self):
        self.client.force_authenticate(user=self.user1)
        lst = UserList.objects.create(user=self.user1, name="Old Name")
        response = self.client.patch(f"/api/user-lists/{lst.id}/", {"name": "New Name"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lst.refresh_from_db()
        self.assertEqual(lst.name, "New Name")

    def test_delete_list_cascades_items(self):
        self.client.force_authenticate(user=self.user1)
        lst = UserList.objects.create(user=self.user1, name="To Delete")
        MyListItem.objects.create(user_list=lst, barcode="123", name="Item")
        response = self.client.delete(f"/api/user-lists/{lst.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(UserList.objects.filter(id=lst.id).exists())
        self.assertFalse(MyListItem.objects.filter(user_list=lst).exists())

    def test_cannot_delete_other_users_list(self):
        lst = UserList.objects.create(user=self.user2, name="Not Mine")
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f"/api/user-lists/{lst.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(UserList.objects.filter(id=lst.id).exists())

    def test_list_reports_item_count(self):
        self.client.force_authenticate(user=self.user1)
        lst = UserList.objects.create(user=self.user1, name="Counted")
        MyListItem.objects.create(user_list=lst, barcode="a1", name="A")
        MyListItem.objects.create(user_list=lst, barcode="a2", name="B")
        response = self.client.get(f"/api/user-lists/{lst.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["item_count"], 2)


class MyListUserScopedTest(APITestCase):
    """Tests for user-scoped MyList functionality."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", email="user1@example.com", password="TestPass123!",
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="TestPass123!",
        )
        self.list1 = UserList.objects.create(user=self.user1, name="My List")
        self.list2 = UserList.objects.create(user=self.user2, name="My List")

    def test_anonymous_gets_empty_list(self):
        response = self.client.get("/api/mylist/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 0)

    def test_anonymous_cannot_add_item(self):
        response = self.client.post("/api/mylist/", {
            "barcode": "123", "name": "Test", "quantity": 1, "list_id": self.list1.id,
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_item_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/mylist/", {
            "barcode": "1234567890",
            "name": "Test Product",
            "quantity": 1,
            "list_id": self.list1.id,
        })
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertEqual(MyListItem.objects.filter(user_list=self.list1).count(), 1)

    def test_add_item_requires_list_id(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/mylist/", {
            "barcode": "1234567890", "name": "Test Product", "quantity": 1,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_add_to_other_users_list(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/mylist/", {
            "barcode": "123", "name": "Hack", "quantity": 1, "list_id": self.list2.id,
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_isolation(self):
        """User 1 should not see User 2's items."""
        MyListItem.objects.create(user_list=self.list1, barcode="111", name="User1 item")
        MyListItem.objects.create(user_list=self.list2, barcode="222", name="User2 item")

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/mylist/?list_id={self.list1.id}")
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["barcode"], "111")

    def test_filter_by_list_id(self):
        """Items should be filterable by list_id."""
        list_a = UserList.objects.create(user=self.user1, name="List A")
        list_b = UserList.objects.create(user=self.user1, name="List B")
        MyListItem.objects.create(user_list=list_a, barcode="aaa", name="A item")
        MyListItem.objects.create(user_list=list_b, barcode="bbb", name="B item")

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/mylist/?list_id={list_a.id}")
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["barcode"], "aaa")

    def test_duplicate_barcode_increments_quantity(self):
        self.client.force_authenticate(user=self.user1)
        self.client.post("/api/mylist/", {
            "barcode": "999", "name": "Dup item", "quantity": 1,
            "list_id": self.list1.id,
        })
        self.client.post("/api/mylist/", {
            "barcode": "999", "name": "Dup item", "quantity": 2,
            "list_id": self.list1.id,
        })
        item = MyListItem.objects.get(user_list=self.list1, barcode="999")
        self.assertEqual(item.quantity, 3)

    def test_remove_item(self):
        self.client.force_authenticate(user=self.user1)
        item = MyListItem.objects.create(
            user_list=self.list1, barcode="888", name="Remove me"
        )
        response = self.client.delete(f"/api/mylist/{item.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MyListItem.objects.filter(id=item.id).exists())

    def test_cannot_delete_other_users_item(self):
        """User 1 cannot delete User 2's item."""
        item = MyListItem.objects.create(
            user_list=self.list2, barcode="777", name="Not yours"
        )
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f"/api/mylist/{item.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(MyListItem.objects.filter(id=item.id).exists())


class CartItemUserScopedTest(APITestCase):
    """Tests for user-scoped CartItem functionality."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", email="user1@example.com", password="TestPass123!",
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@example.com", password="TestPass123!",
        )

    def test_anonymous_gets_empty_cart(self):
        response = self.client.get("/api/cart/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 0)

    def test_anonymous_cannot_add_to_cart(self):
        response = self.client.post("/api/cart/", {
            "barcode": "123", "name": "Test", "quantity": 1,
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_cart_item_authenticated(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/cart/", {
            "barcode": "1234567890",
            "name": "Cart Product",
            "quantity": 2,
            "price": "3.99",
            "retailer_name": "Tesco",
        })
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertEqual(CartItem.objects.filter(user=self.user1).count(), 1)

    def test_cart_user_isolation(self):
        """User 1 should not see User 2's cart items."""
        CartItem.objects.create(user=self.user1, barcode="111", name="User1 cart")
        CartItem.objects.create(user=self.user2, barcode="222", name="User2 cart")

        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/cart/")
        data = response.data
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["barcode"], "111")

    def test_upsert_cart_item(self):
        """Adding same barcode again should update, not duplicate."""
        self.client.force_authenticate(user=self.user1)
        self.client.post("/api/cart/", {
            "barcode": "999", "name": "Item", "quantity": 1, "price": "1.00",
        })
        self.client.post("/api/cart/", {
            "barcode": "999", "name": "Item Updated", "quantity": 3, "price": "2.00",
        })
        self.assertEqual(CartItem.objects.filter(user=self.user1, barcode="999").count(), 1)
        item = CartItem.objects.get(user=self.user1, barcode="999")
        self.assertEqual(item.quantity, 3)
        self.assertEqual(str(item.price), "2.00")

    def test_clear_cart(self):
        self.client.force_authenticate(user=self.user1)
        CartItem.objects.create(user=self.user1, barcode="111", name="Item 1")
        CartItem.objects.create(user=self.user1, barcode="222", name="Item 2")
        response = self.client.delete("/api/cart/clear/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(CartItem.objects.filter(user=self.user1).count(), 0)

    def test_cannot_delete_other_users_cart_item(self):
        item = CartItem.objects.create(user=self.user2, barcode="777", name="Not yours")
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f"/api/cart/{item.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(CartItem.objects.filter(id=item.id).exists())

    def test_update_cart_item_quantity(self):
        self.client.force_authenticate(user=self.user1)
        item = CartItem.objects.create(
            user=self.user1, barcode="555", name="Updatable", quantity=1
        )
        response = self.client.patch(f"/api/cart/{item.id}/", {"quantity": 5})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual(item.quantity, 5)
