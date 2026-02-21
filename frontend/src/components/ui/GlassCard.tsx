/**
 * GlassCard - Enhanced glassmorphic card with configurable blur and glow.
 * Uses BlurView on native, solid fallback on web.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { borderRadius as br, spacing, shadows, glassShadows, glass } from '@/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  blur?: 'subtle' | 'medium' | 'heavy';
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  noBorder?: boolean;
}

const PADDING_MAP = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  onPress,
  blur = 'medium',
  glow = false,
  padding = 'md',
  noBorder = false,
}) => {
  const { colors, isDark } = useTheme();

  const intensity = glass.blur[blur];

  const overlayColor = isDark
    ? colors.surface.glass
    : colors.surface.glass;

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface.card,
    borderRadius: br.xl,
    borderWidth: noBorder ? 0 : glass.borderWidth,
    borderColor: colors.surface.glassBorder,
    overflow: 'hidden',
    ...(glow ? glassShadows.glow : shadows.md),
  };

  const inner = (
    <>
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={intensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
      <View style={{ padding: PADDING_MAP[padding] }}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} style={[cardStyle, style]}>
        {inner}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{inner}</View>;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default GlassCard;
