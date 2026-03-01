export interface CommunityGroup {
  id: number;
  name: string;
  description: string;
  category: string;
  is_featured: boolean;
  is_trending: boolean;
  member_count: number;
  topic_count: number;
  created_by_username: string | null;
  is_member: boolean;
  created_at: string;
  topics?: Topic[];
}

export type VoteType = 'useful' | 'not_useful';

export interface Topic {
  id: number;
  title: string;
  body: string;
  created_by_username: string | null;
  created_at: string;
  useful_count: number;
  not_useful_count: number;
  flag_count: number;
  comment_count: number;
  my_vote: VoteType | null;
}

export interface Comment {
  id: number;
  body: string;
  created_by_username: string | null;
  created_at: string;
  useful_count: number;
  not_useful_count: number;
  flag_count: number;
  my_vote: VoteType | null;
  replies: Comment[];
}

export interface VoteResponse {
  vote_type: VoteType;
  useful_count: number;
  not_useful_count: number;
  flag_count: number;
  removed?: boolean;
}

export type EventCategory = 'market' | 'swap' | 'workshop' | 'tasting' | 'festival' | 'community' | 'other';

export interface FoodXEvent {
  id: number;
  title: string;
  description: string;
  long_description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  date: string;
  event_time: string;
  category: EventCategory;
  image_url: string;
  organizer: string;
  price: string;
  attendee_count: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

// ── Messaging Types ──────────────────────────────────────────

export interface UserSearchResult {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: number;
  from_user: number;
  to_user: number;
  from_username: string;
  to_username: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

export interface DirectMessage {
  id: number;
  conversation: number;
  sender: number;
  sender_username: string;
  text: string;
  is_read: boolean;
  shared_content_type: 'shopping_list' | 'recipe' | 'event' | null;
  shared_content_id: number | null;
  shared_content: SharedContent | null;
  created_at: string;
}

export type SharedContentType = 'shopping_list' | 'recipe' | 'event';

export interface SharedContent {
  type: SharedContentType;
  id: number;
  title: string;
  description?: string;
  // Shopping list specific
  item_count?: number;
  owner?: string;
  // Recipe specific
  image_url?: string;
  category?: string;
  difficulty?: string;
  total_time_minutes?: number;
  // Event specific
  date?: string;
  event_time?: string;
  location_name?: string;
}

export interface Conversation {
  id: number;
  other_user: UserSearchResult;
  last_message: DirectMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}
