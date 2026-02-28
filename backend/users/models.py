import uuid
import random
import string
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class UserProfile(models.Model):
    """Extended user profile for email verification status."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    email_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} (verified={self.email_verified})"


class EmailVerificationToken(models.Model):
    """Token for verifying a user's email address."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens',
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    TOKEN_EXPIRY_HOURS = 24

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = ''.join(random.choices(string.digits, k=6))
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(
            hours=self.TOKEN_EXPIRY_HOURS
        )

    @property
    def is_valid(self):
        return not self.used and not self.is_expired

    def __str__(self):
        return f"EmailVerification for {self.user.username} ({self.code})"


class PasswordResetToken(models.Model):
    """Token for password reset requests."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
    )
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    TOKEN_EXPIRY_MINUTES = 30

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = ''.join(random.choices(string.digits, k=6))
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(
            minutes=self.TOKEN_EXPIRY_MINUTES
        )

    @property
    def is_valid(self):
        return not self.used and not self.is_expired

    def __str__(self):
        return f"PasswordReset for {self.user.username} ({self.code})"
