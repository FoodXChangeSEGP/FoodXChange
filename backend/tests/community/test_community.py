from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from community.models import (
    CommunityGroup, GroupMembership, Topic, Comment,
    TopicVote, CommentVote, FoodXEvent,
    FriendRequest, Friendship, Conversation, DirectMessage,
)


# ── Model Tests ───────────────────────────────────────────────────

class FoodXEventModelTest(TestCase):
    def test_create_event(self):
        event = FoodXEvent.objects.create(
            title='Food Market',
            description='Local food market',
            location_name='Town Square',
            latitude=51.5,
            longitude=-0.1,
            date='2026-06-01',
            category='market',
        )
        self.assertEqual(str(event), 'Food Market')
        self.assertTrue(event.is_active)
        self.assertEqual(event.price, 'Free')


class CommunityGroupModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')

    def test_create_group(self):
        group = CommunityGroup.objects.create(
            name='Budget Shoppers',
            description='Tips for saving money',
            created_by=self.user,
        )
        self.assertEqual(str(group), 'Budget Shoppers')
        self.assertEqual(group.member_count, 0)
        self.assertEqual(group.topic_count, 0)

    def test_member_count(self):
        group = CommunityGroup.objects.create(
            name='Test Group', description='desc', created_by=self.user,
        )
        GroupMembership.objects.create(user=self.user, group=group)
        self.assertEqual(group.member_count, 1)

    def test_topic_count_excludes_deleted(self):
        group = CommunityGroup.objects.create(
            name='Test Group', description='desc', created_by=self.user,
        )
        Topic.objects.create(group=group, title='Active', body='body', created_by=self.user)
        Topic.objects.create(group=group, title='Deleted', body='body', created_by=self.user, is_deleted=True)
        self.assertEqual(group.topic_count, 1)


class TopicModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')
        self.group = CommunityGroup.objects.create(
            name='Group', description='desc', created_by=self.user,
        )
        self.topic = Topic.objects.create(
            group=self.group, title='Topic', body='body', created_by=self.user,
        )

    def test_vote_counts(self):
        bob = User.objects.create_user(username='bob', password='Pass123!')
        TopicVote.objects.create(user=self.user, topic=self.topic, vote_type='useful')
        TopicVote.objects.create(user=bob, topic=self.topic, vote_type='not_useful')
        self.assertEqual(self.topic.useful_count, 1)
        self.assertEqual(self.topic.not_useful_count, 1)
        self.assertEqual(self.topic.flag_count, 0)

    def test_comment_count_excludes_deleted(self):
        Comment.objects.create(topic=self.topic, body='active', created_by=self.user)
        Comment.objects.create(topic=self.topic, body='deleted', created_by=self.user, is_deleted=True)
        self.assertEqual(self.topic.comment_count, 1)

    def test_comment_count_excludes_replies(self):
        parent = Comment.objects.create(topic=self.topic, body='parent', created_by=self.user)
        Comment.objects.create(topic=self.topic, body='reply', created_by=self.user, parent=parent)
        self.assertEqual(self.topic.comment_count, 1)


class CommentModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='Pass123!')
        group = CommunityGroup.objects.create(name='G', description='d', created_by=self.user)
        topic = Topic.objects.create(group=group, title='T', body='b', created_by=self.user)
        self.comment = Comment.objects.create(topic=topic, body='comment', created_by=self.user)

    def test_comment_vote_counts(self):
        bob = User.objects.create_user(username='bob', password='Pass123!')
        CommentVote.objects.create(user=self.user, comment=self.comment, vote_type='useful')
        CommentVote.objects.create(user=bob, comment=self.comment, vote_type='flag')
        self.assertEqual(self.comment.useful_count, 1)
        self.assertEqual(self.comment.flag_count, 1)
        self.assertEqual(self.comment.not_useful_count, 0)


# ── API Tests ─────────────────────────────────────────────────────

class FoodXEventAPITest(APITestCase):
    def setUp(self):
        FoodXEvent.objects.create(
            title='Active Event', description='desc', location_name='Park',
            latitude=51.5, longitude=-0.1, date='2026-06-01', is_active=True,
        )
        FoodXEvent.objects.create(
            title='Inactive Event', description='desc', location_name='Hall',
            latitude=51.5, longitude=-0.1, date='2026-07-01', is_active=False,
        )

    def test_list_events_only_active(self):
        response = self.client.get('/api/community/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        titles = [e['title'] for e in results]
        self.assertIn('Active Event', titles)
        self.assertNotIn('Inactive Event', titles)

    def test_retrieve_event(self):
        event = FoodXEvent.objects.filter(is_active=True).first()
        response = self.client.get(f'/api/community/events/{event.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Active Event')


class CommunityGroupAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        self.client.force_authenticate(user=self.alice)
        self.group = CommunityGroup.objects.create(
            name='Budget Tips', description='Save money', created_by=self.alice,
        )

    def test_list_groups_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/community/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_group(self):
        response = self.client.post('/api/community/groups/', {
            'name': 'New Group',
            'description': 'A new group',
            'category': 'food',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'New Group')

    def test_filter_featured(self):
        CommunityGroup.objects.create(
            name='Featured', description='desc', created_by=self.alice, is_featured=True,
        )
        response = self.client.get('/api/community/groups/?filter=featured')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertTrue(all(g['is_featured'] for g in results))

    def test_filter_trending(self):
        CommunityGroup.objects.create(
            name='Trending', description='desc', created_by=self.alice, is_trending=True,
        )
        response = self.client.get('/api/community/groups/?filter=trending')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        names = [g['name'] for g in results]
        self.assertIn('Trending', names)
        self.assertNotIn('Budget Tips', names)

    def test_filter_mine(self):
        GroupMembership.objects.create(user=self.alice, group=self.group)
        response = self.client.get('/api/community/groups/?filter=mine')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)

    def test_join_group(self):
        response = self.client.post(f'/api/community/groups/{self.group.id}/join/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['joined'])
        self.assertTrue(GroupMembership.objects.filter(user=self.alice, group=self.group).exists())

    def test_join_group_already_member(self):
        GroupMembership.objects.create(user=self.alice, group=self.group)
        response = self.client.post(f'/api/community/groups/{self.group.id}/join/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['joined'])

    def test_leave_group(self):
        GroupMembership.objects.create(user=self.alice, group=self.group)
        response = self.client.post(f'/api/community/groups/{self.group.id}/leave/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['left'])

    def test_leave_group_not_member(self):
        response = self.client.post(f'/api/community/groups/{self.group.id}/leave/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_topic_in_group(self):
        response = self.client.post(
            f'/api/community/groups/{self.group.id}/topics/',
            {'title': 'My Topic', 'body': 'Topic body text'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'My Topic')

    def test_list_topics_excludes_deleted(self):
        Topic.objects.create(group=self.group, title='Visible', body='body', created_by=self.alice)
        Topic.objects.create(group=self.group, title='Hidden', body='body', created_by=self.alice, is_deleted=True)
        response = self.client.get(f'/api/community/groups/{self.group.id}/topics/')
        titles = [t['title'] for t in response.data]
        self.assertIn('Visible', titles)
        self.assertNotIn('Hidden', titles)

    def test_create_group_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/community/groups/', {
            'name': 'Anon Group', 'description': 'desc',
        })
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class TopicVoteAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        self.client.force_authenticate(user=self.alice)
        group = CommunityGroup.objects.create(name='G', description='d', created_by=self.alice)
        self.topic = Topic.objects.create(group=group, title='T', body='b', created_by=self.bob)

    def test_vote_useful(self):
        response = self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'useful'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['useful_count'], 1)

    def test_vote_toggle_removes(self):
        self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'useful'})
        response = self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'useful'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['removed'])
        self.assertEqual(response.data['useful_count'], 0)

    def test_vote_change(self):
        self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'useful'})
        response = self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'not_useful'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['useful_count'], 0)
        self.assertEqual(response.data['not_useful_count'], 1)

    def test_invalid_vote_type(self):
        response = self.client.post(f'/api/community/topics/{self.topic.id}/vote/', {'vote_type': 'bad'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TopicSoftDeleteAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        group = CommunityGroup.objects.create(name='G', description='d', created_by=self.alice)
        self.topic = Topic.objects.create(group=group, title='T', body='b', created_by=self.alice)

    def test_creator_can_delete(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.delete(f'/api/community/topics/{self.topic.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.topic.refresh_from_db()
        self.assertTrue(self.topic.is_deleted)

    def test_non_creator_cannot_delete(self):
        self.client.force_authenticate(user=self.bob)
        response = self.client.delete(f'/api/community/topics/{self.topic.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CommentAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.client.force_authenticate(user=self.alice)
        group = CommunityGroup.objects.create(name='G', description='d', created_by=self.alice)
        self.topic = Topic.objects.create(group=group, title='T', body='b', created_by=self.alice)

    def test_create_comment(self):
        response = self.client.post(
            f'/api/community/topics/{self.topic.id}/comments/',
            {'body': 'Great topic!'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_reply(self):
        comment = Comment.objects.create(topic=self.topic, body='parent', created_by=self.alice)
        response = self.client.post(
            f'/api/community/comments/{comment.id}/reply/',
            {'body': 'A reply'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_comment_vote(self):
        comment = Comment.objects.create(topic=self.topic, body='comment', created_by=self.alice)
        response = self.client.post(
            f'/api/community/comments/{comment.id}/vote/',
            {'vote_type': 'useful'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['useful_count'], 1)

    def test_comment_vote_toggle(self):
        comment = Comment.objects.create(topic=self.topic, body='comment', created_by=self.alice)
        self.client.post(f'/api/community/comments/{comment.id}/vote/', {'vote_type': 'useful'})
        response = self.client.post(f'/api/community/comments/{comment.id}/vote/', {'vote_type': 'useful'})
        self.assertTrue(response.data['removed'])

    def test_list_comments_newest_first(self):
        Comment.objects.create(topic=self.topic, body='first', created_by=self.alice)
        Comment.objects.create(topic=self.topic, body='second', created_by=self.alice)
        response = self.client.get(f'/api/community/topics/{self.topic.id}/comments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_unauthenticated_cannot_comment(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/community/topics/{self.topic.id}/comments/',
            {'body': 'Anon comment'},
        )
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class UserSearchAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        User.objects.create_user(username='bob', password='Pass123!')
        User.objects.create_user(username='bobby', password='Pass123!')
        self.client.force_authenticate(user=self.alice)

    def test_search_finds_users(self):
        response = self.client.get('/api/community/users/search/?q=bob')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [u['username'] for u in response.data]
        self.assertIn('bob', usernames)
        self.assertIn('bobby', usernames)

    def test_search_excludes_self(self):
        response = self.client.get('/api/community/users/search/?q=alic')
        usernames = [u['username'] for u in response.data]
        self.assertNotIn('alice', usernames)

    def test_short_query_returns_empty(self):
        response = self.client.get('/api/community/users/search/?q=b')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_unauthenticated_cannot_search(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/community/users/search/?q=bob')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class FriendRequestAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        self.charlie = User.objects.create_user(username='charlie', password='Pass123!')
        self.client.force_authenticate(user=self.alice)

    def test_send_friend_request(self):
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FriendRequest.objects.count(), 1)

    def test_cannot_send_to_self(self):
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.alice.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_send_duplicate(self):
        self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_send_if_already_friends(self):
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_incoming_requests(self):
        FriendRequest.objects.create(from_user=self.bob, to_user=self.alice)
        response = self.client.get('/api/community/friend-requests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_sent_requests(self):
        FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        response = self.client.get('/api/community/friend-requests/sent/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_accept_creates_friendship(self):
        fr = FriendRequest.objects.create(from_user=self.bob, to_user=self.alice)
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['accepted'])
        self.assertTrue(Friendship.are_friends(self.alice, self.bob))
        fr.refresh_from_db()
        self.assertEqual(fr.status, 'accepted')

    def test_reject_friend_request(self):
        fr = FriendRequest.objects.create(from_user=self.bob, to_user=self.alice)
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/reject/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['rejected'])
        fr.refresh_from_db()
        self.assertEqual(fr.status, 'rejected')

    def test_cannot_accept_others_request(self):
        fr = FriendRequest.objects.create(from_user=self.alice, to_user=self.charlie)
        self.client.force_authenticate(user=self.bob)
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FriendViewAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        self.client.force_authenticate(user=self.alice)
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)

    def test_list_friends(self):
        response = self.client.get('/api/community/friends/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [f['username'] for f in response.data]
        self.assertIn('bob', usernames)

    def test_remove_friend(self):
        response = self.client.delete(f'/api/community/friends/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['removed'])
        self.assertFalse(Friendship.are_friends(self.alice, self.bob))

    def test_remove_non_friend(self):
        charlie = User.objects.create_user(username='charlie', password='Pass123!')
        response = self.client.delete(f'/api/community/friends/{charlie.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ConversationAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='Pass123!')
        self.bob = User.objects.create_user(username='bob', password='Pass123!')
        self.client.force_authenticate(user=self.alice)
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)

    def test_start_conversation_requires_friendship(self):
        charlie = User.objects.create_user(username='charlie', password='Pass123!')
        response = self.client.post('/api/community/conversations/start/', {'user_id': charlie.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_start_conversation_with_friend(self):
        response = self.client.post('/api/community/conversations/start/', {'user_id': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('id', response.data)

    def test_start_conversation_idempotent(self):
        r1 = self.client.post('/api/community/conversations/start/', {'user_id': self.bob.id})
        r2 = self.client.post('/api/community/conversations/start/', {'user_id': self.bob.id})
        self.assertEqual(r1.data['id'], r2.data['id'])

    def test_cannot_message_self(self):
        response = self.client.post('/api/community/conversations/start/', {'user_id': self.alice.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_message(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        response = self.client.post(f'/api/community/conversations/{conv.id}/send/', {'text': 'Hello!'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['text'], 'Hello!')

    def test_send_empty_message_rejected(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        response = self.client.post(f'/api/community/conversations/{conv.id}/send/', {'text': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_messages_marks_as_read(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        DirectMessage.objects.create(conversation=conv, sender=self.bob, text='Hi', is_read=False)
        self.client.get(f'/api/community/conversations/{conv.id}/messages/')
        self.assertTrue(DirectMessage.objects.filter(conversation=conv, is_read=True).exists())

    def test_list_conversations(self):
        Conversation.get_or_create_conversation(self.alice, self.bob)
        response = self.client.get('/api/community/conversations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_cannot_access_others_conversation(self):
        charlie = User.objects.create_user(username='charlie', password='Pass123!')
        dave = User.objects.create_user(username='dave', password='Pass123!')
        u1, u2 = sorted([charlie, dave], key=lambda u: u.id)
        conv = Conversation.objects.create(participant1=u1, participant2=u2)
        response = self.client.get(f'/api/community/conversations/{conv.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
