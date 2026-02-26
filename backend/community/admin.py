from django.contrib import admin
from .models import CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote

admin.site.register(CommunityGroup)
admin.site.register(GroupMembership)
admin.site.register(Topic)
admin.site.register(Comment)
admin.site.register(TopicVote)
admin.site.register(CommentVote)
