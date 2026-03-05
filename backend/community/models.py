from django.db import models
from django.conf import settings


class FoodXEvent(models.Model):
    CATEGORY_CHOICES = [
        ('market', 'Food Market'),
        ('swap', 'Food Swap'),
        ('workshop', 'Workshop'),
        ('tasting', 'Tasting'),
        ('festival', 'Food Festival'),
        ('community', 'Community Meal'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    long_description = models.TextField(blank=True)
    location_name = models.CharField(max_length=200)
    latitude = models.FloatField()
    longitude = models.FloatField()
    date = models.DateField()
    event_time = models.CharField(max_length=50, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    image_url = models.URLField(max_length=500, blank=True)
    organizer = models.CharField(max_length=200, blank=True)
    price = models.CharField(max_length=100, default='Free')
    attendee_count = models.PositiveIntegerField(default=0)
    tags = models.JSONField(default=list, blank=True)
    linked_groups = models.ManyToManyField(
        'CommunityGroup', blank=True, related_name='linked_events',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return self.title

VOTE_CHOICES = [
    ('useful', 'Useful'),
    ('not_useful', 'Not Useful'),
    ('flag', 'Flag'),
]


class CommunityGroup(models.Model):
    CATEGORY_CHOICES = [
        ('food', 'Food & Nutrition'),
        ('budget', 'Budget & Savings'),
        ('local', 'Local Community'),
        ('health', 'Health & Wellness'),
        ('recipes', 'Recipes & Cooking'),
        ('general', 'General'),
    ]

    name = models.CharField(max_length=150)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='general')
    is_featured = models.BooleanField(default=False)
    is_trending = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_groups',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def member_count(self):
        return self.memberships.count()

    @property
    def topic_count(self):
        return self.topics.filter(is_deleted=False).count()


class GroupMembership(models.Model):
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('admin', 'Admin'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_memberships',
    )
    group = models.ForeignKey(
        CommunityGroup,
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'group')
        ordering = ['-joined_at']

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class Topic(models.Model):
    group = models.ForeignKey(
        CommunityGroup,
        on_delete=models.CASCADE,
        related_name='topics',
    )
    title = models.CharField(max_length=200)
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='topics',
    )
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def useful_count(self):
        return self.votes.filter(vote_type='useful').count()

    @property
    def not_useful_count(self):
        return self.votes.filter(vote_type='not_useful').count()

    @property
    def flag_count(self):
        return self.votes.filter(vote_type='flag').count()

    @property
    def comment_count(self):
        return self.comments.filter(is_deleted=False, parent__isnull=True).count()


class Comment(models.Model):
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
    )
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='community_comments',
    )
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.created_by} on {self.topic}"

    @property
    def useful_count(self):
        return self.votes.filter(vote_type='useful').count()

    @property
    def not_useful_count(self):
        return self.votes.filter(vote_type='not_useful').count()

    @property
    def flag_count(self):
        return self.votes.filter(vote_type='flag').count()


class TopicVote(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='topic_votes',
    )
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name='votes',
    )
    vote_type = models.CharField(max_length=20, choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'topic')

    def __str__(self):
        return f"{self.user.username} voted {self.vote_type} on topic {self.topic_id}"


class CommentVote(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comment_votes',
    )
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name='votes',
    )
    vote_type = models.CharField(max_length=20, choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'comment')

    def __str__(self):
        return f"{self.user.username} voted {self.vote_type} on comment {self.comment_id}"


# ── Direct Messaging Models ──────────────────────────────────────

class FriendRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_friend_requests',
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_friend_requests',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('from_user', 'to_user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.from_user.username} -> {self.to_user.username} ({self.status})"


class Friendship(models.Model):
    """Symmetric friendship — always stored with user1.id < user2.id."""
    user1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendships_as_user1',
    )
    user2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendships_as_user2',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user1', 'user2')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user1.username} <-> {self.user2.username}"

    @staticmethod
    def are_friends(user_a, user_b):
        u1, u2 = sorted([user_a, user_b], key=lambda u: u.id)
        return Friendship.objects.filter(user1=u1, user2=u2).exists()

    @staticmethod
    def get_friends(user):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        friend_ids_1 = Friendship.objects.filter(user1=user).values_list('user2_id', flat=True)
        friend_ids_2 = Friendship.objects.filter(user2=user).values_list('user1_id', flat=True)
        return User.objects.filter(id__in=list(friend_ids_1) + list(friend_ids_2))


class Conversation(models.Model):
    """A conversation between two users."""
    participant1 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_p1',
    )
    participant2 = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_p2',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('participant1', 'participant2')
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation: {self.participant1.username} & {self.participant2.username}"

    @staticmethod
    def get_or_create_conversation(user_a, user_b):
        u1, u2 = sorted([user_a, user_b], key=lambda u: u.id)
        conv, created = Conversation.objects.get_or_create(
            participant1=u1,
            participant2=u2,
        )
        return conv

    def other_participant(self, user):
        return self.participant2 if self.participant1 == user else self.participant1


class DirectMessage(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    text = models.TextField(blank=True)
    # Snapshot of a shared shopping list: { name, items: [{name, quantity}], item_count, list_id }
    shared_list_data = models.JSONField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.text[:50]}"
