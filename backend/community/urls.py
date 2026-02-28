from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import CommunityGroupViewSet, TopicViewSet, CommentViewSet, FoodXEventViewSet

router = DefaultRouter()
router.register('groups', CommunityGroupViewSet, basename='community-group')
router.register('topics', TopicViewSet, basename='community-topic')
router.register('comments', CommentViewSet, basename='community-comment')
router.register('events', FoodXEventViewSet, basename='community-event')

urlpatterns = [
    path('', include(router.urls)),
]
