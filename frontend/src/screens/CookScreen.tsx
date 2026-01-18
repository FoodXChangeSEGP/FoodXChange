/**
 * Cook Screen (Placeholder)
 * Recipes and cooking hacks - future feature
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import { PlaceholderCard } from '@/components';

export const CookScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cook</Text>
          <Text style={styles.headerSubtitle}>
            Recipes & Cooking Hacks
          </Text>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.comingSoonBanner}>
          <Ionicons name="restaurant-outline" size={48} color={colors.neutral.white} />
          <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
          <Text style={styles.comingSoonText}>
            Discover healthy recipes, meal plans, and cooking tips
          </Text>
        </View>

        {/* Feature Preview Cards */}
        <PlaceholderCard
          title="Smart Recipes"
          description="Find quick, healthy alternatives based on what you have"
          icon="book-outline"
          color={colors.accent.orange}
        />

        <PlaceholderCard
          title="Meal Planner"
          description="Plan your weekly meals and generate shopping lists"
          icon="calendar-outline"
          color={colors.primary.dark}
        />

        <PlaceholderCard
          title="Cook-Alongs"
          description="Join live cooking sessions with the community"
          icon="videocam-outline"
          color={colors.accent.lime}
        />

        <PlaceholderCard
          title="Import Recipes"
          description="Bring in recipes from your favorite websites"
          icon="cloud-download-outline"
          color={colors.semantic.info}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    marginTop: spacing.xs,
  },
  comingSoonBanner: {
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  comingSoonTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.white,
    marginTop: spacing.md,
  },
  comingSoonText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.white,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default CookScreen;
