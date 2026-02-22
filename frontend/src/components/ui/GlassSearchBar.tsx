import React, { useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { glass, borderRadius, spacing, typography } from '@/theme';

interface GlassSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onBarcodeScan?: () => void;
  placeholder?: string;
}

export const GlassSearchBar: React.FC<GlassSearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  onBarcodeScan,
  placeholder = 'Search products...',
}) => {
  const { colors, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={glass.blur.medium}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[
          styles.overlay,
          {
            backgroundColor: isDark
              ? 'rgba(30, 41, 59, 0.7)'
              : 'rgba(255, 255, 255, 0.7)',
            borderColor: colors.surface.glassBorder,
          },
        ]} />

        <View style={styles.inner}>
          <Ionicons
            name="search"
            size={20}
            color={colors.neutral.gray}
            style={styles.searchIcon}
          />

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            placeholder={placeholder}
            placeholderTextColor={colors.neutral.gray}
            returnKeyType="search"
            style={[
              styles.input,
              {
                color: colors.neutral.charcoal,
              },
            ]}
          />

          {value.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                onChangeText('');
                inputRef.current?.focus();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color={colors.neutral.gray} />
            </TouchableOpacity>
          )}

          {onBarcodeScan && (
            <TouchableOpacity onPress={onBarcodeScan} style={styles.barcodeButton}>
              <LinearGradient
                colors={colors.primary
                  ? [colors.primary.main, colors.primary.dark] as const
                  : ['#22C55E', '#166534'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.barcodeGradient}
              >
                <Ionicons name="barcode-outline" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  container: {
    height: 52,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.xl,
    borderWidth: glass.borderWidth,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    letterSpacing: typography.letterSpacing.normal,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  barcodeButton: {
    marginLeft: spacing.sm,
  },
  barcodeGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GlassSearchBar;
