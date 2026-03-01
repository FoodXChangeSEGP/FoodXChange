/**
 * Tests for the useCookStore Zustand store
 */

// Mock the api module before importing the store
jest.mock('@/services/api', () => ({
  api: {
    cook: {
      listRecipes: jest.fn(),
      getRecipe: jest.fn(),
      createRecipe: jest.fn(),
      updateRecipe: jest.fn(),
      deleteRecipe: jest.fn(),
      favouriteRecipe: jest.fn(),
      unfavouriteRecipe: jest.fn(),
      myRecipes: jest.fn(),
      myFavourites: jest.fn(),
      listHacks: jest.fn(),
      getHack: jest.fn(),
    },
  },
}));

const { api } = require('@/services/api');
const { useCookStore } = require('@/store/useCookStore');

const mockRecipe = {
  id: 1,
  title: 'Spaghetti Bolognese',
  description: 'A classic Italian recipe',
  image_url: '',
  category: 'dinner',
  difficulty: 'medium',
  prep_time_minutes: 15,
  cook_time_minutes: 45,
  total_time_minutes: 60,
  servings: 4,
  calories_per_serving: 580,
  tags: ['italian', 'pasta'],
  is_public: true,
  favourite_count: 3,
  created_by_username: 'alice',
  is_favourited: false,
  created_at: '2024-01-01T00:00:00Z',
};

const mockRecipeDetail = {
  ...mockRecipe,
  ingredients: [
    { id: 1, name: 'Spaghetti', quantity: '400', unit: 'g', order: 1 },
    { id: 2, name: 'Minced beef', quantity: '500', unit: 'g', order: 2 },
  ],
  steps: [
    { id: 1, step_number: 1, instruction: 'Boil pasta', image_url: '', duration_minutes: 10 },
    { id: 2, step_number: 2, instruction: 'Cook sauce', image_url: '', duration_minutes: 30 },
  ],
  source_url: '',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockHack = {
  id: 1,
  title: 'Use ice water for crispy chips',
  description: 'Soak potatoes in ice water before frying.',
  category: 'technique',
  image_url: '',
  tags: ['frying', 'potatoes'],
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('useCookStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useCookStore.setState({
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
    });
    jest.clearAllMocks();
  });

  // ── loadRecipes ─────────────────────────────────────────

  describe('loadRecipes', () => {
    it('loads recipes and sets state', async () => {
      api.cook.listRecipes.mockResolvedValue([mockRecipe]);

      await useCookStore.getState().loadRecipes();

      expect(api.cook.listRecipes).toHaveBeenCalledTimes(1);
      expect(useCookStore.getState().recipes).toEqual([mockRecipe]);
      expect(useCookStore.getState().recipesLoading).toBe(false);
    });

    it('passes filter params through', async () => {
      api.cook.listRecipes.mockResolvedValue([]);

      await useCookStore.getState().loadRecipes({ category: 'dinner', search: 'pasta' });

      expect(api.cook.listRecipes).toHaveBeenCalledWith({ category: 'dinner', search: 'pasta' });
    });

    it('sets loading state correctly', async () => {
      api.cook.listRecipes.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const promise = useCookStore.getState().loadRecipes();
      expect(useCookStore.getState().recipesLoading).toBe(true);
      await promise;
      expect(useCookStore.getState().recipesLoading).toBe(false);
    });

    it('handles errors gracefully', async () => {
      api.cook.listRecipes.mockRejectedValue(new Error('Network error'));

      await useCookStore.getState().loadRecipes();

      expect(useCookStore.getState().recipes).toEqual([]);
      expect(useCookStore.getState().recipesLoading).toBe(false);
    });
  });

  // ── loadRecipe ─────────────────────────────────────────

  describe('loadRecipe', () => {
    it('loads recipe detail and sets selectedRecipe', async () => {
      api.cook.getRecipe.mockResolvedValue(mockRecipeDetail);

      await useCookStore.getState().loadRecipe(1);

      expect(api.cook.getRecipe).toHaveBeenCalledWith(1);
      expect(useCookStore.getState().selectedRecipe).toEqual(mockRecipeDetail);
      expect(useCookStore.getState().selectedRecipeLoading).toBe(false);
    });

    it('handles errors gracefully', async () => {
      api.cook.getRecipe.mockRejectedValue(new Error('Not found'));

      await useCookStore.getState().loadRecipe(999);

      expect(useCookStore.getState().selectedRecipe).toBeNull();
      expect(useCookStore.getState().selectedRecipeLoading).toBe(false);
    });
  });

  // ── loadMyRecipes ──────────────────────────────────────

  describe('loadMyRecipes', () => {
    it('loads user recipes', async () => {
      api.cook.myRecipes.mockResolvedValue([mockRecipe]);

      await useCookStore.getState().loadMyRecipes();

      expect(api.cook.myRecipes).toHaveBeenCalledTimes(1);
      expect(useCookStore.getState().myRecipes).toEqual([mockRecipe]);
    });
  });

  // ── loadMyFavourites ───────────────────────────────────

  describe('loadMyFavourites', () => {
    it('loads favourited recipes', async () => {
      const favRecipe = { ...mockRecipe, is_favourited: true };
      api.cook.myFavourites.mockResolvedValue([favRecipe]);

      await useCookStore.getState().loadMyFavourites();

      expect(api.cook.myFavourites).toHaveBeenCalledTimes(1);
      expect(useCookStore.getState().myFavourites).toEqual([favRecipe]);
    });
  });

  // ── createRecipe ───────────────────────────────────────

  describe('createRecipe', () => {
    it('creates recipe and reloads my recipes', async () => {
      const newRecipe = { ...mockRecipe, id: 2, title: 'New Recipe' };
      api.cook.createRecipe.mockResolvedValue(newRecipe);
      api.cook.myRecipes.mockResolvedValue([newRecipe]);

      const result = await useCookStore.getState().createRecipe({ title: 'New Recipe' });

      expect(api.cook.createRecipe).toHaveBeenCalledWith({ title: 'New Recipe' });
      expect(result).toBeTruthy();
    });

    it('returns null on failure', async () => {
      api.cook.createRecipe.mockRejectedValue(new Error('Validation error'));

      const result = await useCookStore.getState().createRecipe({ title: '' });

      expect(result).toBeNull();
    });
  });

  // ── deleteRecipe ───────────────────────────────────────

  describe('deleteRecipe', () => {
    it('removes recipe from local state', async () => {
      useCookStore.setState({
        recipes: [mockRecipe],
        myRecipes: [mockRecipe],
      });
      api.cook.deleteRecipe.mockResolvedValue(undefined);

      const result = await useCookStore.getState().deleteRecipe(1);

      expect(result).toBe(true);
      expect(useCookStore.getState().recipes).toEqual([]);
      expect(useCookStore.getState().myRecipes).toEqual([]);
    });

    it('returns false on failure', async () => {
      api.cook.deleteRecipe.mockRejectedValue(new Error('Forbidden'));

      const result = await useCookStore.getState().deleteRecipe(1);

      expect(result).toBe(false);
    });
  });

  // ── toggleFavourite ────────────────────────────────────

  describe('toggleFavourite', () => {
    it('favourites an unfavourited recipe', async () => {
      useCookStore.setState({ recipes: [mockRecipe] });
      api.cook.favouriteRecipe.mockResolvedValue({});

      await useCookStore.getState().toggleFavourite(mockRecipe);

      expect(api.cook.favouriteRecipe).toHaveBeenCalledWith(1);
      const updated = useCookStore.getState().recipes[0];
      expect(updated.is_favourited).toBe(true);
      expect(updated.favourite_count).toBe(4);
    });

    it('unfavourites a favourited recipe', async () => {
      const favRecipe = { ...mockRecipe, is_favourited: true, favourite_count: 4 };
      useCookStore.setState({ recipes: [favRecipe] });
      api.cook.unfavouriteRecipe.mockResolvedValue({});

      await useCookStore.getState().toggleFavourite(favRecipe);

      expect(api.cook.unfavouriteRecipe).toHaveBeenCalledWith(1);
      const updated = useCookStore.getState().recipes[0];
      expect(updated.is_favourited).toBe(false);
      expect(updated.favourite_count).toBe(3);
    });

    it('toggles across all lists simultaneously', async () => {
      useCookStore.setState({
        recipes: [mockRecipe],
        myRecipes: [mockRecipe],
        myFavourites: [mockRecipe],
      });
      api.cook.favouriteRecipe.mockResolvedValue({});

      await useCookStore.getState().toggleFavourite(mockRecipe);

      expect(useCookStore.getState().recipes[0].is_favourited).toBe(true);
      expect(useCookStore.getState().myRecipes[0].is_favourited).toBe(true);
      expect(useCookStore.getState().myFavourites[0].is_favourited).toBe(true);
    });

    it('toggles selectedRecipe when matching', async () => {
      useCookStore.setState({
        recipes: [mockRecipe],
        selectedRecipe: mockRecipeDetail,
      });
      api.cook.favouriteRecipe.mockResolvedValue({});

      await useCookStore.getState().toggleFavourite(mockRecipe);

      expect(useCookStore.getState().selectedRecipe.is_favourited).toBe(true);
    });
  });

  // ── loadHacks ──────────────────────────────────────────

  describe('loadHacks', () => {
    it('loads hacks and sets state', async () => {
      api.cook.listHacks.mockResolvedValue([mockHack]);

      await useCookStore.getState().loadHacks();

      expect(api.cook.listHacks).toHaveBeenCalledTimes(1);
      expect(useCookStore.getState().hacks).toEqual([mockHack]);
      expect(useCookStore.getState().hacksLoading).toBe(false);
    });

    it('passes category filter through', async () => {
      api.cook.listHacks.mockResolvedValue([]);

      await useCookStore.getState().loadHacks({ category: 'technique' });

      expect(api.cook.listHacks).toHaveBeenCalledWith({ category: 'technique' });
    });

    it('handles errors gracefully', async () => {
      api.cook.listHacks.mockRejectedValue(new Error('Network error'));

      await useCookStore.getState().loadHacks();

      expect(useCookStore.getState().hacks).toEqual([]);
      expect(useCookStore.getState().hacksLoading).toBe(false);
    });
  });

  // ── UI actions ─────────────────────────────────────────

  describe('UI actions', () => {
    it('setActiveTab updates tab', () => {
      useCookStore.getState().setActiveTab('hacks');
      expect(useCookStore.getState().activeTab).toBe('hacks');
    });

    it('setCategoryFilter updates filter', () => {
      useCookStore.getState().setCategoryFilter('dinner');
      expect(useCookStore.getState().categoryFilter).toBe('dinner');
    });

    it('setDifficultyFilter updates filter', () => {
      useCookStore.getState().setDifficultyFilter('hard');
      expect(useCookStore.getState().difficultyFilter).toBe('hard');
    });

    it('setSearchQuery updates query', () => {
      useCookStore.getState().setSearchQuery('pasta');
      expect(useCookStore.getState().searchQuery).toBe('pasta');
    });

    it('setHackCategoryFilter updates filter', () => {
      useCookStore.getState().setHackCategoryFilter('time_saving');
      expect(useCookStore.getState().hackCategoryFilter).toBe('time_saving');
    });

    it('clearSelectedRecipe resets selection', () => {
      useCookStore.setState({ selectedRecipe: mockRecipeDetail });
      useCookStore.getState().clearSelectedRecipe();
      expect(useCookStore.getState().selectedRecipe).toBeNull();
    });
  });
});
