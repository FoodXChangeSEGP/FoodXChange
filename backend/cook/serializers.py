from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Recipe, RecipeIngredient, RecipeStep, RecipeFavourite, CookingHack

User = get_user_model()


class RecipeIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeIngredient
        fields = ['id', 'name', 'quantity', 'unit', 'order']
        read_only_fields = ['id']


class RecipeStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeStep
        fields = ['id', 'step_number', 'instruction', 'image_url', 'duration_minutes']
        read_only_fields = ['id']


class RecipeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)
    favourite_count = serializers.IntegerField(read_only=True)
    total_time_minutes = serializers.IntegerField(read_only=True)
    is_favourited = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            'id', 'title', 'description', 'image_url', 'category',
            'difficulty', 'prep_time_minutes', 'cook_time_minutes',
            'total_time_minutes', 'servings', 'calories_per_serving',
            'tags', 'is_public', 'favourite_count',
            'created_by_username', 'is_favourited', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_is_favourited(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.favourites.filter(user=request.user).exists()
        return False


class RecipeDetailSerializer(RecipeListSerializer):
    """Full detail serializer with nested ingredients & steps."""
    ingredients = RecipeIngredientSerializer(many=True, read_only=True)
    steps = RecipeStepSerializer(many=True, read_only=True)

    class Meta(RecipeListSerializer.Meta):
        fields = RecipeListSerializer.Meta.fields + [
            'ingredients', 'steps', 'source_url', 'updated_at',
        ]


class RecipeCreateSerializer(serializers.ModelSerializer):
    """Writable serializer that accepts nested ingredients & steps."""
    ingredients = RecipeIngredientSerializer(many=True, required=False)
    steps = RecipeStepSerializer(many=True, required=False)

    class Meta:
        model = Recipe
        fields = [
            'id', 'title', 'description', 'image_url', 'category',
            'difficulty', 'prep_time_minutes', 'cook_time_minutes',
            'servings', 'calories_per_serving', 'source_url',
            'tags', 'is_public', 'ingredients', 'steps',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        ingredients_data = validated_data.pop('ingredients', [])
        steps_data = validated_data.pop('steps', [])
        recipe = Recipe.objects.create(**validated_data)
        for idx, ing in enumerate(ingredients_data):
            RecipeIngredient.objects.create(recipe=recipe, order=ing.get('order', idx), **{k: v for k, v in ing.items() if k != 'order'})
        for step in steps_data:
            RecipeStep.objects.create(recipe=recipe, **step)
        return recipe

    def update(self, instance, validated_data):
        ingredients_data = validated_data.pop('ingredients', None)
        steps_data = validated_data.pop('steps', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if ingredients_data is not None:
            instance.ingredients.all().delete()
            for idx, ing in enumerate(ingredients_data):
                RecipeIngredient.objects.create(
                    recipe=instance, order=ing.get('order', idx),
                    **{k: v for k, v in ing.items() if k != 'order'},
                )

        if steps_data is not None:
            instance.steps.all().delete()
            for step in steps_data:
                RecipeStep.objects.create(recipe=instance, **step)

        return instance


class CookingHackSerializer(serializers.ModelSerializer):
    class Meta:
        model = CookingHack
        fields = [
            'id', 'title', 'description', 'category',
            'image_url', 'tags', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
