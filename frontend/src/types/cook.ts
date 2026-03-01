// ── Cook / Recipe Types ──────────────────────────────────────

export type RecipeCategory =
  | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert'
  | 'drink' | 'side' | 'soup' | 'salad' | 'vegetarian' | 'vegan' | 'other';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';

export type CookingHackCategory =
  | 'time_saving' | 'money_saving' | 'health' | 'storage'
  | 'technique' | 'substitution' | 'cleanup' | 'other';

export interface RecipeIngredient {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  order: number;
}

export interface RecipeStep {
  id: number;
  step_number: number;
  instruction: string;
  image_url: string;
  duration_minutes: number | null;
}

export interface Recipe {
  id: number;
  title: string;
  description: string;
  image_url: string;
  category: RecipeCategory;
  difficulty: RecipeDifficulty;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  servings: number;
  calories_per_serving: number | null;
  tags: string[];
  is_public: boolean;
  favourite_count: number;
  created_by_username: string | null;
  is_favourited: boolean;
  created_at: string;
}

export interface RecipeDetail extends Recipe {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  source_url: string;
  updated_at: string;
}

export interface RecipeCreateData {
  title: string;
  description?: string;
  image_url?: string;
  category?: RecipeCategory;
  difficulty?: RecipeDifficulty;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  calories_per_serving?: number | null;
  source_url?: string;
  tags?: string[];
  is_public?: boolean;
  ingredients?: Omit<RecipeIngredient, 'id'>[];
  steps?: Omit<RecipeStep, 'id'>[];
}

export interface CookingHack {
  id: number;
  title: string;
  description: string;
  category: CookingHackCategory;
  image_url: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
}
