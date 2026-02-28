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
