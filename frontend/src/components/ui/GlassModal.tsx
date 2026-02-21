/**
 * GlassModal - Glassmorphic modal with slide-up animation.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Platform, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { glass, borderRadius, spacing, typography, shadows } from '@/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  fullScreen?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const GlassModal: React.FC<GlassModalProps> = ({
  visible,
  onClose,
  children,
  title,
  fullScreen = false,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={fullScreen ? 'fullScreen' : 'pageSheet'}
      transparent={!fullScreen}
      onRequestClose={onClose}
    >
      {!fullScreen && (
        <View style={styles.backdrop} />
      )}
      <View style={[
        styles.container,
        !fullScreen && styles.sheetContainer,
        { paddingBottom: insets.bottom },
      ]}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={glass.blur.heavy}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: isDark
              ? 'rgba(15, 23, 42, 0.92)'
              : 'rgba(255, 255, 255, 0.92)',
          },
        ]} />

        {/* Handle bar */}
        {!fullScreen && (
          <View style={styles.handleContainer}>
            <View style={[
              styles.handle,
              { backgroundColor: colors.neutral.gray + '40' },
            ]} />
          </View>
        )}

        {/* Header */}
        {title && (
          <View style={[styles.header, { borderBottomColor: colors.surface.glassBorder }]}>
            <Text style={[styles.title, { color: colors.neutral.charcoal }]}>
              {title}
            </Text>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <View style={[
                styles.closeCircle,
                { backgroundColor: colors.neutral.lightGray + '60' },
              ]}>
                <Ionicons name="close" size={18} color={colors.neutral.charcoal} />
              </View>
            </AnimatedPressable>
          </View>
        )}

        {/* No title - just close button */}
        {!title && (
          <View style={styles.closeOnlyHeader}>
            <AnimatedPressable onPress={onClose} style={styles.closeButton}>
              <View style={[
                styles.closeCircle,
                { backgroundColor: colors.neutral.lightGray + '60' },
              ]}>
                <Ionicons name="close" size={18} color={colors.neutral.charcoal} />
              </View>
            </AnimatedPressable>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  sheetContainer: {
    marginTop: 60,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    ...shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  closeOnlyHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    flex: 1,
    letterSpacing: typography.letterSpacing.tight,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});

export default GlassModal;
