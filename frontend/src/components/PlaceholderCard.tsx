/**
 * PlaceholderCard Component
 * Generic placeholder for features coming soon
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';

interface PlaceholderCardProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({
  title,
  description,
  icon = 'construct-outline',
  color = colors.accent.orange,
}) => {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon} size={32} color={colors.neutral.white} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
    ...shadows.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
    textAlign: 'center',
  },
});

export default PlaceholderCard;
