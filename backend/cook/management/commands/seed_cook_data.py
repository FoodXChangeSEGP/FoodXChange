from django.core.management.base import BaseCommand
from cook.models import Recipe, RecipeIngredient, RecipeStep, CookingHack


RECIPES = [
    {
        'title': 'Classic Spaghetti Bolognese',
        'description': 'A rich and hearty Italian pasta sauce with beef mince, tomatoes, and herbs.',
        'image_url': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600',
        'category': 'dinner',
        'difficulty': 'easy',
        'prep_time_minutes': 15,
        'cook_time_minutes': 45,
        'servings': 4,
        'calories_per_serving': 520,
        'tags': ['italian', 'pasta', 'family-friendly', 'comfort-food'],
        'ingredients': [
            {'name': 'spaghetti', 'quantity': '400', 'unit': 'g'},
            {'name': 'beef mince', 'quantity': '500', 'unit': 'g'},
            {'name': 'onion, diced', 'quantity': '1', 'unit': ''},
            {'name': 'garlic cloves, minced', 'quantity': '3', 'unit': ''},
            {'name': 'tinned chopped tomatoes', 'quantity': '400', 'unit': 'g'},
            {'name': 'tomato puree', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'dried oregano', 'quantity': '1', 'unit': 'tsp'},
            {'name': 'olive oil', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'salt and pepper', 'quantity': '', 'unit': 'to taste'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Heat olive oil in a large pan over medium heat. Add diced onion and cook for 5 minutes until softened.'},
            {'step_number': 2, 'instruction': 'Add minced garlic and cook for 1 minute until fragrant.'},
            {'step_number': 3, 'instruction': 'Add the beef mince, breaking it up with a wooden spoon. Cook until browned, about 8 minutes.'},
            {'step_number': 4, 'instruction': 'Stir in the chopped tomatoes, tomato puree, and oregano. Season with salt and pepper.'},
            {'step_number': 5, 'instruction': 'Reduce heat to low, cover, and simmer for 30 minutes, stirring occasionally.'},
            {'step_number': 6, 'instruction': 'Meanwhile, cook spaghetti according to packet instructions. Drain and serve topped with the sauce.'},
        ],
    },
    {
        'title': 'Avocado Toast with Poached Eggs',
        'description': 'A nutritious breakfast with creamy avocado and perfectly poached eggs on sourdough.',
        'image_url': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600',
        'category': 'breakfast',
        'difficulty': 'easy',
        'prep_time_minutes': 5,
        'cook_time_minutes': 10,
        'servings': 2,
        'calories_per_serving': 320,
        'tags': ['healthy', 'quick', 'vegetarian', 'high-protein'],
        'ingredients': [
            {'name': 'ripe avocado', 'quantity': '1', 'unit': ''},
            {'name': 'slices sourdough bread', 'quantity': '2', 'unit': ''},
            {'name': 'eggs', 'quantity': '2', 'unit': ''},
            {'name': 'lemon juice', 'quantity': '1', 'unit': 'tsp'},
            {'name': 'chilli flakes', 'quantity': '1/4', 'unit': 'tsp'},
            {'name': 'salt and pepper', 'quantity': '', 'unit': 'to taste'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Toast the sourdough bread until golden and crisp.'},
            {'step_number': 2, 'instruction': 'Halve the avocado, remove the stone, and scoop the flesh into a bowl. Mash with lemon juice, salt, and pepper.'},
            {'step_number': 3, 'instruction': 'Bring a pan of water to a gentle simmer. Create a swirl and crack an egg into the centre. Poach for 3-4 minutes.'},
            {'step_number': 4, 'instruction': 'Spread the mashed avocado on the toast, top with the poached egg, and sprinkle with chilli flakes.'},
        ],
    },
    {
        'title': 'Chicken Stir-Fry',
        'description': 'A quick and colourful stir-fry packed with vegetables and tender chicken in a soy-ginger sauce.',
        'image_url': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600',
        'category': 'dinner',
        'difficulty': 'easy',
        'prep_time_minutes': 15,
        'cook_time_minutes': 10,
        'servings': 3,
        'calories_per_serving': 380,
        'tags': ['asian', 'quick', 'high-protein', 'healthy'],
        'ingredients': [
            {'name': 'chicken breast, sliced', 'quantity': '400', 'unit': 'g'},
            {'name': 'mixed peppers, sliced', 'quantity': '2', 'unit': ''},
            {'name': 'broccoli florets', 'quantity': '150', 'unit': 'g'},
            {'name': 'soy sauce', 'quantity': '3', 'unit': 'tbsp'},
            {'name': 'fresh ginger, grated', 'quantity': '1', 'unit': 'tbsp'},
            {'name': 'garlic cloves, minced', 'quantity': '2', 'unit': ''},
            {'name': 'sesame oil', 'quantity': '1', 'unit': 'tbsp'},
            {'name': 'cornflour', 'quantity': '1', 'unit': 'tsp'},
            {'name': 'cooked rice, to serve', 'quantity': '', 'unit': ''},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Mix soy sauce, grated ginger, and cornflour in a small bowl to make the sauce.'},
            {'step_number': 2, 'instruction': 'Heat sesame oil in a wok or large frying pan over high heat.'},
            {'step_number': 3, 'instruction': 'Add sliced chicken and stir-fry for 4-5 minutes until cooked through. Remove and set aside.'},
            {'step_number': 4, 'instruction': 'Add peppers and broccoli to the wok. Stir-fry for 3 minutes.'},
            {'step_number': 5, 'instruction': 'Return the chicken, pour in the sauce, and toss everything together for 1-2 minutes. Serve over rice.'},
        ],
    },
    {
        'title': 'Banana Oat Pancakes',
        'description': 'Fluffy, healthy pancakes made with oats and ripe bananas. No refined flour needed!',
        'image_url': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600',
        'category': 'breakfast',
        'difficulty': 'easy',
        'prep_time_minutes': 5,
        'cook_time_minutes': 10,
        'servings': 2,
        'calories_per_serving': 280,
        'tags': ['healthy', 'gluten-free', 'quick', 'vegetarian'],
        'ingredients': [
            {'name': 'ripe bananas', 'quantity': '2', 'unit': ''},
            {'name': 'rolled oats', 'quantity': '80', 'unit': 'g'},
            {'name': 'eggs', 'quantity': '2', 'unit': ''},
            {'name': 'baking powder', 'quantity': '1/2', 'unit': 'tsp'},
            {'name': 'cinnamon', 'quantity': '1/4', 'unit': 'tsp'},
            {'name': 'honey or maple syrup', 'quantity': '', 'unit': 'to serve'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Blend the oats into a flour using a blender.'},
            {'step_number': 2, 'instruction': 'Add bananas, eggs, baking powder, and cinnamon. Blend until smooth.'},
            {'step_number': 3, 'instruction': 'Heat a non-stick pan over medium heat. Pour small circles of batter.'},
            {'step_number': 4, 'instruction': 'Cook for 2 minutes per side until golden. Serve with honey or fresh fruit.'},
        ],
    },
    {
        'title': 'Mediterranean Chickpea Salad',
        'description': 'A refreshing and filling salad with chickpeas, feta, olives, and a lemony dressing.',
        'image_url': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600',
        'category': 'salad',
        'difficulty': 'easy',
        'prep_time_minutes': 10,
        'cook_time_minutes': 0,
        'servings': 2,
        'calories_per_serving': 340,
        'tags': ['vegetarian', 'healthy', 'no-cook', 'meal-prep'],
        'ingredients': [
            {'name': 'tinned chickpeas, drained', 'quantity': '400', 'unit': 'g'},
            {'name': 'cherry tomatoes, halved', 'quantity': '150', 'unit': 'g'},
            {'name': 'cucumber, diced', 'quantity': '1/2', 'unit': ''},
            {'name': 'red onion, finely sliced', 'quantity': '1/4', 'unit': ''},
            {'name': 'feta cheese, crumbled', 'quantity': '80', 'unit': 'g'},
            {'name': 'kalamata olives', 'quantity': '50', 'unit': 'g'},
            {'name': 'olive oil', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'lemon juice', 'quantity': '1', 'unit': 'tbsp'},
            {'name': 'dried oregano', 'quantity': '1/2', 'unit': 'tsp'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Combine chickpeas, tomatoes, cucumber, onion, feta, and olives in a large bowl.'},
            {'step_number': 2, 'instruction': 'Whisk together olive oil, lemon juice, oregano, salt, and pepper.'},
            {'step_number': 3, 'instruction': 'Pour the dressing over the salad and toss gently. Serve immediately or refrigerate for later.'},
        ],
    },
    {
        'title': 'Creamy Tomato Soup',
        'description': 'Velvety smooth tomato soup perfect for a cosy lunch. Great with crusty bread.',
        'image_url': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600',
        'category': 'soup',
        'difficulty': 'easy',
        'prep_time_minutes': 10,
        'cook_time_minutes': 25,
        'servings': 4,
        'calories_per_serving': 210,
        'tags': ['vegetarian', 'comfort-food', 'budget-friendly'],
        'ingredients': [
            {'name': 'tinned chopped tomatoes', 'quantity': '800', 'unit': 'g'},
            {'name': 'onion, diced', 'quantity': '1', 'unit': ''},
            {'name': 'garlic cloves', 'quantity': '2', 'unit': ''},
            {'name': 'vegetable stock', 'quantity': '300', 'unit': 'ml'},
            {'name': 'double cream', 'quantity': '100', 'unit': 'ml'},
            {'name': 'butter', 'quantity': '1', 'unit': 'tbsp'},
            {'name': 'sugar', 'quantity': '1', 'unit': 'tsp'},
            {'name': 'fresh basil leaves', 'quantity': '', 'unit': 'handful'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Melt butter in a pot. Cook onion and garlic until soft, about 5 minutes.'},
            {'step_number': 2, 'instruction': 'Add tinned tomatoes, stock, and sugar. Bring to a boil then simmer for 20 minutes.'},
            {'step_number': 3, 'instruction': 'Blend with a stick blender until smooth. Stir in the cream and season.'},
            {'step_number': 4, 'instruction': 'Ladle into bowls and garnish with fresh basil leaves.'},
        ],
    },
    {
        'title': 'Teriyaki Salmon with Rice',
        'description': 'Glazed teriyaki salmon fillets served with steamed rice and pak choi.',
        'image_url': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600',
        'category': 'dinner',
        'difficulty': 'medium',
        'prep_time_minutes': 10,
        'cook_time_minutes': 15,
        'servings': 2,
        'calories_per_serving': 580,
        'tags': ['asian', 'high-protein', 'omega-3', 'healthy'],
        'ingredients': [
            {'name': 'salmon fillets', 'quantity': '2', 'unit': ''},
            {'name': 'soy sauce', 'quantity': '3', 'unit': 'tbsp'},
            {'name': 'mirin', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'honey', 'quantity': '1', 'unit': 'tbsp'},
            {'name': 'rice', 'quantity': '200', 'unit': 'g'},
            {'name': 'pak choi', 'quantity': '2', 'unit': 'heads'},
            {'name': 'sesame seeds', 'quantity': '1', 'unit': 'tsp'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Mix soy sauce, mirin, and honey to make the teriyaki glaze.'},
            {'step_number': 2, 'instruction': 'Cook rice according to packet instructions.'},
            {'step_number': 3, 'instruction': 'Pan-fry salmon skin-side down for 3 minutes, flip, and pour glaze over. Cook 4-5 more minutes.'},
            {'step_number': 4, 'instruction': 'Steam pak choi for 2 minutes. Serve salmon on rice with pak choi, drizzle remaining glaze, and sprinkle sesame seeds.'},
        ],
    },
    {
        'title': 'Chocolate Mug Cake',
        'description': 'A rich, fudgy chocolate cake ready in under 5 minutes. Perfect for instant cravings.',
        'image_url': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600',
        'category': 'dessert',
        'difficulty': 'easy',
        'prep_time_minutes': 3,
        'cook_time_minutes': 2,
        'servings': 1,
        'calories_per_serving': 390,
        'tags': ['quick', 'dessert', 'chocolate', 'single-serving'],
        'ingredients': [
            {'name': 'plain flour', 'quantity': '4', 'unit': 'tbsp'},
            {'name': 'cocoa powder', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'sugar', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'milk', 'quantity': '3', 'unit': 'tbsp'},
            {'name': 'vegetable oil', 'quantity': '2', 'unit': 'tbsp'},
            {'name': 'vanilla extract', 'quantity': '1/4', 'unit': 'tsp'},
            {'name': 'baking powder', 'quantity': '1/4', 'unit': 'tsp'},
        ],
        'steps': [
            {'step_number': 1, 'instruction': 'Mix all dry ingredients in a microwave-safe mug.'},
            {'step_number': 2, 'instruction': 'Add milk, oil, and vanilla. Stir until smooth with no lumps.'},
            {'step_number': 3, 'instruction': 'Microwave on high for 90 seconds. Let it rest for 30 seconds before eating.'},
        ],
    },
]


COOKING_HACKS = [
    {
        'title': 'Ripen avocados faster with a banana',
        'description': 'Place an unripe avocado in a paper bag with a banana. The ethylene gas from the banana speeds up ripening — ready in 1-2 days instead of a week.',
        'category': 'time_saving',
        'tags': ['avocado', 'fruit', 'ripening'],
    },
    {
        'title': 'Freeze herbs in olive oil',
        'description': 'Chop fresh herbs and pack them into ice cube trays, then fill with olive oil and freeze. Pop them straight into the pan for instant flavour.',
        'category': 'storage',
        'tags': ['herbs', 'freezing', 'meal-prep'],
    },
    {
        'title': 'Use pasta water as sauce thickener',
        'description': 'The starchy pasta water is liquid gold. Add a splash to your sauce before draining — it helps the sauce cling to the pasta beautifully.',
        'category': 'technique',
        'tags': ['pasta', 'sauce', 'italian'],
    },
    {
        'title': 'Peel ginger with a spoon',
        'description': 'A spoon follows the contours of ginger perfectly, removing the skin with minimal waste — much better than a peeler.',
        'category': 'technique',
        'tags': ['ginger', 'prep', 'zero-waste'],
    },
    {
        'title': 'Swap butter for Greek yoghurt in baking',
        'description': 'Replace half the butter with Greek yoghurt in cakes and muffins. Cuts calories and fat while keeping things moist.',
        'category': 'substitution',
        'tags': ['baking', 'healthy', 'low-fat'],
    },
    {
        'title': 'Keep brown sugar soft with bread',
        'description': 'Place a slice of bread in your brown sugar container. The moisture from the bread stops the sugar from turning into a rock.',
        'category': 'storage',
        'tags': ['sugar', 'storage', 'baking'],
    },
    {
        'title': 'Batch cook grains on Sunday',
        'description': 'Cook a big batch of rice, quinoa, or couscous on Sunday. Portion and refrigerate — saves 20+ minutes on weeknight dinners.',
        'category': 'time_saving',
        'tags': ['meal-prep', 'grains', 'batch-cooking'],
    },
    {
        'title': 'Buy frozen vegetables to save money',
        'description': 'Frozen veg is just as nutritious as fresh, lasts months, and costs up to 50% less. Perfect for stir-fries, soups, and curries.',
        'category': 'money_saving',
        'tags': ['budget', 'vegetables', 'frozen'],
    },
    {
        'title': 'Use a damp paper towel to revive stale bread',
        'description': 'Wrap stale bread in a damp paper towel and microwave for 10 seconds. The steam brings it back to life.',
        'category': 'technique',
        'tags': ['bread', 'microwave', 'zero-waste'],
    },
    {
        'title': 'Add a pinch of salt to coffee',
        'description': 'A tiny pinch of salt in your coffee grounds before brewing cuts bitterness and enhances flavour. No sugar needed.',
        'category': 'health',
        'tags': ['coffee', 'drinks', 'low-sugar'],
    },
    {
        'title': 'Line baking trays with parchment for easy cleanup',
        'description': 'Always use baking parchment or silicone mats on your trays. Food slides right off and cleanup takes seconds.',
        'category': 'cleanup',
        'tags': ['baking', 'cleanup', 'kitchen'],
    },
    {
        'title': 'Use lemon juice to stop avocado browning',
        'description': 'Squeeze lemon or lime juice over cut avocado. The citric acid slows oxidation and keeps it green for hours.',
        'category': 'storage',
        'tags': ['avocado', 'freshness', 'citrus'],
    },
]


class Command(BaseCommand):
    help = 'Seed the database with sample recipes and cooking hacks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing cook data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing cook data...')
            Recipe.objects.all().delete()
            CookingHack.objects.all().delete()

        self.stdout.write('Seeding recipes...')
        for recipe_data in RECIPES:
            ingredients_data = recipe_data.pop('ingredients', [])
            steps_data = recipe_data.pop('steps', [])

            recipe, created = Recipe.objects.get_or_create(
                title=recipe_data['title'],
                defaults=recipe_data,
            )
            if created:
                for idx, ing in enumerate(ingredients_data):
                    RecipeIngredient.objects.create(recipe=recipe, order=idx, **ing)
                for step in steps_data:
                    RecipeStep.objects.create(recipe=recipe, **step)
                self.stdout.write(f'  Created: {recipe.title}')
            else:
                self.stdout.write(f'  Exists:  {recipe.title}')

            # Re-add the popped keys for idempotency if command reruns in same process
            recipe_data['ingredients'] = ingredients_data
            recipe_data['steps'] = steps_data

        self.stdout.write('Seeding cooking hacks...')
        for hack_data in COOKING_HACKS:
            hack, created = CookingHack.objects.get_or_create(
                title=hack_data['title'],
                defaults=hack_data,
            )
            if created:
                self.stdout.write(f'  Created: {hack.title}')
            else:
                self.stdout.write(f'  Exists:  {hack.title}')

        self.stdout.write(self.style.SUCCESS('Done! Seeded recipes and cooking hacks.'))
