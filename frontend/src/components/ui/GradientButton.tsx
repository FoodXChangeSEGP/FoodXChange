/**
 * GradientButton — green gradient with AnimatedPressable.
 */

import React from 'react';
import { Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable } from './AnimatedPressable';
import { spacing, borderRadius, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: readonly [string, string, ...string[]];
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  colors = ['#16A34A', '#22C55E'] as const,
  icon,
  style,
  disabled,
}) => {
  return (
    <AnimatedPressable onPress={onPress} style={style} disabled={disabled}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, disabled && styles.disabled]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color="#FFFFFF" style={styles.icon} />
        ) : null}
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default GradientButton;
