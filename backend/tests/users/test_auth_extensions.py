from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch

from users.models import UserProfile, EmailVerificationToken, PasswordResetToken


# ── Model Tests ───────────────────────────────────────────────────

class UserProfileModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')

    def test_create_profile(self):
        profile = UserProfile.objects.create(user=self.user)
        self.assertFalse(profile.email_verified)
        self.assertIn('alice', str(profile))

    def test_profile_cascade_delete(self):
        UserProfile.objects.create(user=self.user)
        self.user.delete()
        self.assertEqual(UserProfile.objects.count(), 0)


class EmailVerificationTokenModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')

    def test_code_auto_generated(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        self.assertEqual(len(token.code), 6)
        self.assertTrue(token.code.isdigit())

    def test_token_is_valid_by_default(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        self.assertTrue(token.is_valid)
        self.assertFalse(token.is_expired)

    def test_used_token_is_invalid(self):
        token = EmailVerificationToken.objects.create(user=self.user, used=True)
        self.assertFalse(token.is_valid)

    def test_expired_token_is_invalid(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        EmailVerificationToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        token.refresh_from_db()
        self.assertTrue(token.is_expired)
        self.assertFalse(token.is_valid)

    def test_token_str(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        self.assertIn('alice', str(token))


class PasswordResetTokenModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')

    def test_code_auto_generated(self):
        token = PasswordResetToken.objects.create(user=self.user)
        self.assertEqual(len(token.code), 6)
        self.assertTrue(token.code.isdigit())

    def test_token_valid_within_30_minutes(self):
        token = PasswordResetToken.objects.create(user=self.user)
        self.assertTrue(token.is_valid)

    def test_token_expires_after_30_minutes(self):
        token = PasswordResetToken.objects.create(user=self.user)
        PasswordResetToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        token.refresh_from_db()
        self.assertTrue(token.is_expired)
        self.assertFalse(token.is_valid)


# ── API Tests ─────────────────────────────────────────────────────

class VerifyEmailAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice', password='Pass123!', email='alice@example.com',
        )
        UserProfile.objects.create(user=self.user)
        self.client.force_authenticate(user=self.user)

    def test_verify_with_valid_code(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        response = self.client.post('/api/auth/verify-email/', {'code': token.code})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.user)
        self.assertTrue(profile.email_verified)
        token.refresh_from_db()
        self.assertTrue(token.used)

    def test_verify_with_invalid_code(self):
        response = self.client.post('/api/auth/verify-email/', {'code': '000000'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_with_used_token(self):
        token = EmailVerificationToken.objects.create(user=self.user, used=True)
        response = self.client.post('/api/auth/verify-email/', {'code': token.code})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_with_expired_token(self):
        token = EmailVerificationToken.objects.create(user=self.user)
        EmailVerificationToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        response = self.client.post('/api/auth/verify-email/', {'code': token.code})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/auth/verify-email/', {'code': '123456'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ResendVerificationAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice', password='Pass123!', email='alice@example.com',
        )
        self.client.force_authenticate(user=self.user)

    @patch('users.views._send_verification_email')
    def test_resend_when_not_verified(self, mock_send):
        UserProfile.objects.create(user=self.user, email_verified=False)
        response = self.client.post('/api/auth/resend-verification/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(EmailVerificationToken.objects.filter(user=self.user).exists())

    def test_resend_when_already_verified(self):
        UserProfile.objects.create(user=self.user, email_verified=True)
        response = self.client.post('/api/auth/resend-verification/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views._send_verification_email')
    def test_resend_invalidates_old_tokens(self, mock_send):
        UserProfile.objects.create(user=self.user, email_verified=False)
        old_token = EmailVerificationToken.objects.create(user=self.user)
        self.client.post('/api/auth/resend-verification/')
        old_token.refresh_from_db()
        self.assertTrue(old_token.used)

    def test_resend_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/auth/resend-verification/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice', password='OldPass123!', email='alice@example.com',
        )

    @patch('users.views._send_password_reset_email')
    def test_request_reset_existing_email(self, mock_send):
        response = self.client.post('/api/auth/password-reset/', {'email': 'alice@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_request_reset_nonexistent_email_still_200(self):
        response = self.client.post('/api/auth/password-reset/', {'email': 'nobody@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('users.views._send_password_reset_email')
    def test_request_reset_case_insensitive_email(self, mock_send):
        response = self.client.post('/api/auth/password-reset/', {'email': 'ALICE@EXAMPLE.COM'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PasswordResetToken.objects.filter(user=self.user).exists())

    @patch('users.views._send_password_reset_email')
    def test_confirm_reset_valid_code(self, mock_send):
        token = PasswordResetToken.objects.create(user=self.user)
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'alice@example.com',
            'code': token.code,
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass456!'))
        token.refresh_from_db()
        self.assertTrue(token.used)

    def test_confirm_reset_invalid_code(self):
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'alice@example.com',
            'code': '000000',
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_wrong_email(self):
        token = PasswordResetToken.objects.create(user=self.user)
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'wrong@example.com',
            'code': token.code,
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views._send_password_reset_email')
    def test_confirm_reset_expired_token(self, mock_send):
        token = PasswordResetToken.objects.create(user=self.user)
        PasswordResetToken.objects.filter(pk=token.pk).update(
            created_at=timezone.now() - timedelta(minutes=31)
        )
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'alice@example.com',
            'code': token.code,
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views._send_password_reset_email')
    def test_confirm_reset_used_token(self, mock_send):
        token = PasswordResetToken.objects.create(user=self.user, used=True)
        response = self.client.post('/api/auth/password-reset/confirm/', {
            'email': 'alice@example.com',
            'code': token.code,
            'new_password': 'NewPass456!',
            'new_password_confirm': 'NewPass456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DeleteAccountAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='alice', password='Pass123!', email='alice@example.com',
        )
        self.client.force_authenticate(user=self.user)

    def test_delete_account(self):
        user_id = self.user.id
        response = self.client.delete('/api/auth/delete-account/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=user_id).exists())

    def test_delete_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.delete('/api/auth/delete-account/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_removes_profile(self):
        UserProfile.objects.create(user=self.user)
        user_id = self.user.id
        self.client.delete('/api/auth/delete-account/')
        self.assertFalse(UserProfile.objects.filter(user_id=user_id).exists())
