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
import { useTheme, spacing, borderRadius, shadows, typography } from '@/theme';

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
  color,
}) => {
  const { colors } = useTheme();
  const iconColor = color ?? colors.accent.orange;
  return (
    <View style={[styles.container, { backgroundColor: colors.surface.card }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor }]}>
        <Ionicons name={icon} size={32} color={colors.neutral.white} />
      </View>
      <Text style={[styles.title, { color: colors.neutral.charcoal }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.neutral.darkGray }]}>{description}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
});

export default PlaceholderCard;
