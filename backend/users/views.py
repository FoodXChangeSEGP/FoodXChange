from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    EmailVerificationConfirmSerializer,
)
from .models import UserProfile, EmailVerificationToken, PasswordResetToken


def _send_verification_email(user, token):
    """Send an email verification code to the user."""
    subject = 'FoodXchange \u2013 Verify your email'
    message = (
        f"Hi {user.first_name},\n\n"
        f"Your email verification code is: {token.code}\n\n"
        f"This code expires in {token.TOKEN_EXPIRY_HOURS} hours.\n\n"
        f"If you didn't create a FoodXchange account, "
        f"you can ignore this email.\n\n"
        f"\u2013 The FoodXchange Team"
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def _send_password_reset_email(user, token):
    """Send a password reset code to the user."""
    subject = 'FoodXchange \u2013 Password Reset'
    message = (
        f"Hi {user.first_name},\n\n"
        f"Your password reset code is: {token.code}\n\n"
        f"This code expires in {token.TOKEN_EXPIRY_MINUTES} minutes.\n\n"
        f"If you didn't request a password reset, "
        f"you can ignore this email.\n\n"
        f"\u2013 The FoodXchange Team"
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def _get_or_create_profile(user):
    """Get or create UserProfile for the given user."""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


class UserRegistrationView(generics.CreateAPIView):
    """API view for user registration. Returns JWT tokens on success."""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Create profile & send verification email
        _get_or_create_profile(user)
        try:
            EmailVerificationToken.objects.filter(
                user=user, used=False
            ).update(used=True)
            token = EmailVerificationToken.objects.create(user=user)
            _send_verification_email(user, token)
        except Exception:
            pass  # Don't block registration if email sending fails

        # Generate JWT tokens so the user is logged in immediately
        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data

        return Response(
            {
                **user_data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """API view for retrieving/updating the current user's profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        _get_or_create_profile(self.request.user)
        return self.request.user


class CurrentUserView(APIView):
    """API view for getting the current authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        _get_or_create_profile(request.user)
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


# -- Email Verification -------------------------------------------------------

class VerifyEmailView(APIView):
    """Verify the user's email with a 6-digit code."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EmailVerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data['code']

        token = (
            EmailVerificationToken.objects.filter(
                user=request.user, code=code, used=False
            )
            .order_by('-created_at')
            .first()
        )

        if not token or not token.is_valid:
            return Response(
                {'detail': 'Invalid or expired verification code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token.used = True
        token.save()

        profile = _get_or_create_profile(request.user)
        profile.email_verified = True
        profile.save()

        return Response(
            {'detail': 'Email verified successfully.'},
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    """Resend the email verification code."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = _get_or_create_profile(request.user)
        if profile.email_verified:
            return Response(
                {'detail': 'Email is already verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        EmailVerificationToken.objects.filter(
            user=request.user, used=False
        ).update(used=True)

        token = EmailVerificationToken.objects.create(user=request.user)
        try:
            _send_verification_email(request.user, token)
        except Exception as e:
            return Response(
                {'detail': f'Failed to send email: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {'detail': 'Verification email sent.'},
            status=status.HTTP_200_OK,
        )


# -- Password Reset ------------------------------------------------------------

class PasswordResetRequestView(APIView):
    """Request a password reset code via email."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()

        # Always return success to prevent email enumeration
        success_msg = (
            'If an account with that email exists, '
            'a reset code has been sent.'
        )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'detail': success_msg}, status=status.HTTP_200_OK
            )

        PasswordResetToken.objects.filter(
            user=user, used=False
        ).update(used=True)

        token = PasswordResetToken.objects.create(user=user)
        try:
            _send_password_reset_email(user, token)
        except Exception:
            pass  # Don't reveal whether the email exists

        return Response(
            {'detail': success_msg}, status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(APIView):
    """Confirm a password reset with code and new password."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower()
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Invalid email or code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = (
            PasswordResetToken.objects.filter(
                user=user, code=code, used=False
            )
            .order_by('-created_at')
            .first()
        )

        if not token or not token.is_valid:
            return Response(
                {'detail': 'Invalid or expired reset code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token.used = True
        token.save()

        PasswordResetToken.objects.filter(
            user=user, used=False
        ).update(used=True)

        user.set_password(new_password)
        user.save()

        return Response(
            {'detail': 'Password has been reset successfully.'},
            status=status.HTTP_200_OK,
        )
