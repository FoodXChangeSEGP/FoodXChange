import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { glass, glassShadows, borderRadius, spacing, typography, textFont } from '@/theme';
import { AnimatedPressable } from './AnimatedPressable';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  badge?: number;
}

const TAB_ICONS: Record<string, TabConfig> = {
  index: { icon: 'home-outline', iconFocused: 'home' },
  search: { icon: 'search-outline', iconFocused: 'search' },
  mylist: { icon: 'bookmark-outline', iconFocused: 'bookmark' },
  community: { icon: 'people-outline',      iconFocused: 'people' },
};

export const GlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter(
    (route) => TAB_ICONS[route.name] !== undefined,
  );

  // On web we simulate frosted glass with a high-opacity background + CSS backdrop-filter.
  // On native, BlurView provides the real blur.
  const webGlassStyle: ViewStyle = Platform.OS === 'web'
    ? ({
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      } as any)
    : {};

  return (
    <View style={[
      styles.container,
      {
        bottom: Math.max(insets.bottom, 12),
        ...glassShadows.float,
        // Stronger shadow for the floating glass panel
        shadowOpacity: 0.22,
        shadowRadius: 30,
        elevation: 16,
      },
    ]}>
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={glass.blur.extreme}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius['2xl'] }]}
        />
      ) : null}
      <View style={[
        styles.overlay,
        {
          backgroundColor: isDark
            ? 'rgba(8, 14, 30, 0.93)'
            : 'rgba(246, 248, 252, 0.94)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.10)'
            : 'rgba(255, 255, 255, 0.70)',
          borderWidth: 1.5,
        },
        webGlassStyle,
      ]} />
      <View style={styles.tabs}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.indexOf(route);
          const isFocused = state.index === routeIndex;
          const options = descriptors[route.key]?.options;
          const label = (options?.tabBarLabel as string) || options?.title || route.name;
          const config = TAB_ICONS[route.name] || { icon: 'ellipse-outline', iconFocused: 'ellipse' };
          const badge = (options as any)?.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <AnimatedPressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
            >
              <View style={[
                styles.iconContainer,
                isFocused && {
                  backgroundColor: colors.primary.main,
                  shadowColor: colors.primary.glow,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 4,
                },
              ]}>
                <Ionicons
                  name={isFocused ? config.iconFocused : config.icon}
                  size={22}
                  color={isFocused ? '#FFFFFF' : colors.neutral.gray}
                />
                {badge != null && badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.primary.main }]}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.label,
                {
                  color: isFocused ? colors.primary.main : colors.neutral.gray,
                  fontWeight: isFocused ? typography.fontWeight.semibold : typography.fontWeight.regular,
                },
              ]}>
                {label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 68,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius['2xl'],
    borderWidth: glass.borderWidth,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: spacing.xs,
  },
  iconContainer: {
    width: 44,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...textFont.medium,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default GlassTabBar;
