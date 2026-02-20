/**
 * MyList Tab (Placeholder)
 * My List functionality now lives in FoodX tab
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

export default function MyListTab() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My List</Text>
          <Text style={styles.headerSubtitle}>
            Save & Organise Products
          </Text>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.comingSoonBanner}>
          <Ionicons name="list-outline" size={48} color={colors.neutral.white} />
          <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
          <Text style={styles.comingSoonText}>
            Enhanced list features are on the way. Your saved products are available in the FoodX tab.
          </Text>
        </View>

        {/* Feature Preview Cards */}
        <PlaceholderCard
          title="Smart Lists"
          description="Organise products into custom lists for different occasions"
          icon="folder-outline"
          color={colors.accent.orange}
        />

        <PlaceholderCard
          title="Price Alerts"
          description="Get notified when your saved products drop in price"
          icon="notifications-outline"
          color={colors.primary.dark}
        />

        <PlaceholderCard
          title="Share Lists"
          description="Share your favourite product lists with friends and family"
          icon="share-social-outline"
          color={colors.accent.lime}
        />

        <PlaceholderCard
          title="Product Tracking"
          description="Your saved products and comparisons are now in the FoodX tab"
          icon="bookmark-outline"
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
