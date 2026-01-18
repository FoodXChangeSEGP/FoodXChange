"""
ASGI config for foodxchange project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'foodxchange.settings')

application = get_asgi_application()
