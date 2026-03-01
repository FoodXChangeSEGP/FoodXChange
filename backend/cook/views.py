from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, AllowAny
from django.contrib.auth.models import AnonymousUser
from django_filters.rest_framework import DjangoFilterBackend

from .models import Recipe, RecipeFavourite, CookingHack
from .serializers import (
    RecipeListSerializer,
    RecipeDetailSerializer,
    RecipeCreateSerializer,
    CookingHackSerializer,
)


class RecipeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for recipes.
    - list: all public recipes (+ own private ones if authenticated)
    - retrieve: full detail with ingredients & steps
    - create / update / delete: authenticated users, own recipes only
    - favourite / unfavourite: authenticated users
    - my_recipes: user's own collection (created + favourited)
    """
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'difficulty']
    search_fields = ['title', 'description', 'tags']
    ordering_fields = ['created_at', 'title', 'prep_time_minutes', 'cook_time_minutes']

    def get_queryset(self):
        qs = Recipe.objects.select_related('created_by').prefetch_related(
            'ingredients', 'steps', 'favourites',
        )
        user = self.request.user

        # Filtering for favourites
        if self.request.query_params.get('favourites') == 'true':
            if user and user.is_authenticated:
                return qs.filter(favourites__user=user)
            return qs.none()

        # Filtering for user's own recipes
        if self.request.query_params.get('mine') == 'true':
            if user and user.is_authenticated:
                return qs.filter(created_by=user)
            return qs.none()

        # Default: public recipes + user's own private ones
        if user and user.is_authenticated:
            from django.db.models import Q
            return qs.filter(Q(is_public=True) | Q(created_by=user))
        return qs.filter(is_public=True)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return RecipeDetailSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return RecipeCreateSerializer
        return RecipeListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # Only allow editing own recipes
        if serializer.instance.created_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only edit your own recipes.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only delete your own recipes.')
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def favourite(self, request, pk=None):
        recipe = self.get_object()
        fav, created = RecipeFavourite.objects.get_or_create(user=request.user, recipe=recipe)
        if created:
            return Response(
                {'favourited': True, 'favourite_count': recipe.favourite_count},
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {'favourited': False, 'detail': 'Already favourited.'},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unfavourite(self, request, pk=None):
        recipe = self.get_object()
        deleted, _ = RecipeFavourite.objects.filter(user=request.user, recipe=recipe).delete()
        if deleted:
            return Response({'unfavourited': True, 'favourite_count': recipe.favourite_count})
        return Response(
            {'unfavourited': False, 'detail': 'Was not favourited.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_recipes(self, request):
        """Return the authenticated user's created recipes."""
        qs = self.get_queryset().filter(created_by=request.user)
        serializer = RecipeListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_favourites(self, request):
        """Return the authenticated user's favourited recipes."""
        qs = self.get_queryset().filter(favourites__user=request.user)
        serializer = RecipeListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class CookingHackViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for cooking hacks, filterable by category."""
    serializer_class = CookingHackSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'description', 'tags']

    def get_queryset(self):
        return CookingHack.objects.filter(is_active=True)
