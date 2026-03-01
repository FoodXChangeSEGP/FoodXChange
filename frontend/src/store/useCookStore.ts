import { create } from 'zustand';
import { api } from '@/services/api';
import type { Recipe, RecipeDetail, RecipeCreateData, CookingHack, RecipeCategory, CookingHackCategory } from '@/types/cook';

interface CookState {
  // Recipes
  recipes: Recipe[];
  recipesLoading: boolean;
  selectedRecipe: RecipeDetail | null;
  selectedRecipeLoading: boolean;
  myRecipes: Recipe[];
  myFavourites: Recipe[];

  // Filters
  categoryFilter: RecipeCategory | null;
  difficultyFilter: string | null;
  searchQuery: string;

  // Cooking Hacks
  hacks: CookingHack[];
  hacksLoading: boolean;
  hackCategoryFilter: CookingHackCategory | null;

  // Active tab
  activeTab: 'recipes' | 'my_recipes' | 'favourites' | 'hacks';

  // Actions - Recipes
  loadRecipes: (params?: { category?: string; difficulty?: string; search?: string }) => Promise<void>;
  loadRecipe: (id: number) => Promise<void>;
  loadMyRecipes: () => Promise<void>;
  loadMyFavourites: () => Promise<void>;
  createRecipe: (data: RecipeCreateData) => Promise<Recipe | null>;
  deleteRecipe: (id: number) => Promise<boolean>;
  toggleFavourite: (recipe: Recipe) => Promise<void>;

  // Actions - Hacks
  loadHacks: (params?: { category?: string; search?: string }) => Promise<void>;

  // Actions - UI
  setActiveTab: (tab: CookState['activeTab']) => void;
  setCategoryFilter: (category: RecipeCategory | null) => void;
  setDifficultyFilter: (difficulty: string | null) => void;
  setSearchQuery: (query: string) => void;
  setHackCategoryFilter: (category: CookingHackCategory | null) => void;
  clearSelectedRecipe: () => void;
}

export const useCookStore = create<CookState>((set, get) => ({
  // State
  recipes: [],
  recipesLoading: false,
  selectedRecipe: null,
  selectedRecipeLoading: false,
  myRecipes: [],
  myFavourites: [],
  categoryFilter: null,
  difficultyFilter: null,
  searchQuery: '',
  hacks: [],
  hacksLoading: false,
  hackCategoryFilter: null,
  activeTab: 'recipes',

  // Recipe actions
  loadRecipes: async (params) => {
    set({ recipesLoading: true });
    try {
      const recipes = await api.cook.listRecipes(params);
      set({ recipes, recipesLoading: false });
    } catch (error) {
      console.error('Failed to load recipes:', error);
      set({ recipesLoading: false });
    }
  },

  loadRecipe: async (id) => {
    set({ selectedRecipeLoading: true });
    try {
      const recipe = await api.cook.getRecipe(id);
      set({ selectedRecipe: recipe, selectedRecipeLoading: false });
    } catch (error) {
      console.error('Failed to load recipe:', error);
      set({ selectedRecipeLoading: false });
    }
  },

  loadMyRecipes: async () => {
    set({ recipesLoading: true });
    try {
      const myRecipes = await api.cook.myRecipes();
      set({ myRecipes, recipesLoading: false });
    } catch (error) {
      console.error('Failed to load my recipes:', error);
      set({ recipesLoading: false });
    }
  },

  loadMyFavourites: async () => {
    set({ recipesLoading: true });
    try {
      const myFavourites = await api.cook.myFavourites();
      set({ myFavourites, recipesLoading: false });
    } catch (error) {
      console.error('Failed to load favourites:', error);
      set({ recipesLoading: false });
    }
  },

  createRecipe: async (data) => {
    try {
      const recipe = await api.cook.createRecipe(data);
      // Reload my recipes list
      get().loadMyRecipes();
      return recipe as unknown as Recipe;
    } catch (error) {
      console.error('Failed to create recipe:', error);
      return null;
    }
  },

  deleteRecipe: async (id) => {
    try {
      await api.cook.deleteRecipe(id);
      // Remove from local state
      set((s) => ({
        recipes: s.recipes.filter((r) => r.id !== id),
        myRecipes: s.myRecipes.filter((r) => r.id !== id),
      }));
      return true;
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      return false;
    }
  },

  toggleFavourite: async (recipe) => {
    try {
      if (recipe.is_favourited) {
        await api.cook.unfavouriteRecipe(recipe.id);
      } else {
        await api.cook.favouriteRecipe(recipe.id);
      }

      // Toggle locally across all lists
      const toggle = (r: Recipe) =>
        r.id === recipe.id
          ? {
              ...r,
              is_favourited: !r.is_favourited,
              favourite_count: r.is_favourited
                ? r.favourite_count - 1
                : r.favourite_count + 1,
            }
          : r;

      set((s) => ({
        recipes: s.recipes.map(toggle),
        myRecipes: s.myRecipes.map(toggle),
        myFavourites: s.myFavourites.map(toggle),
        selectedRecipe: s.selectedRecipe && s.selectedRecipe.id === recipe.id
          ? { ...s.selectedRecipe, is_favourited: !s.selectedRecipe.is_favourited }
          : s.selectedRecipe,
      }));
    } catch (error) {
      console.error('Failed to toggle favourite:', error);
    }
  },

  // Hack actions
  loadHacks: async (params) => {
    set({ hacksLoading: true });
    try {
      const hacks = await api.cook.listHacks(params);
      set({ hacks, hacksLoading: false });
    } catch (error) {
      console.error('Failed to load hacks:', error);
      set({ hacksLoading: false });
    }
  },

  // UI actions
  setActiveTab: (activeTab) => set({ activeTab }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setDifficultyFilter: (difficultyFilter) => set({ difficultyFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setHackCategoryFilter: (hackCategoryFilter) => set({ hackCategoryFilter }),
  clearSelectedRecipe: () => set({ selectedRecipe: null }),
}));
