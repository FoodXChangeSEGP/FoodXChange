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
