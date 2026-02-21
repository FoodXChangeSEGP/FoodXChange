/**
 * Root Layout - Glassmorphic Tab Navigator
 * 5 visible tabs, floating glass tab bar, Space Grotesk font
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/theme';
import { GlassTabBar } from '../src/components/ui';
import { useCartStore, useAuthStore } from '../src/store';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const cartCount = useCartStore((s) => s.items.length);
  const initAuth = useAuthStore((s) => s.initAuth);

  // On web, fonts are loaded via Google Fonts CDN (injected below).
  // On native, we load the bundled TTF files.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS !== 'web'
      ? {
          'SpaceGrotesk-Regular':  require('../assets/fonts/SpaceGrotesk-Regular.ttf'),
          'SpaceGrotesk-Medium':   require('../assets/fonts/SpaceGrotesk-Medium.ttf'),
          'SpaceGrotesk-SemiBold': require('../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
          'SpaceGrotesk-Bold':     require('../assets/fonts/SpaceGrotesk-Bold.ttf'),
        }
      : {}
  );

  useEffect(() => {
    // Inject Google Fonts for web so Space Grotesk loads from CDN
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (!document.getElementById('space-grotesk-gfont')) {
        const link = document.createElement('link');
        link.id = 'space-grotesk-gfont';
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap';
        document.head.appendChild(link);
      }
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || Platform.OS === 'web') SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Restore auth session on app startup
  useEffect(() => {
    initAuth();
  }, []);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          sceneStyle: { backgroundColor: colors.surface.background },
        }}
        tabBar={(props) => <GlassTabBar {...(props as any)} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: 'Cart',
            tabBarBadge: cartCount > 0 ? cartCount : undefined,
          }}
        />
        <Tabs.Screen
          name="mylist"
          options={{
            title: 'My List',
          }}
        />
        <Tabs.Screen
          name="compare"
          options={{
            title: 'Compare',
          }}
        />
      </Tabs>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
