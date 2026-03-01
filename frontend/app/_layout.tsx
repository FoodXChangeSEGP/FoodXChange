import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/theme';
import { GlassTabBar } from '../src/components/ui';
import { EmailVerificationBanner } from '../src/components';
import { useAuthStore, useMyListStore } from '../src/store';
import { AuthScreen } from '../src/screens';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colors, isDark } = useTheme();
  const { initAuth, isAuthenticated, isLoading } = useAuthStore();
  const { fetchLists } = useMyListStore();

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
    if ((fontsLoaded || fontError || Platform.OS === 'web') && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  useEffect(() => {
    initAuth().then(() => {
      // After auth resolves, pre-load the user's lists so isSaved() works everywhere
      fetchLists().catch(() => {});
    });
  }, []);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') return null;
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <AuthScreen onSuccess={() => {}} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <EmailVerificationBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          sceneStyle: { backgroundColor: colors.surface.background },
        }}
        tabBar={(props) => <GlassTabBar {...(props as any)} />}
      >
        <Tabs.Screen
          name="cart"
          options={{
            href: null,
          }}
        />
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
          name="mylist"
          options={{
            title: 'My List',
          }}
        />
        <Tabs.Screen
          name="compare"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="cook"
          options={{
            title: 'Cook',
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
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
