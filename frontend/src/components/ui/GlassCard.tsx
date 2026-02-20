/**
 * GlassCard — glassmorphic card with BlurView on native, solid fallback on web.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { borderRadius as br, spacing, shadows } from '@/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  intensity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  onPress,
  intensity = 40,
}) => {
  const { colors, isDark } = useTheme();

  const overlayColor = isDark
    ? 'rgba(22,27,34,0.75)'
    : 'rgba(255,255,255,0.80)';

  const cardStyle: ViewStyle = {
    borderRadius: br.xl,
    borderWidth: 1,
    borderColor: colors.surface.glass,
    overflow: 'hidden',
    ...shadows.md,
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
      <View style={styles.content}>{children}</View>
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
  content: {
    padding: spacing.md,
  },
});

export default GlassCard;
