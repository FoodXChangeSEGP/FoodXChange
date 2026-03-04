from django.contrib import admin
from .models import (
    FoodXEvent,
    CommunityGroup, GroupMembership, Topic, Comment, TopicVote, CommentVote,
    FriendRequest, Friendship, Conversation, DirectMessage,
)


@admin.register(FoodXEvent)
class FoodXEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'location_name', 'date', 'organizer', 'is_active')
    list_filter = ('category', 'is_active', 'date')
    search_fields = ('title', 'location_name', 'organizer')
    list_editable = ('is_active',)
    date_hierarchy = 'date'


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
