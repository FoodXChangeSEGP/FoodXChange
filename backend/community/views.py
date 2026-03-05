from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated, AllowAny
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import (
    CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote,
    FoodXEvent, FriendRequest, Friendship, Conversation, DirectMessage,
)
from .serializers import (
    CommunityGroupListSerializer,
    CommunityGroupDetailSerializer,
    CommunityGroupCreateSerializer,
    TopicListSerializer,
    TopicCreateSerializer,
    CommentSerializer,
    CommentCreateSerializer,
    FoodXEventSerializer,
    FoodXEventCreateSerializer,
    UserSearchSerializer,
    FriendRequestSerializer,
    FriendSerializer,
    DirectMessageSerializer,
    ConversationSerializer,
)

User = get_user_model()


class FoodXEventViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return FoodXEvent.objects.filter(is_active=True).prefetch_related('linked_groups').order_by('date')

    def get_serializer_class(self):
        if self.action == 'create':
            return FoodXEventCreateSerializer
        return FoodXEventSerializer


class CommunityGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = CommunityGroup.objects.prefetch_related('memberships', 'topics')
        filter_type = self.request.query_params.get('filter')
        if filter_type == 'featured':
            return qs.filter(is_featured=True)
        if filter_type == 'trending':
            return qs.filter(is_trending=True)
        if filter_type == 'mine':
            user = self.request.user
            if not user or isinstance(user, AnonymousUser):
                return qs.none()
            return qs.filter(memberships__user=user)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CommunityGroupDetailSerializer
        if self.action == 'create':
            return CommunityGroupCreateSerializer
        return CommunityGroupListSerializer

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        group = self.get_object()
        membership, created = GroupMembership.objects.get_or_create(
            user=request.user,
            group=group,
        )
        if created:
            return Response({'joined': True, 'member_count': group.member_count}, status=status.HTTP_201_CREATED)
        return Response({'joined': False, 'detail': 'Already a member.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def leave(self, request, pk=None):
        group = self.get_object()
        deleted, _ = GroupMembership.objects.filter(user=request.user, group=group).delete()
        if deleted:
            return Response({'left': True, 'member_count': group.member_count})
        return Response({'left': False, 'detail': 'Not a member.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def topics(self, request, pk=None):
        group = self.get_object()

        if request.method == 'POST':
            if not request.user or isinstance(request.user, AnonymousUser):
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            serializer = TopicCreateSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(group=group)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = group.topics.filter(is_deleted=False).select_related('created_by').prefetch_related('votes', 'comments')
        serializer = TopicListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class TopicViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Topic.objects.filter(is_deleted=False).select_related('created_by', 'group').prefetch_related(
            'votes', 'comments__votes', 'comments__replies__votes',
        )

    def retrieve(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        topic = get_object_or_404(Topic, pk=pk, is_deleted=False)
        serializer = TopicListSerializer(topic, context={'request': request})
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        topic = get_object_or_404(Topic, pk=pk, is_deleted=False)
        if topic.created_by != request.user:
            return Response({'detail': 'You can only delete your own topics.'}, status=status.HTTP_403_FORBIDDEN)
        topic.is_deleted = True
        topic.save(update_fields=['is_deleted'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        topic = get_object_or_404(Topic, pk=pk, is_deleted=False)
        vote_type = request.data.get('vote_type')
        if vote_type not in ('useful', 'not_useful', 'flag'):
            return Response({'detail': 'Invalid vote_type.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = TopicVote.objects.filter(user=request.user, topic=topic).first()
        if existing:
            if existing.vote_type == vote_type:
                existing.delete()
                return Response({'removed': True, 'vote_type': vote_type,
                                 'useful_count': topic.useful_count,
                                 'not_useful_count': topic.not_useful_count,
                                 'flag_count': topic.flag_count})
            existing.vote_type = vote_type
            existing.save(update_fields=['vote_type'])
        else:
            TopicVote.objects.create(user=request.user, topic=topic, vote_type=vote_type)

        topic.refresh_from_db()
        return Response({
            'vote_type': vote_type,
            'useful_count': topic.useful_count,
            'not_useful_count': topic.not_useful_count,
            'flag_count': topic.flag_count,
        })

    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        topic = get_object_or_404(Topic, pk=pk, is_deleted=False)

        if request.method == 'POST':
            if not request.user or isinstance(request.user, AnonymousUser):
                return Response({'detail': 'Authentication required.'}, status=status.HTTP_401_UNAUTHORIZED)
            serializer = CommentCreateSerializer(data=request.data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(topic=topic)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = topic.comments.filter(is_deleted=False, parent__isnull=True).select_related('created_by').prefetch_related(
            'votes', 'replies__votes', 'replies__created_by',
        )
        ordering = request.query_params.get('ordering', 'newest')
        if ordering == 'most_liked':
            from django.db.models import Count, Q
            qs = qs.annotate(
                useful_vote_count=Count('votes', filter=Q(votes__vote_type='useful'))
            ).order_by('-useful_vote_count', '-created_at')
        else:
            qs = qs.order_by('-created_at')
        serializer = CommentSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class CommentViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        comment = get_object_or_404(Comment, pk=pk, is_deleted=False)
        vote_type = request.data.get('vote_type')
        if vote_type not in ('useful', 'not_useful', 'flag'):
            return Response({'detail': 'Invalid vote_type.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = CommentVote.objects.filter(user=request.user, comment=comment).first()
        if existing:
            if existing.vote_type == vote_type:
                existing.delete()
                return Response({'removed': True, 'vote_type': vote_type,
                                 'useful_count': comment.useful_count,
                                 'not_useful_count': comment.not_useful_count,
                                 'flag_count': comment.flag_count})
            existing.vote_type = vote_type
            existing.save(update_fields=['vote_type'])
        else:
            CommentVote.objects.create(user=request.user, comment=comment, vote_type=vote_type)

        comment.refresh_from_db()
        return Response({
            'vote_type': vote_type,
            'useful_count': comment.useful_count,
            'not_useful_count': comment.not_useful_count,
            'flag_count': comment.flag_count,
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reply(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        comment = get_object_or_404(Comment, pk=pk, is_deleted=False)
        serializer = CommentCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(topic=comment.topic, parent=comment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ── Messaging Views ──────────────────────────────────────────────


class UserSearchViewSet(viewsets.ViewSet):
    """Search users by username for friend requests."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        users = User.objects.filter(
            username__icontains=q,
        ).exclude(id=request.user.id)[:20]
        serializer = UserSearchSerializer(users, many=True)
        return Response(serializer.data)


class FriendRequestViewSet(viewsets.ViewSet):
    """Send, list, accept, reject friend requests."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List incoming pending friend requests for the current user."""
        qs = FriendRequest.objects.filter(
            to_user=request.user, status='pending',
        ).select_related('from_user', 'to_user')
        serializer = FriendRequestSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def sent(self, request):
        """List outgoing pending friend requests."""
        qs = FriendRequest.objects.filter(
            from_user=request.user, status='pending',
        ).select_related('from_user', 'to_user')
        serializer = FriendRequestSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request):
        """Send a friend request to a user by their user id."""
        to_user_id = request.data.get('to_user')
        if not to_user_id:
            return Response({'detail': 'to_user is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            to_user = User.objects.get(id=to_user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if to_user == request.user:
            return Response({'detail': 'Cannot send friend request to yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        if Friendship.are_friends(request.user, to_user):
            return Response({'detail': 'Already friends.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for existing pending request in either direction
        existing = FriendRequest.objects.filter(
            Q(from_user=request.user, to_user=to_user) |
            Q(from_user=to_user, to_user=request.user),
            status='pending',
        ).first()
        if existing:
            return Response({'detail': 'Friend request already pending.'}, status=status.HTTP_400_BAD_REQUEST)

        fr = FriendRequest.objects.create(from_user=request.user, to_user=to_user)
        serializer = FriendRequestSerializer(fr)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        try:
            fr = FriendRequest.objects.get(pk=pk, to_user=request.user, status='pending')
        except FriendRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        fr.status = 'accepted'
        fr.save(update_fields=['status'])

        # Create symmetric friendship
        u1, u2 = sorted([fr.from_user, fr.to_user], key=lambda u: u.id)
        Friendship.objects.get_or_create(user1=u1, user2=u2)

        return Response({'accepted': True})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            fr = FriendRequest.objects.get(pk=pk, to_user=request.user, status='pending')
        except FriendRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        fr.status = 'rejected'
        fr.save(update_fields=['status'])
        return Response({'rejected': True})


class FriendViewSet(viewsets.ViewSet):
    """List friends, remove friend."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        friends = Friendship.get_friends(request.user)
        serializer = FriendSerializer(friends, many=True)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        """Remove a friend by user id."""
        try:
            other = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        u1, u2 = sorted([request.user, other], key=lambda u: u.id)
        deleted, _ = Friendship.objects.filter(user1=u1, user2=u2).delete()
        if deleted:
            return Response({'removed': True})
        return Response({'detail': 'Not friends.'}, status=status.HTTP_400_BAD_REQUEST)


class ConversationViewSet(viewsets.ViewSet):
    """List conversations, get/create a conversation, list & send messages."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List all conversations for the current user."""
        qs = Conversation.objects.filter(
            Q(participant1=request.user) | Q(participant2=request.user),
        ).select_related('participant1', 'participant2').prefetch_related('messages')
        serializer = ConversationSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Get a specific conversation."""
        try:
            conv = Conversation.objects.select_related(
                'participant1', 'participant2',
            ).get(
                pk=pk,
            )
        except Conversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user not in (conv.participant1, conv.participant2):
            return Response({'detail': 'Not your conversation.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ConversationSerializer(conv, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def start(self, request):
        """Start or get existing conversation with another user (by user id)."""
        other_id = request.data.get('user_id')
        if not other_id:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            other = User.objects.get(id=other_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if other == request.user:
            return Response({'detail': 'Cannot message yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        if not Friendship.are_friends(request.user, other):
            return Response({'detail': 'You must be friends to start a conversation.'}, status=status.HTTP_403_FORBIDDEN)

        conv = Conversation.get_or_create_conversation(request.user, other)
        serializer = ConversationSerializer(conv, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """List all messages in a conversation."""
        try:
            conv = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user not in (conv.participant1, conv.participant2):
            return Response({'detail': 'Not your conversation.'}, status=status.HTTP_403_FORBIDDEN)

        # Mark unread messages as read
        conv.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        qs = conv.messages.select_related('sender').order_by('created_at')
        serializer = DirectMessageSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Send a message in a conversation."""
        try:
            conv = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user not in (conv.participant1, conv.participant2):
            return Response({'detail': 'Not your conversation.'}, status=status.HTTP_403_FORBIDDEN)

        text = request.data.get('text', '').strip()
        shared_list_data = request.data.get('shared_list_data') or None

        if not text and not shared_list_data:
            return Response({'detail': 'text or shared_list_data is required.'}, status=status.HTTP_400_BAD_REQUEST)

        msg = DirectMessage.objects.create(
            conversation=conv,
            sender=request.user,
            text=text,
            shared_list_data=shared_list_data,
        )
        # Update conversation timestamp
        conv.save(update_fields=['updated_at'])

        serializer = DirectMessageSerializer(msg)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='shared-lists')
    def shared_lists(self, request):
        """Return all shared-list messages in conversations the user participates in."""
        user_convs = Conversation.objects.filter(
            Q(participant1=request.user) | Q(participant2=request.user)
        )
        msgs = (
            DirectMessage.objects
            .filter(conversation__in=user_convs, shared_list_data__isnull=False)
            .select_related('sender', 'conversation__participant1', 'conversation__participant2')
            .order_by('-created_at')
        )
        serializer = DirectMessageSerializer(msgs, many=True)
        return Response(serializer.data)
