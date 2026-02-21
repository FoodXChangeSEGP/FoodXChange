from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User


class EmailBackend(ModelBackend):
    """
    Authenticate using email address instead of username.
    Falls back to username if the input doesn't match any email.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = User.objects.get(email__iexact=username)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            # Fall back to standard username auth
            return super().authenticate(request, username=username, password=password, **kwargs)

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
