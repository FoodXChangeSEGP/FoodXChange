/**
 * Home Screen - 2026 Glassmorphism Design
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, typography, textFont, glassShadows } from '@/theme';
import { GlassCard, GlassModal, AnimatedPressable, ScoreBadge, PriceTag, PlaceholderCard, GradientButton } from '@/components';
import { api, Product } from '@/services/api';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store';
import { AuthScreen } from './AuthScreen';

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeaturedProducts = async () => {
    try {
      const res = await api.products.getAll({
        nutri_score: 'A',
        ordering: '-updated_at',
      });

      const productsArray: Product[] = (
        Array.isArray(res) ? res : Object.values(res)
      ).filter(
        (p): p is Product =>
          p !== null &&
          typeof p === 'object' &&
          typeof (p as any).id === 'number'
      );

      setFeaturedProducts(productsArray.slice(0, 6));
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeaturedProducts();
  };


  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface.background }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.main}
          />
        }
      >
        {/* Hero Glass Card */}
        <View style={styles.heroWrapper}>
          <GlassCard blur="medium" padding="lg">
            <View style={styles.heroInner}>
              <View style={styles.heroText}>
                <Text style={[styles.greeting, { color: colors.neutral.darkGray }]}>
                  Welcome to
                </Text>
                <Text style={[styles.appName, { color: colors.primary.main }]}>
                  FoodXchange
                </Text>
                <Text style={[styles.tagline, { color: colors.neutral.gray }]}>
                  Find healthy, affordable food
                </Text>
              </View>
              <View style={styles.heroActions}>
                <AnimatedPressable
                  onPress={() => setSettingsVisible(true)}
                >
                  <LinearGradient
                    colors={[colors.primary.main, colors.primary.light] as const}
                    style={styles.avatarGradient}
                  >
                    <View style={[styles.avatarInner, { backgroundColor: colors.surface.background }]}>
                      <Ionicons name="person" size={22} color={colors.primary.main} />
                    </View>
                  </LinearGradient>
                </AnimatedPressable>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              Featured
            </Text>
            <AnimatedPressable onPress={() => router.push('/search' as any)}>
              <Text style={[styles.seeAllText, { color: colors.primary.main }]}>
                See All
              </Text>
            </AnimatedPressable>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary.main} />
          ) : featuredProducts.length > 0 ? (
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.featuredList}
              style={styles.featuredFlatList}
              renderItem={({ item }) => (
                <GlassCard
                  blur="subtle"
                  padding="sm"
                  style={styles.featuredCard}
                  onPress={() => router.push('/search' as any)}
                >
                  <View style={[styles.featuredImageBg, { backgroundColor: colors.neutral.lightGray + '40' }]}>
                    <Ionicons name="nutrition-outline" size={32} color={colors.neutral.gray} />
                  </View>
                  <View style={styles.featuredInfo}>
                    <Text
                      style={[styles.featuredName, { color: colors.neutral.charcoal }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <View style={styles.badgeRow}>
                      <ScoreBadge type="nutri" value={item.nutri_score} size="sm" />
                      <ScoreBadge type="nova" value={item.nova_score} size="sm" />
                    </View>
                  </View>
                </GlassCard>
              )}
            />
          ) : (
            <View style={styles.sectionPad}>
              <PlaceholderCard
                title="Featured Products"
                description="Top-rated healthy products will appear here"
                icon="star-outline"
                color={colors.accent.orange}
              />
            </View>
          )}
        </View>

        {/* News & Tips */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              News & Tips
            </Text>
            <AnimatedPressable>
              <Text style={[styles.seeAllText, { color: colors.primary.main }]}>
                See All
              </Text>
            </AnimatedPressable>
          </View>

          <View style={styles.sectionPad}>
            <GlassCard blur="subtle" padding="md" style={styles.articleCard}>
              <View style={[styles.articleIcon, { backgroundColor: colors.primary.main + '15' }]}>
                <Ionicons name="flask-outline" size={24} color={colors.primary.main} />
              </View>
              <View style={styles.articleContent}>
                <Text style={[styles.articleTitle, { color: colors.neutral.charcoal }]}>
                  Understanding NOVA Scores
                </Text>
                <Text style={[styles.articleExcerpt, { color: colors.neutral.darkGray }]}>
                  Learn how food processing levels affect your health...
                </Text>
                <Text style={[styles.articleMeta, { color: colors.neutral.gray }]}>
                  5 min read
                </Text>
              </View>
            </GlassCard>

            <GlassCard blur="subtle" padding="md" style={styles.articleCard}>
              <View style={[styles.articleIcon, { backgroundColor: colors.accent.lime + '15' }]}>
                <Ionicons name="cart-outline" size={24} color={colors.accent.lime} />
              </View>
              <View style={styles.articleContent}>
                <Text style={[styles.articleTitle, { color: colors.neutral.charcoal }]}>
                  Smart Shopping Tips
                </Text>
                <Text style={[styles.articleExcerpt, { color: colors.neutral.darkGray }]}>
                  How to find the best prices while eating healthy...
                </Text>
                <Text style={[styles.articleMeta, { color: colors.neutral.gray }]}>
                  3 min read
                </Text>
              </View>
            </GlassCard>
          </View>
        </View>
      </ScrollView>

      {/* Account & Settings Modal */}
      <GlassModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        title="Settings"
      >
        <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
          {/* Account Section */}
          <Text style={[styles.settingsSectionLabel, { color: colors.neutral.gray }]}>
            Account
          </Text>
          <GlassCard blur="subtle" padding="md" style={{ marginBottom: spacing.md }}>
            {isAuthenticated && user ? (
              <View>
                <View style={styles.settingsRow}>
                  <View style={styles.settingsLeft}>
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.light] as const}
                      style={styles.accountAvatarGradient}
                    >
                      <Text style={styles.accountAvatarText}>
                        {(user.first_name?.[0] || 'U').toUpperCase()}
                      </Text>
                    </LinearGradient>
                    <View>
                      <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>
                        Hello, {user.first_name}!
                      </Text>
                      <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>
                        {user.email}
                      </Text>
                    </View>
                  </View>
                </View>
                <AnimatedPressable
                  onPress={() => {
                    logout();
                    setSettingsVisible(false);
                  }}
                  style={[styles.logoutButton, { borderColor: colors.neutral.gray + '40' }]}
                >
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                  <Text style={styles.logoutText}>Sign Out</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable
                onPress={() => {
                  setSettingsVisible(false);
                  setAuthVisible(true);
                }}
              >
                <View style={styles.settingsRow}>
                  <View style={styles.settingsLeft}>
                    <View style={[styles.settingsIconWrap, { backgroundColor: colors.primary.main + '20' }]}>
                      <Ionicons name="person-add-outline" size={20} color={colors.primary.main} />
                    </View>
                    <View>
                      <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>
                        Sign In / Sign Up
                      </Text>
                      <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>
                        Save your lists & cart across devices
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.neutral.gray} />
                </View>
              </AnimatedPressable>
            )}
          </GlassCard>

          {/* Appearance Section */}
          <Text style={[styles.settingsSectionLabel, { color: colors.neutral.gray }]}>
            Appearance
          </Text>
          <GlassCard blur="subtle" padding="md">
            <View style={styles.settingsRow}>
              <View style={styles.settingsLeft}>
                <View style={[styles.settingsIconWrap, { backgroundColor: colors.primary.main + '20' }]}>
                  <Ionicons
                    name={isDark ? 'moon' : 'sunny-outline'}
                    size={20}
                    color={colors.primary.main}
                  />
                </View>
                <View>
                  <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>
                    Dark Mode
                  </Text>
                  <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>
                    {isDark ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.neutral.lightGray, true: colors.primary.main }}
                thumbColor="#FFFFFF"
              />
            </View>
          </GlassCard>
        </ScrollView>
      </GlassModal>

      {/* Auth Modal (full-screen) */}
      <GlassModal
        visible={authVisible}
        onClose={() => setAuthVisible(false)}
        fullScreen
      >
        <AuthScreen onSuccess={() => setAuthVisible(false)} />
      </GlassModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // Hero
  heroWrapper: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroText: {
    flex: 1,
  },
  greeting: {
    ...textFont.regular,
    fontSize: typography.fontSize.md,
    letterSpacing: typography.letterSpacing.wide,
  },
  appName: {
    ...textFont.bold,
    fontSize: typography.fontSize['3xl'],
    letterSpacing: typography.letterSpacing.tight,
    marginTop: 2,
  },
  tagline: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...textFont.bold,
    fontSize: typography.fontSize.xl,
    letterSpacing: typography.letterSpacing.tight,
  },
  seeAllText: {
    ...textFont.medium,
    fontSize: typography.fontSize.base,
  },
  sectionPad: {
    paddingHorizontal: spacing.xl,
  },

  // Featured cards
  featuredFlatList: {
    backgroundColor: 'transparent',
  },
  featuredList: {
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
  },
  featuredCard: {
    width: 220,
    marginRight: spacing.md,
  },
  featuredImageBg: {
    height: 72,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featuredInfo: {
    gap: spacing.xs,
  },
  featuredName: {
    ...textFont.semibold,
    fontSize: typography.fontSize.base,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // Articles
  articleCard: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    ...textFont.semibold,
    fontSize: typography.fontSize.base,
    marginBottom: 2,
  },
  articleExcerpt: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
    marginBottom: 2,
  },
  articleMeta: {
    ...textFont.regular,
    fontSize: typography.fontSize.xs,
  },

  // Settings modal
  settingsContent: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  settingsSectionLabel: {
    ...textFont.semibold,
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    ...textFont.semibold,
    fontSize: typography.fontSize.base,
  },
  settingsSubtitle: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  accountAvatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  logoutText: {
    color: '#DC2626',
    ...textFont.semibold,
    fontSize: typography.fontSize.sm,
  },
});

export default HomeScreen;
