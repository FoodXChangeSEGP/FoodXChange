/**
 * Pantry Tab (Placeholder)
 * Shopping cart & lists now live in FoodX tab
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

export default function PantryTab() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pantry</Text>
          <Text style={styles.headerSubtitle}>
            Track What You Have
          </Text>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.comingSoonBanner}>
          <Ionicons name="file-tray-stacked-outline" size={48} color={colors.neutral.white} />
          <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
          <Text style={styles.comingSoonText}>
            Keep track of what's in your pantry and reduce food waste
          </Text>
        </View>

        {/* Feature Preview Cards */}
        <PlaceholderCard
          title="Pantry Tracker"
          description="Log what you have at home and get alerts before items expire"
          icon="time-outline"
          color={colors.accent.orange}
        />

        <PlaceholderCard
          title="Smart Suggestions"
          description="Get recipe ideas based on what's already in your pantry"
          icon="bulb-outline"
          color={colors.primary.dark}
        />

        <PlaceholderCard
          title="Waste Reduction"
          description="Track your food waste and see how much you save over time"
          icon="leaf-outline"
          color={colors.accent.lime}
        />

        <PlaceholderCard
          title="Shopping Cart"
          description="Your shopping cart and price comparison have moved to the FoodX tab"
          icon="cart-outline"
          color={colors.semantic.info}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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
