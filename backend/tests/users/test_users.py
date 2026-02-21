from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status


class UserRegistrationAPITest(APITestCase):
    def test_register_success(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "newuser")
        self.assertEqual(response.data["first_name"], "New")
        self.assertEqual(response.data["last_name"], "User")
        # Registration should return JWT tokens
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_register_returns_tokens(self):
        """Tokens returned on register should work for authentication."""
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "tokenuser",
                "email": "token@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "Token",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token = response.data["tokens"]["access"]

        # Use token to access protected endpoint
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me_response = self.client.get("/api/users/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["username"], "tokenuser")

    def test_register_password_mismatch(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "WrongPass456!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_weak_password(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "123",
                "password_confirm": "123",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username(self):
        User.objects.create_user(username="existing", password="TestPass123!")
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "existing",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email(self):
        User.objects.create_user(
            username="existing",
            email="taken@example.com",
            password="TestPass123!",
        )
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "taken@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_first_name(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_email_case_insensitive(self):
        """Email uniqueness should be case-insensitive."""
        User.objects.create_user(
            username="existing",
            email="test@example.com",
            password="TestPass123!",
        )
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "TEST@EXAMPLE.COM",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "New",
                "last_name": "User",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class JWTAuthAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="testuser@example.com",
            password="TestPass123!",
        )

    def test_login_success(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "TestPass123!"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_with_email(self):
        """Users should be able to log in with email instead of username."""
        response = self.client.post(
            "/api/auth/login/",
            {"username": "testuser@example.com", "password": "TestPass123!"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_login_invalid_credentials(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "WrongPassword!"},
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "TestPass123!"},
        )
        refresh_token = login_response.data["refresh"]
        response = self.client.post(
            "/api/auth/refresh/", {"refresh": refresh_token}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


class UserProfileAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="TestPass123!",
            first_name="Test",
            last_name="User",
        )

    def test_current_user_requires_auth(self):
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "testuser")
        self.assertEqual(response.data["email"], "test@example.com")
        self.assertEqual(response.data["first_name"], "Test")
        self.assertEqual(response.data["last_name"], "User")

    def test_profile_requires_auth(self):
        response = self.client.get("/api/users/profile/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/users/profile/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Test")

    def test_update_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            "/api/users/profile/", {"first_name": "Updated"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
