from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import (
    CommunityGroupViewSet, TopicViewSet, CommentViewSet, FoodXEventViewSet,
    UserSearchViewSet, FriendRequestViewSet, FriendViewSet, ConversationViewSet,
)

router = DefaultRouter()
router.register('groups', CommunityGroupViewSet, basename='community-group')
router.register('topics', TopicViewSet, basename='community-topic')
router.register('comments', CommentViewSet, basename='community-comment')
router.register('events', FoodXEventViewSet, basename='community-event')
router.register('users/search', UserSearchViewSet, basename='user-search')
router.register('friend-requests', FriendRequestViewSet, basename='friend-request')
router.register('friends', FriendViewSet, basename='friend')
router.register('conversations', ConversationViewSet, basename='conversation')

urlpatterns = [
    path('', include(router.urls)),
]
