from django.contrib import admin
from .models import (
    CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote,
    FriendRequest, Friendship, Conversation, DirectMessage,
)

admin.site.register(CommunityGroup)
admin.site.register(GroupMembership)
admin.site.register(Topic)
admin.site.register(Comment)
admin.site.register(TopicVote)
admin.site.register(CommentVote)
admin.site.register(FriendRequest)
admin.site.register(Friendship)
admin.site.register(Conversation)
admin.site.register(DirectMessage)
