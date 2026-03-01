from django.contrib import admin
from .models import Recipe, RecipeIngredient, RecipeStep, RecipeFavourite, CookingHack


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 1


class RecipeStepInline(admin.TabularInline):
    model = RecipeStep
    extra = 1


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'difficulty', 'created_by', 'is_public', 'created_at']
    list_filter = ['category', 'difficulty', 'is_public']
    search_fields = ['title', 'description']
    inlines = [RecipeIngredientInline, RecipeStepInline]


@admin.register(RecipeFavourite)
class RecipeFavouriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'recipe', 'created_at']


@admin.register(CookingHack)
class CookingHackAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'is_active']
    search_fields = ['title', 'description']
