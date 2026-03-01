from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from community.models import FriendRequest, Friendship, Conversation, DirectMessage


class FriendRequestModelTest(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')

    def test_create_friend_request(self):
        fr = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.assertEqual(fr.status, 'pending')
        self.assertEqual(str(fr), 'alice -> bob (pending)')

    def test_unique_constraint(self):
        FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        with self.assertRaises(Exception):
            FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)


class FriendshipModelTest(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')
        self.charlie = User.objects.create_user(username='charlie', password='TestPass123!')

    def test_are_friends(self):
        self.assertFalse(Friendship.are_friends(self.alice, self.bob))
        Friendship.objects.create(user1=self.alice, user2=self.bob)
        self.assertTrue(Friendship.are_friends(self.alice, self.bob))
        self.assertTrue(Friendship.are_friends(self.bob, self.alice))

    def test_get_friends(self):
        Friendship.objects.create(user1=self.alice, user2=self.bob)
        friends = Friendship.get_friends(self.alice)
        self.assertEqual(list(friends), [self.bob])
        friends = Friendship.get_friends(self.bob)
        self.assertEqual(list(friends), [self.alice])

    def test_get_friends_multiple(self):
        Friendship.objects.create(user1=self.alice, user2=self.bob)
        Friendship.objects.create(user1=self.alice, user2=self.charlie)
        friends = Friendship.get_friends(self.alice)
        self.assertEqual(set(friends), {self.bob, self.charlie})


class ConversationModelTest(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')

    def test_get_or_create_conversation(self):
        conv1 = Conversation.get_or_create_conversation(self.alice, self.bob)
        conv2 = Conversation.get_or_create_conversation(self.bob, self.alice)
        self.assertEqual(conv1.id, conv2.id)  # Same conversation regardless of order

    def test_other_participant(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        self.assertEqual(conv.other_participant(self.alice), self.bob)
        self.assertEqual(conv.other_participant(self.bob), self.alice)


class DirectMessageModelTest(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')
        self.conv = Conversation.get_or_create_conversation(self.alice, self.bob)

    def test_create_message(self):
        msg = DirectMessage.objects.create(conversation=self.conv, sender=self.alice, text='Hello!')
        self.assertEqual(msg.text, 'Hello!')
        self.assertFalse(msg.is_read)
        self.assertIn('alice', str(msg))


# ── API Tests ─────────────────────────────────────────────────────────────────


class BaseMessagingAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')
        self.charlie = User.objects.create_user(username='charlie', password='TestPass123!')

    def auth(self, user):
        self.client.force_authenticate(user=user)


class UserSearchAPITest(BaseMessagingAPITest):
    def test_search_requires_auth(self):
        response = self.client.get('/api/community/users/search/', {'q': 'alice'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_search_by_username(self):
        self.auth(self.bob)
        response = self.client.get('/api/community/users/search/', {'q': 'ali'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [u['username'] for u in response.data]
        self.assertIn('alice', usernames)
        self.assertNotIn('bob', usernames)  # Excludes self

    def test_search_too_short(self):
        self.auth(self.bob)
        response = self.client.get('/api/community/users/search/', {'q': 'a'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


class FriendRequestAPITest(BaseMessagingAPITest):
    def test_send_friend_request(self):
        self.auth(self.alice)
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['from_username'], 'alice')
        self.assertEqual(response.data['to_username'], 'bob')
        self.assertEqual(response.data['status'], 'pending')

    def test_cannot_send_to_self(self):
        self.auth(self.alice)
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.alice.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_request(self):
        self.auth(self.alice)
        self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_incoming_requests(self):
        FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.auth(self.bob)
        response = self.client.get('/api/community/friend-requests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['from_username'], 'alice')

    def test_list_sent_requests(self):
        FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.auth(self.alice)
        response = self.client.get('/api/community/friend-requests/sent/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['to_username'], 'bob')

    def test_accept_friend_request(self):
        fr = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.auth(self.bob)
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['accepted'])
        # Friendship should now exist
        self.assertTrue(Friendship.are_friends(self.alice, self.bob))
        fr.refresh_from_db()
        self.assertEqual(fr.status, 'accepted')

    def test_reject_friend_request(self):
        fr = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.auth(self.bob)
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/reject/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['rejected'])
        self.assertFalse(Friendship.are_friends(self.alice, self.bob))
        fr.refresh_from_db()
        self.assertEqual(fr.status, 'rejected')

    def test_only_recipient_can_accept(self):
        fr = FriendRequest.objects.create(from_user=self.alice, to_user=self.bob)
        self.auth(self.alice)  # Sender, not the recipient
        response = self.client.post(f'/api/community/friend-requests/{fr.id}/accept/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_send_if_already_friends(self):
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        self.auth(self.alice)
        response = self.client.post('/api/community/friend-requests/', {'to_user': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FriendAPITest(BaseMessagingAPITest):
    def test_list_friends(self):
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        self.auth(self.alice)
        response = self.client.get('/api/community/friends/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['username'], 'bob')

    def test_remove_friend(self):
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        self.auth(self.alice)
        response = self.client.delete(f'/api/community/friends/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Friendship.are_friends(self.alice, self.bob))

    def test_remove_non_friend(self):
        self.auth(self.alice)
        response = self.client.delete(f'/api/community/friends/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ConversationAPITest(BaseMessagingAPITest):
    def setUp(self):
        super().setUp()
        # Make alice and bob friends
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)

    def test_start_conversation(self):
        self.auth(self.alice)
        response = self.client.post('/api/community/conversations/start/', {'user_id': self.bob.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['other_user']['username'], 'bob')

    def test_start_conversation_requires_friendship(self):
        self.auth(self.alice)
        response = self.client.post('/api/community/conversations/start/', {'user_id': self.charlie.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_conversations(self):
        Conversation.get_or_create_conversation(self.alice, self.bob)
        self.auth(self.alice)
        response = self.client.get('/api/community/conversations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_conversation(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        self.auth(self.alice)
        response = self.client.get(f'/api/community/conversations/{conv.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['other_user']['username'], 'bob')

    def test_cannot_access_others_conversation(self):
        conv = Conversation.get_or_create_conversation(self.alice, self.bob)
        self.auth(self.charlie)
        response = self.client.get(f'/api/community/conversations/{conv.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MessageAPITest(BaseMessagingAPITest):
    def setUp(self):
        super().setUp()
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        self.conv = Conversation.get_or_create_conversation(self.alice, self.bob)

    def test_send_message(self):
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'Hello Bob!'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['text'], 'Hello Bob!')
        self.assertEqual(response.data['sender_username'], 'alice')

    def test_send_empty_message(self):
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': ''},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_messages(self):
        DirectMessage.objects.create(conversation=self.conv, sender=self.alice, text='Hi!')
        DirectMessage.objects.create(conversation=self.conv, sender=self.bob, text='Hey!')
        self.auth(self.alice)
        response = self.client.get(f'/api/community/conversations/{self.conv.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['text'], 'Hi!')
        self.assertEqual(response.data[1]['text'], 'Hey!')

    def test_mark_read_on_fetch(self):
        msg = DirectMessage.objects.create(conversation=self.conv, sender=self.bob, text='Unread')
        self.assertFalse(msg.is_read)
        self.auth(self.alice)  # Alice reads Bob's message
        self.client.get(f'/api/community/conversations/{self.conv.id}/messages/')
        msg.refresh_from_db()
        self.assertTrue(msg.is_read)

    def test_own_messages_not_marked_read(self):
        msg = DirectMessage.objects.create(conversation=self.conv, sender=self.alice, text='My msg')
        self.assertFalse(msg.is_read)
        self.auth(self.alice)  # Alice reads her own unread message
        self.client.get(f'/api/community/conversations/{self.conv.id}/messages/')
        msg.refresh_from_db()
        self.assertFalse(msg.is_read)  # Should NOT be marked as read

    def test_cannot_message_in_others_conversation(self):
        self.auth(self.charlie)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'sneaky'},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unread_count_in_conversation(self):
        DirectMessage.objects.create(conversation=self.conv, sender=self.bob, text='msg1')
        DirectMessage.objects.create(conversation=self.conv, sender=self.bob, text='msg2')
        self.auth(self.alice)
        response = self.client.get('/api/community/conversations/')
        self.assertEqual(response.data[0]['unread_count'], 2)


class SharedContentAPITest(BaseMessagingAPITest):
    """Test sharing shopping lists, recipes, and events in DMs."""

    def setUp(self):
        super().setUp()
        u1, u2 = sorted([self.alice, self.bob], key=lambda u: u.id)
        Friendship.objects.create(user1=u1, user2=u2)
        self.conv = Conversation.get_or_create_conversation(self.alice, self.bob)

    def _create_shopping_list(self):
        from shopping.models import ShoppingList
        return ShoppingList.objects.create(
            user=self.alice, name='Weekly Shop', description='Groceries for the week',
        )

    def _create_recipe(self):
        from cook.models import Recipe
        return Recipe.objects.create(
            title='Pancakes', description='Fluffy pancakes', category='breakfast',
            difficulty='easy', created_by=self.alice,
        )

    def _create_event(self):
        from community.models import FoodXEvent
        return FoodXEvent.objects.create(
            title='Food Market', description='Local food market',
            location_name='Central Park', latitude=51.5, longitude=-0.1,
            date='2026-06-15', category='market',
        )

    # ── Shopping List sharing ──

    def test_share_shopping_list(self):
        sl = self._create_shopping_list()
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'Check out my list!', 'shared_content_type': 'shopping_list', 'shared_content_id': sl.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['shared_content_type'], 'shopping_list')
        self.assertEqual(response.data['shared_content_id'], sl.id)
        self.assertIsNotNone(response.data['shared_content'])
        self.assertEqual(response.data['shared_content']['title'], 'Weekly Shop')
        self.assertEqual(response.data['shared_content']['type'], 'shopping_list')

    def test_share_shopping_list_without_text(self):
        sl = self._create_shopping_list()
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'shared_content_type': 'shopping_list', 'shared_content_id': sl.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['text'], '')

    # ── Recipe sharing ──

    def test_share_recipe(self):
        recipe = self._create_recipe()
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'Try this recipe!', 'shared_content_type': 'recipe', 'shared_content_id': recipe.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['shared_content']['title'], 'Pancakes')
        self.assertEqual(response.data['shared_content']['type'], 'recipe')
        self.assertEqual(response.data['shared_content']['difficulty'], 'easy')

    # ── Event sharing ──

    def test_share_event(self):
        event = self._create_event()
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'Shall we go?', 'shared_content_type': 'event', 'shared_content_id': event.id},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['shared_content']['title'], 'Food Market')
        self.assertEqual(response.data['shared_content']['type'], 'event')
        self.assertEqual(response.data['shared_content']['location_name'], 'Central Park')

    # ── Validation ──

    def test_invalid_content_type_rejected(self):
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': 'bad', 'shared_content_type': 'invalid', 'shared_content_id': 1},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_content_id_rejected(self):
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'shared_content_type': 'recipe'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nonexistent_content_rejected(self):
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'shared_content_type': 'recipe', 'shared_content_id': 99999},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_shared_content_in_messages_list(self):
        """Shared content should appear when listing conversation messages."""
        recipe = self._create_recipe()
        DirectMessage.objects.create(
            conversation=self.conv, sender=self.alice, text='Here!',
            shared_content_type='recipe', shared_content_id=recipe.id,
        )
        self.auth(self.bob)
        response = self.client.get(f'/api/community/conversations/{self.conv.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertIsNotNone(response.data[0]['shared_content'])
        self.assertEqual(response.data[0]['shared_content']['title'], 'Pancakes')

    def test_must_have_text_or_content(self):
        """Empty message with no text and no shared_content should be rejected."""
        self.auth(self.alice)
        response = self.client.post(
            f'/api/community/conversations/{self.conv.id}/send/',
            {'text': ''},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
