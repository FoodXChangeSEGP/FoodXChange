from django.db import models
from django.conf import settings


class Recipe(models.Model):
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    CATEGORY_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snack', 'Snack'),
        ('dessert', 'Dessert'),
        ('drink', 'Drink'),
        ('side', 'Side Dish'),
        ('soup', 'Soup'),
        ('salad', 'Salad'),
        ('vegetarian', 'Vegetarian'),
        ('vegan', 'Vegan'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=500, blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='easy')
    prep_time_minutes = models.PositiveIntegerField(default=0, help_text='Preparation time in minutes')
    cook_time_minutes = models.PositiveIntegerField(default=0, help_text='Cooking time in minutes')
    servings = models.PositiveIntegerField(default=1)
    calories_per_serving = models.PositiveIntegerField(null=True, blank=True)
    source_url = models.URLField(max_length=500, blank=True, help_text='Original recipe URL if imported')
    tags = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_recipes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def total_time_minutes(self):
        return self.prep_time_minutes + self.cook_time_minutes

    @property
    def favourite_count(self):
        return self.favourites.count()


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=50, blank=True, help_text='e.g. "2", "1/2"')
    unit = models.CharField(max_length=50, blank=True, help_text='e.g. "cups", "tbsp"')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        parts = [self.quantity, self.unit, self.name]
        return ' '.join(p for p in parts if p)


class RecipeStep(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='steps')
    step_number = models.PositiveIntegerField()
    instruction = models.TextField()
    image_url = models.URLField(max_length=500, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['step_number']

    def __str__(self):
        return f'Step {self.step_number}: {self.instruction[:50]}'


class RecipeFavourite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='favourite_recipes',
    )
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='favourites')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'recipe')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} \u2665 {self.recipe.title}'


class CookingHack(models.Model):
    CATEGORY_CHOICES = [
        ('time_saving', 'Time Saving'),
        ('money_saving', 'Money Saving'),
        ('health', 'Health & Nutrition'),
        ('storage', 'Storage & Preservation'),
        ('technique', 'Cooking Technique'),
        ('substitution', 'Ingredient Substitution'),
        ('cleanup', 'Cleanup & Organisation'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=300)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    image_url = models.URLField(max_length=500, blank=True)
    tags = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
