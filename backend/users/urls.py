from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    UserRegistrationView,
    UserProfileView,
    CurrentUserView,
    VerifyEmailView,
    ResendVerificationView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    DeleteAccountView,
)

urlpatterns = [
    # Authentication
    path('auth/register/', UserRegistrationView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Email verification
    path('auth/verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path(
        'auth/resend-verification/',
        ResendVerificationView.as_view(),
        name='resend_verification',
    ),

    # Password reset
    path(
        'auth/password-reset/',
        PasswordResetRequestView.as_view(),
        name='password_reset_request',
    ),
    path(
        'auth/password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='password_reset_confirm',
    ),

    # Account management
    path('auth/delete-account/', DeleteAccountView.as_view(), name='delete_account'),

    # User profile
    path('users/me/', CurrentUserView.as_view(), name='current_user'),
    path('users/profile/', UserProfileView.as_view(), name='user_profile'),
]
