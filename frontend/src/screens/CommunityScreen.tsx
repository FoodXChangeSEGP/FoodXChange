/**
 * Community Screen (Placeholder)
 * My FoodX Community - local markets, co-ops, and community food spaces
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import { PlaceholderCard } from '@/components';

export const CommunityScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>
            My FoodX Neighbourhood
          </Text>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.comingSoonBanner}>
          <Ionicons name="people-outline" size={48} color={colors.neutral.white} />
          <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
          <Text style={styles.comingSoonText}>
            Connect with local food communities and discover sustainable options
          </Text>
        </View>

        {/* Feature Preview Cards */}
        <PlaceholderCard
          title="Local Markets"
          description="Find farmers markets and local producers near you"
          icon="location-outline"
          color={colors.accent.lime}
        />

        <PlaceholderCard
          title="Food Co-ops"
          description="Join community buying groups for better prices"
          icon="storefront-outline"
          color={colors.primary.dark}
        />

        <PlaceholderCard
          title="Community Groups"
          description="Connect with others who share your food values"
          icon="chatbubbles-outline"
          color={colors.accent.orange}
        />

        <PlaceholderCard
          title="Events"
          description="Discover local food events and workshops"
          icon="calendar-outline"
          color={colors.semantic.info}
        />

        {/* Map Preview Placeholder */}
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={64} color={colors.neutral.gray} />
          <Text style={styles.mapPlaceholderText}>
            Interactive map will appear here
          </Text>
          <TouchableOpacity style={styles.mapButton}>
            <Ionicons name="navigate-outline" size={20} color={colors.neutral.white} />
            <Text style={styles.mapButtonText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
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
  mapPlaceholder: {
    backgroundColor: colors.neutral.lightGray,
    borderRadius: borderRadius.xl,
    padding: spacing['3xl'],
    alignItems: 'center',
    marginTop: spacing.md,
  },
  mapPlaceholderText: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  mapButtonText: {
    color: colors.neutral.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginLeft: spacing.sm,
  },
});

export default CommunityScreen;
