/**
 * Root Layout - Main Entry Point for Expo Router
 * Wraps the entire app with providers and sets up navigation
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Stack, Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, spacing, shadows } from '../src/theme';

// Conditionally import Ionicons only on native platforms
const Ionicons = Platform.select({
  web: null,
  default: require('@expo/vector-icons').Ionicons,
}) as any;

type TabIconProps = {
  name?: keyof any;
  focused: boolean;
};

const TabIcon: React.FC<TabIconProps> = ({ name = 'square', focused }) => {
  if (!Ionicons) {
    // Fallback for web - simple colored circle
    return (
      <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
        <View style={{ width: 20, height: 20, backgroundColor: focused ? colors.primary.dark : colors.neutral.darkGray, borderRadius: 4 }} />
      </View>
    );
  }

  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Ionicons
        name={name}
        size={24}
        color={focused ? colors.neutral.white : colors.neutral.darkGray}
      />
    </View>
  );
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.primary.dark} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary.dark,
          tabBarInactiveTintColor: colors.neutral.darkGray,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarShowLabel: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="foodx"
          options={{
            title: 'FoodX',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="cook"
          options={{
            title: 'Cook',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'restaurant' : 'restaurant-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            title: 'Pantry',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'cart' : 'cart-outline'} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'people' : 'people-outline'} focused={focused} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: colors.neutral.white,
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingTop: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    ...shadows.lg,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerActive: {
    backgroundColor: colors.primary.dark,
  },
});
