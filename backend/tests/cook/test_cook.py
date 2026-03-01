from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status

from cook.models import Recipe, RecipeIngredient, RecipeStep, RecipeFavourite, CookingHack


# ── Model Tests ───────────────────────────────────────────────────────────────


class RecipeModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='chef', password='TestPass123!')
        self.recipe = Recipe.objects.create(
            title='Test Recipe',
            description='A test recipe',
            category='dinner',
            difficulty='easy',
            prep_time_minutes=10,
            cook_time_minutes=20,
            servings=2,
            created_by=self.user,
        )

    def test_str(self):
        self.assertEqual(str(self.recipe), 'Test Recipe')

    def test_total_time(self):
        self.assertEqual(self.recipe.total_time_minutes, 30)

    def test_favourite_count_zero(self):
        self.assertEqual(self.recipe.favourite_count, 0)


class RecipeIngredientModelTest(TestCase):
    def setUp(self):
        self.recipe = Recipe.objects.create(title='Test', category='dinner')
        self.ingredient = RecipeIngredient.objects.create(
            recipe=self.recipe, name='Tomato', quantity='2', unit='cups', order=0,
        )

    def test_str(self):
        self.assertEqual(str(self.ingredient), '2 cups Tomato')

    def test_ordering(self):
        RecipeIngredient.objects.create(recipe=self.recipe, name='Onion', order=1)
        ings = list(self.recipe.ingredients.values_list('name', flat=True))
        self.assertEqual(ings, ['Tomato', 'Onion'])


class RecipeStepModelTest(TestCase):
    def setUp(self):
        self.recipe = Recipe.objects.create(title='Test', category='dinner')
        self.step = RecipeStep.objects.create(
            recipe=self.recipe, step_number=1, instruction='Boil the water',
        )

    def test_str(self):
        self.assertIn('Step 1', str(self.step))

    def test_ordering(self):
        RecipeStep.objects.create(recipe=self.recipe, step_number=2, instruction='Add pasta')
        steps = list(self.recipe.steps.values_list('step_number', flat=True))
        self.assertEqual(steps, [1, 2])


class RecipeFavouriteModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='fan', password='TestPass123!')
        self.recipe = Recipe.objects.create(title='Fav Recipe')
        self.fav = RecipeFavourite.objects.create(user=self.user, recipe=self.recipe)

    def test_str(self):
        self.assertIn('fan', str(self.fav))
        self.assertIn('Fav Recipe', str(self.fav))

    def test_unique(self):
        with self.assertRaises(Exception):
            RecipeFavourite.objects.create(user=self.user, recipe=self.recipe)

    def test_favourite_count(self):
        self.assertEqual(self.recipe.favourite_count, 1)


class CookingHackModelTest(TestCase):
    def test_str(self):
        hack = CookingHack.objects.create(
            title='Test Hack', description='A useful hack', category='technique',
        )
        self.assertEqual(str(hack), 'Test Hack')


# ── API Tests ─────────────────────────────────────────────────────────────────


class BaseRecipeAPITest(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='alice', password='TestPass123!')
        self.bob = User.objects.create_user(username='bob', password='TestPass123!')
        self.public_recipe = Recipe.objects.create(
            title='Public Recipe',
            description='A public recipe',
            category='dinner',
            difficulty='easy',
            prep_time_minutes=5,
            cook_time_minutes=10,
            servings=2,
            is_public=True,
            created_by=self.alice,
        )
        RecipeIngredient.objects.create(
            recipe=self.public_recipe, name='Salt', quantity='1', unit='tsp', order=0,
        )
        RecipeStep.objects.create(
            recipe=self.public_recipe, step_number=1, instruction='Add salt',
        )
        self.private_recipe = Recipe.objects.create(
            title='Private Recipe',
            description='A private recipe',
            category='lunch',
            is_public=False,
            created_by=self.alice,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class RecipeListAPITest(BaseRecipeAPITest):
    def _results(self, response):
        """Extract results from paginated or plain response."""
        data = response.data
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_list_public_recipes_anonymous(self):
        response = self.client.get('/api/cook/recipes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [r['title'] for r in self._results(response)]
        self.assertIn('Public Recipe', titles)
        self.assertNotIn('Private Recipe', titles)

    def test_list_includes_private_for_owner(self):
        self.auth(self.alice)
        response = self.client.get('/api/cook/recipes/')
        titles = [r['title'] for r in self._results(response)]
        self.assertIn('Public Recipe', titles)
        self.assertIn('Private Recipe', titles)

    def test_list_excludes_others_private(self):
        self.auth(self.bob)
        response = self.client.get('/api/cook/recipes/')
        titles = [r['title'] for r in self._results(response)]
        self.assertIn('Public Recipe', titles)
        self.assertNotIn('Private Recipe', titles)

    def test_filter_by_category(self):
        response = self.client.get('/api/cook/recipes/', {'category': 'dinner'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for r in self._results(response):
            self.assertEqual(r['category'], 'dinner')

    def test_search(self):
        response = self.client.get('/api/cook/recipes/', {'search': 'Public'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any('Public' in r['title'] for r in self._results(response)))


class RecipeDetailAPITest(BaseRecipeAPITest):
    def test_retrieve_with_ingredients_and_steps(self):
        response = self.client.get(f'/api/cook/recipes/{self.public_recipe.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ingredients', response.data)
        self.assertIn('steps', response.data)
        self.assertEqual(len(response.data['ingredients']), 1)
        self.assertEqual(len(response.data['steps']), 1)


class RecipeCreateAPITest(BaseRecipeAPITest):
    def test_create_requires_auth(self):
        response = self.client.post('/api/cook/recipes/', {'title': 'New'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_recipe_with_nested_data(self):
        self.auth(self.alice)
        data = {
            'title': 'My New Recipe',
            'description': 'Tasty!',
            'category': 'snack',
            'difficulty': 'easy',
            'prep_time_minutes': 5,
            'cook_time_minutes': 0,
            'servings': 1,
            'ingredients': [
                {'name': 'Bread', 'quantity': '2', 'unit': 'slices'},
            ],
            'steps': [
                {'step_number': 1, 'instruction': 'Toast the bread'},
            ],
        }
        response = self.client.post('/api/cook/recipes/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        recipe = Recipe.objects.get(id=response.data['id'])
        self.assertEqual(recipe.created_by, self.alice)
        self.assertEqual(recipe.ingredients.count(), 1)
        self.assertEqual(recipe.steps.count(), 1)

    def test_create_minimal_recipe(self):
        self.auth(self.alice)
        data = {'title': 'Minimal Recipe'}
        response = self.client.post('/api/cook/recipes/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class RecipeFavouriteAPITest(BaseRecipeAPITest):
    def test_favourite_requires_auth(self):
        response = self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_favourite_recipe(self):
        self.auth(self.bob)
        response = self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['favourited'])
        self.public_recipe.refresh_from_db()
        self.assertEqual(self.public_recipe.favourite_count, 1)

    def test_favourite_idempotent(self):
        self.auth(self.bob)
        self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        response = self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['favourited'])

    def test_unfavourite_recipe(self):
        self.auth(self.bob)
        self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        response = self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/unfavourite/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['unfavourited'])

    def test_unfavourite_not_favourited(self):
        self.auth(self.bob)
        response = self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/unfavourite/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_is_favourited_in_list(self):
        self.auth(self.bob)
        self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        response = self.client.get('/api/cook/recipes/')
        results = response.data
        if isinstance(results, dict) and 'results' in results:
            results = results['results']
        public = next(r for r in results if r['title'] == 'Public Recipe')
        self.assertTrue(public['is_favourited'])


class RecipeMyRecipesAPITest(BaseRecipeAPITest):
    def test_my_recipes(self):
        self.auth(self.alice)
        response = self.client.get('/api/cook/recipes/my_recipes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [r['title'] for r in response.data]
        self.assertIn('Public Recipe', titles)
        self.assertIn('Private Recipe', titles)

    def test_my_recipes_requires_auth(self):
        response = self.client.get('/api/cook/recipes/my_recipes/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_my_favourites(self):
        self.auth(self.bob)
        self.client.post(f'/api/cook/recipes/{self.public_recipe.id}/favourite/')
        response = self.client.get('/api/cook/recipes/my_favourites/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [r['title'] for r in response.data]
        self.assertIn('Public Recipe', titles)


class RecipeUpdateDeleteAPITest(BaseRecipeAPITest):
    def test_update_own_recipe(self):
        self.auth(self.alice)
        response = self.client.patch(
            f'/api/cook/recipes/{self.public_recipe.id}/',
            {'title': 'Updated Recipe'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.public_recipe.refresh_from_db()
        self.assertEqual(self.public_recipe.title, 'Updated Recipe')

    def test_cannot_update_others_recipe(self):
        self.auth(self.bob)
        response = self.client.patch(
            f'/api/cook/recipes/{self.public_recipe.id}/',
            {'title': 'Hacked'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_own_recipe(self):
        self.auth(self.alice)
        response = self.client.delete(f'/api/cook/recipes/{self.public_recipe.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Recipe.objects.filter(id=self.public_recipe.id).exists())

    def test_cannot_delete_others_recipe(self):
        self.auth(self.bob)
        response = self.client.delete(f'/api/cook/recipes/{self.public_recipe.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CookingHackAPITest(APITestCase):
    def setUp(self):
        self.hack1 = CookingHack.objects.create(
            title='Time Hack', description='Save time!', category='time_saving',
        )
        self.hack2 = CookingHack.objects.create(
            title='Money Hack', description='Save money!', category='money_saving',
        )
        self.inactive = CookingHack.objects.create(
            title='Old Hack', description='Obsolete', category='other', is_active=False,
        )

    def _results(self, response):
        data = response.data
        if isinstance(data, dict) and 'results' in data:
            return data['results']
        return data

    def test_list_hacks(self):
        response = self.client.get('/api/cook/hacks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [h['title'] for h in self._results(response)]
        self.assertIn('Time Hack', titles)
        self.assertIn('Money Hack', titles)
        self.assertNotIn('Old Hack', titles)

    def test_filter_by_category(self):
        response = self.client.get('/api/cook/hacks/', {'category': 'time_saving'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for h in self._results(response):
            self.assertEqual(h['category'], 'time_saving')

    def test_search_hacks(self):
        response = self.client.get('/api/cook/hacks/', {'search': 'money'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any('Money' in h['title'] for h in self._results(response)))

    def test_hacks_read_only(self):
        response = self.client.post('/api/cook/hacks/', {'title': 'New', 'description': 'x', 'category': 'other'})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
