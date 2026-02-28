from rest_framework import serializers
from .models import CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote, FoodXEvent


class FoodXEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodXEvent
        fields = [
            'id', 'title', 'description', 'long_description',
            'location_name', 'latitude', 'longitude',
            'date', 'event_time', 'category', 'image_url',
            'organizer', 'price', 'attendee_count', 'tags',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class GroupMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = GroupMembership
        fields = ['id', 'username', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class CommunityGroupListSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    topic_count = serializers.IntegerField(read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = CommunityGroup
        fields = [
            'id', 'name', 'description', 'category',
            'is_featured', 'is_trending',
            'member_count', 'topic_count',
            'created_by_username', 'is_member', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.memberships.filter(user=request.user).exists()
        return False


class CommunityGroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityGroup
        fields = ['id', 'name', 'description', 'category']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TopicVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicVote
        fields = ['id', 'vote_type', 'created_at']
        read_only_fields = ['id', 'created_at']


class CommentVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommentVote
        fields = ['id', 'vote_type', 'created_at']
        read_only_fields = ['id', 'created_at']


class ReplySerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    useful_count = serializers.IntegerField(read_only=True)
    not_useful_count = serializers.IntegerField(read_only=True)
    flag_count = serializers.IntegerField(read_only=True)
    my_vote = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'body', 'created_by_username', 'created_at',
            'useful_count', 'not_useful_count', 'flag_count', 'my_vote',
        ]
        read_only_fields = ['id', 'created_at']

    def get_my_vote(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            return vote.vote_type if vote else None
        return None


class CommentSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    useful_count = serializers.IntegerField(read_only=True)
    not_useful_count = serializers.IntegerField(read_only=True)
    flag_count = serializers.IntegerField(read_only=True)
    my_vote = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'body', 'created_by_username', 'created_at',
            'useful_count', 'not_useful_count', 'flag_count',
            'my_vote', 'replies',
        ]
        read_only_fields = ['id', 'created_at']

    def get_my_vote(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            return vote.vote_type if vote else None
        return None

    def get_replies(self, obj):
        qs = obj.replies.filter(is_deleted=False)
        return ReplySerializer(qs, many=True, context=self.context).data


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['id', 'body']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TopicListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    useful_count = serializers.IntegerField(read_only=True)
    not_useful_count = serializers.IntegerField(read_only=True)
    flag_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    my_vote = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            'id', 'title', 'body', 'created_by_username', 'created_at',
            'useful_count', 'not_useful_count', 'flag_count',
            'comment_count', 'my_vote',
        ]
        read_only_fields = ['id', 'created_at']

    def get_my_vote(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            return vote.vote_type if vote else None
        return None


class TopicCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'title', 'body']
        read_only_fields = ['id']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class CommunityGroupDetailSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    topic_count = serializers.IntegerField(read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_member = serializers.SerializerMethodField()
    topics = serializers.SerializerMethodField()

    class Meta:
        model = CommunityGroup
        fields = [
            'id', 'name', 'description', 'category',
            'is_featured', 'is_trending',
            'member_count', 'topic_count',
            'created_by_username', 'is_member',
            'created_at', 'topics',
        ]
        read_only_fields = ['id', 'created_at']

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.memberships.filter(user=request.user).exists()
        return False

    def get_topics(self, obj):
        qs = obj.topics.filter(is_deleted=False).select_related('created_by').prefetch_related('votes', 'comments')
        return TopicListSerializer(qs, many=True, context=self.context).data
