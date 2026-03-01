/**
 * AddRecipeScreen — form for creating a new recipe (or importing via URL)
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import type { RecipeCategory, RecipeDifficulty, RecipeCreateData } from '@/types/cook';

const CATEGORIES: { key: RecipeCategory; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
  { key: 'soup', label: 'Soup' },
  { key: 'salad', label: 'Salad' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'other', label: 'Other' },
];

const DIFFICULTIES: { key: RecipeDifficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

interface AddRecipeScreenProps {
  onBack: () => void;
}

export const AddRecipeScreen: React.FC<AddRecipeScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { createRecipe } = useCookStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RecipeCategory>('other');
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [calories, setCalories] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [ingredients, setIngredients] = useState<{ name: string; quantity: string; unit: string }[]>([
    { name: '', quantity: '', unit: '' },
  ]);
  const [steps, setSteps] = useState<{ instruction: string }[]>([{ instruction: '' }]);
  const [saving, setSaving] = useState(false);

  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', quantity: '', unit: '' }]);
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: string, value: string) =>
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)));

  const addStep = () => setSteps((prev) => [...prev, { instruction: '' }]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, value: string) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { instruction: value } : s)));

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a recipe title.');
      return;
    }

    setSaving(true);
    const data: RecipeCreateData = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      difficulty,
      prep_time_minutes: parseInt(prepTime, 10) || 0,
      cook_time_minutes: parseInt(cookTime, 10) || 0,
      servings: parseInt(servings, 10) || 1,
      calories_per_serving: calories ? parseInt(calories, 10) : null,
      image_url: imageUrl.trim() || undefined,
      source_url: sourceUrl.trim() || undefined,
      is_public: true,
      ingredients: ingredients
        .filter((ig) => ig.name.trim())
        .map((ig, idx) => ({ name: ig.name, quantity: ig.quantity, unit: ig.unit, order: idx + 1, step_number: 0 })),
      steps: steps
        .filter((s) => s.instruction.trim())
        .map((s, idx) => ({
          step_number: idx + 1,
          instruction: s.instruction,
          image_url: '',
          duration_minutes: null,
        })),
    };

    const result = await createRecipe(data);
    setSaving(false);
    if (result) {
      onBack();
    } else {
      Alert.alert('Error', 'Failed to save recipe. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.surface.glassBorder }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }, textFont.semibold]}>
          Add Recipe
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: colors.primary.main, opacity: saving ? 0.5 : 1 }]}
        >
          <Text style={[styles.saveBtnText, textFont.semibold]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <Field label="Title *">
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
            value={title}
            onChangeText={setTitle}
            placeholder="Recipe name"
            placeholderTextColor={colors.neutral.gray}
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description"
            placeholderTextColor={colors.neutral.gray}
            multiline
            numberOfLines={3}
          />
        </Field>

        {/* Category */}
        <Field label="Category">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: category === c.key ? colors.primary.main : colors.surface.card,
                      borderColor: category === c.key ? colors.primary.main : colors.surface.glassBorder,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: category === c.key ? '#FFF' : colors.neutral.darkGray }, textFont.medium]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Field>

        {/* Difficulty */}
        <Field label="Difficulty">
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDifficulty(d.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: difficulty === d.key ? colors.primary.main : colors.surface.card,
                    borderColor: difficulty === d.key ? colors.primary.main : colors.surface.glassBorder,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: difficulty === d.key ? '#FFF' : colors.neutral.darkGray }, textFont.medium]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* Time & servings row */}
        <View style={styles.row}>
          <Field label="Prep (min)" flex>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
              placeholder="15"
              placeholderTextColor={colors.neutral.gray}
            />
          </Field>
          <Field label="Cook (min)" flex>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
              value={cookTime}
              onChangeText={setCookTime}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor={colors.neutral.gray}
            />
          </Field>
          <Field label="Servings" flex>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
              placeholder="4"
              placeholderTextColor={colors.neutral.gray}
            />
          </Field>
        </View>

        {/* Calories */}
        <Field label="Calories per serving (optional)">
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
            value={calories}
            onChangeText={setCalories}
            keyboardType="numeric"
            placeholder="350"
            placeholderTextColor={colors.neutral.gray}
          />
        </Field>

        {/* Image URL */}
        <Field label="Image URL (optional)">
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://..."
            placeholderTextColor={colors.neutral.gray}
            autoCapitalize="none"
          />
        </Field>

        {/* Source URL */}
        <Field label="Source URL (optional)">
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="https://..."
            placeholderTextColor={colors.neutral.gray}
            autoCapitalize="none"
          />
        </Field>

        {/* Ingredients */}
        <Field label="Ingredients">
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <TextInput
                style={[styles.input, styles.ingQty, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
                value={ing.quantity}
                onChangeText={(v) => updateIngredient(i, 'quantity', v)}
                placeholder="Qty"
                placeholderTextColor={colors.neutral.gray}
              />
              <TextInput
                style={[styles.input, styles.ingUnit, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
                value={ing.unit}
                onChangeText={(v) => updateIngredient(i, 'unit', v)}
                placeholder="Unit"
                placeholderTextColor={colors.neutral.gray}
              />
              <TextInput
                style={[styles.input, styles.ingName, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
                value={ing.name}
                onChangeText={(v) => updateIngredient(i, 'name', v)}
                placeholder="Ingredient name"
                placeholderTextColor={colors.neutral.gray}
              />
              {ingredients.length > 1 && (
                <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral.gray} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addIngredient} style={styles.addRowBtn}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary.main} />
            <Text style={[styles.addRowText, { color: colors.primary.main }, textFont.medium]}>Add ingredient</Text>
          </TouchableOpacity>
        </Field>

        {/* Steps */}
        <Field label="Steps">
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary.main + '20' }]}>
                <Text style={[styles.stepNumText, { color: colors.primary.main }, textFont.bold]}>{i + 1}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.stepInput, { backgroundColor: colors.surface.card, color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }, textFont.regular]}
                value={step.instruction}
                onChangeText={(v) => updateStep(i, v)}
                placeholder={`Step ${i + 1}`}
                placeholderTextColor={colors.neutral.gray}
                multiline
              />
              {steps.length > 1 && (
                <TouchableOpacity onPress={() => removeStep(i)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={20} color={colors.neutral.gray} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addStep} style={styles.addRowBtn}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary.main} />
            <Text style={[styles.addRowText, { color: colors.primary.main }, textFont.medium]}>Add step</Text>
          </TouchableOpacity>
        </Field>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* ─── helper ─── */
const Field: React.FC<{ label: string; flex?: boolean; children: React.ReactNode }> = ({ label, flex, children }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={[styles.label, { color: colors.neutral.darkGray }, textFont.medium]}>{label}</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
  },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: typography.fontSize.sm,
  },
  form: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  ingQty: { width: 50 },
  ingUnit: { width: 60 },
  ingName: { flex: 1 },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  stepNumText: {
    fontSize: typography.fontSize.sm,
  },
  stepInput: {
    flex: 1,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  removeBtn: {
    padding: 4,
    marginTop: spacing.sm,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addRowText: {
    fontSize: typography.fontSize.sm,
  },
});
