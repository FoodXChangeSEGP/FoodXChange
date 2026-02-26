from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from django.contrib.auth.models import AnonymousUser

from .models import CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote
from .serializers import (
    CommunityGroupListSerializer,
    CommunityGroupDetailSerializer,
    CommunityGroupCreateSerializer,
    TopicListSerializer,
    TopicCreateSerializer,
    CommentSerializer,
    CommentCreateSerializer,
)


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
