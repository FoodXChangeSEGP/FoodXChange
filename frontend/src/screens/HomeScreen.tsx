import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, borderRadius, typography, textFont, glassShadows } from '@/theme';
import { GlassCard, GlassModal, AnimatedPressable, ScoreBadge, PriceTag, PlaceholderCard, GradientButton } from '@/components';
import { api, Product, NewsArticle } from '@/services/api';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store';
import { AuthScreen } from './AuthScreen';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetCode';

const STATIC_ARTICLES = [
  {
    title: 'Understanding NOVA Scores',
    excerpt: 'Learn how food processing levels affect your health...',
    icon_name: 'flask-outline',
    icon_color: 'primary',
    readTime: '5 min read',
  },
  {
    title: 'Smart Shopping Tips',
    excerpt: 'How to find the best prices while eating healthy...',
    icon_name: 'cart-outline',
    icon_color: 'lime',
    readTime: '3 min read',
  },
];

const DUMMY_FEATURED_PRODUCTS: Product[] = [
  {
    id: -1,
    name: 'Organic Greek Yogurt',
    description: 'Creamy high-protein yogurt for breakfast or snacks.',
    image_url: null,
    category: 'Dairy',
    nova_score: 1,
    nova_score_display: 'Unprocessed or minimally processed foods',
    nutri_score: 'A',
    nutri_score_display: 'High nutritional quality',
    barcode: null,
    unit: '500g',
    lowest_price: '2.10',
  },
  {
    id: -2,
    name: 'Wholegrain Sourdough Loaf',
    description: 'Slow-fermented wholegrain bread with added fibre.',
    image_url: null,
    category: 'Bakery',
    nova_score: 2,
    nova_score_display: 'Processed culinary ingredients',
    nutri_score: 'A',
    nutri_score_display: 'High nutritional quality',
    barcode: null,
    unit: '800g',
    lowest_price: '1.85',
  },
  {
    id: -3,
    name: 'Mixed Berry Oat Pots',
    description: 'Ready-to-eat overnight oats with berry blend.',
    image_url: null,
    category: 'Breakfast',
    nova_score: 3,
    nova_score_display: 'Processed foods',
    nutri_score: 'B',
    nutri_score_display: 'Good nutritional quality',
    barcode: null,
    unit: '2 x 125g',
    lowest_price: '1.95',
  },
  {
    id: -4,
    name: 'Roasted Pepper Hummus',
    description: 'Smooth chickpea dip with roasted red pepper.',
    image_url: null,
    category: 'Dips',
    nova_score: 3,
    nova_score_display: 'Processed foods',
    nutri_score: 'B',
    nutri_score_display: 'Good nutritional quality',
    barcode: null,
    unit: '200g',
    lowest_price: '1.50',
  },
  {
    id: -5,
    name: 'Spinach & Ricotta Ravioli',
    description: 'Fresh pasta filled with spinach and ricotta cheese.',
    image_url: null,
    category: 'Fresh Pasta',
    nova_score: 3,
    nova_score_display: 'Processed foods',
    nutri_score: 'C',
    nutri_score_display: 'Moderate nutritional quality',
    barcode: null,
    unit: '250g',
    lowest_price: '2.75',
  },
  {
    id: -6,
    name: 'Dark Chocolate Almond Bars',
    description: 'Snack bars with almonds and 70% dark chocolate.',
    image_url: null,
    category: 'Snacks',
    nova_score: 4,
    nova_score_display: 'Ultra-processed foods and drink products',
    nutri_score: 'C',
    nutri_score_display: 'Moderate nutritional quality',
    barcode: null,
    unit: '4 x 35g',
    lowest_price: '2.99',
  },
];

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<AuthMode>('signIn');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifPriceAlerts, setNotifPriceAlerts] = useState(false);

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

      const hasApiProducts = productsArray.length > 0;
      setFeaturedProducts(hasApiProducts ? productsArray.slice(0, 6) : DUMMY_FEATURED_PRODUCTS);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      setFeaturedProducts(DUMMY_FEATURED_PRODUCTS);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNewsArticles = async () => {
    try {
      const articles = await api.news.getAll();
      setNewsArticles(articles);
    } catch {
      // keep static fallback articles visible
    }
  };

  useEffect(() => {
    fetchFeaturedProducts();
    fetchNewsArticles();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeaturedProducts();
    fetchNewsArticles();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.auth.deleteAccount();
              await api.auth.logout();
              logout();
              setSettingsVisible(false);
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = () => {
    setSettingsVisible(false);
    setAuthInitialMode('forgotPassword');
    setAuthVisible(true);
  };

  const articleIconColor = (colorKey: string) => {
    switch (colorKey) {
      case 'lime': return colors.accent.lime;
      case 'orange': return colors.accent.orange;
      default: return colors.primary.main;
    }
  };

  const handleSaveUsername = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed) return;
    setSavingUsername(true);
    try {
      const updated = await api.users.updateProfile({ username: trimmed });
      useAuthStore.getState().setUser(updated);
      setEditingUsername(false);
    } catch (err: any) {
      const msg = err?.response?.data?.username?.[0] ?? 'Could not update username.';
      Alert.alert('Error', msg);
    } finally {
      setSavingUsername(false);
    }
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              News & Tips
            </Text>
          </View>

          <View style={styles.sectionPad}>
            {(newsArticles.length > 0 ? newsArticles : STATIC_ARTICLES).map((article, idx) => {
              const iconColor = 'icon_color' in article
                ? articleIconColor((article as NewsArticle).icon_color)
                : (idx === 0 ? colors.primary.main : colors.accent.lime);
              const iconName = ('icon_name' in article
                ? (article as NewsArticle).icon_name
                : (idx === 0 ? 'flask-outline' : 'cart-outline')) as any;
              const readTime = 'read_time_minutes' in article
                ? `${(article as NewsArticle).read_time_minutes} min read`
                : (article as any).readTime;
              return (
                <GlassCard key={idx} blur="subtle" padding="md" style={styles.articleCard}>
                  <View style={[styles.articleIcon, { backgroundColor: iconColor + '15' }]}>
                    <Ionicons name={iconName} size={24} color={iconColor} />
                  </View>
                  <View style={styles.articleContent}>
                    <Text style={[styles.articleTitle, { color: colors.neutral.charcoal }]}>
                      {article.title}
                    </Text>
                    <Text style={[styles.articleExcerpt, { color: colors.neutral.darkGray }]} numberOfLines={2}>
                      {article.excerpt}
                    </Text>
                    <Text style={[styles.articleMeta, { color: colors.neutral.gray }]}>
                      {readTime}
                    </Text>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <GlassModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        title="Settings"
      >
        <ScrollView style={styles.settingsContent} showsVerticalScrollIndicator={false}>
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

                {/* Username row */}
                <View style={[styles.usernameRow, { borderTopColor: colors.surface.glassBorder }]}>
                  {editingUsername ? (
                    <View style={styles.usernameEditRow}>
                      <TextInput
                        style={[styles.usernameInput, { color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder, backgroundColor: colors.neutral.lightGray + '20' }]}
                        value={newUsername}
                        onChangeText={setNewUsername}
                        placeholder="New username"
                        placeholderTextColor={colors.neutral.gray}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <AnimatedPressable
                        onPress={handleSaveUsername}
                        style={[styles.usernameAction, { backgroundColor: colors.primary.main }]}
                      >
                        {savingUsername
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={[{ color: '#fff', fontSize: typography.fontSize.sm }, textFont.semibold]}>Save</Text>
                        }
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => setEditingUsername(false)}
                        style={[styles.usernameAction, { borderWidth: 1, borderColor: colors.surface.glassBorder }]}
                      >
                        <Text style={[{ color: colors.neutral.darkGray, fontSize: typography.fontSize.sm }, textFont.medium]}>Cancel</Text>
                      </AnimatedPressable>
                    </View>
                  ) : (
                    <View style={styles.usernameDisplayRow}>
                      <View>
                        <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>Username</Text>
                        <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>@{user.username}</Text>
                      </View>
                      <AnimatedPressable
                        onPress={() => { setNewUsername(user.username); setEditingUsername(true); }}
                        style={[styles.editUsernameBtn, { backgroundColor: colors.primary.main + '15' }]}
                      >
                        <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.sm }, textFont.medium]}>Edit</Text>
                      </AnimatedPressable>
                    </View>
                  )}
                </View>

                {/* Change Password row */}
                <View style={[styles.usernameRow, { borderTopColor: colors.surface.glassBorder }]}>
                  <AnimatedPressable
                    onPress={handleChangePassword}
                    style={styles.usernameDisplayRow}
                  >
                    <View>
                      <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>Security</Text>
                      <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>Change Password</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.neutral.gray} />
                  </AnimatedPressable>
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
                  setAuthInitialMode('signIn');
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

          <Text style={[styles.settingsSectionLabel, { color: colors.neutral.gray }]}>
            Appearance
          </Text>
          <GlassCard blur="subtle" padding="md" style={{ marginBottom: spacing.md }}>
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

          <Text style={[styles.settingsSectionLabel, { color: colors.neutral.gray }]}>
            Notifications
          </Text>
          <GlassCard blur="subtle" padding="md" style={{ marginBottom: spacing.md }}>
            <View style={[styles.settingsRow, { marginBottom: spacing.sm }]}>
              <View style={styles.settingsLeft}>
                <View style={[styles.settingsIconWrap, { backgroundColor: colors.accent.orange + '20' }]}>
                  <Ionicons name="pricetag-outline" size={20} color={colors.accent.orange} />
                </View>
                <View>
                  <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>
                    Offers & Promotions
                  </Text>
                  <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>
                    Deals from your saved retailers
                  </Text>
                </View>
              </View>
              <Switch
                value={notifOffers}
                onValueChange={setNotifOffers}
                trackColor={{ false: colors.neutral.lightGray, true: colors.primary.main }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={[styles.settingsRow, { borderTopWidth: 1, borderTopColor: colors.surface.glassBorder, paddingTop: spacing.sm }]}>
              <View style={styles.settingsLeft}>
                <View style={[styles.settingsIconWrap, { backgroundColor: colors.accent.lime + '20' }]}>
                  <Ionicons name="trending-down-outline" size={20} color={colors.accent.lime} />
                </View>
                <View>
                  <Text style={[styles.settingsTitle, { color: colors.neutral.charcoal }]}>
                    Price Alerts
                  </Text>
                  <Text style={[styles.settingsSubtitle, { color: colors.neutral.gray }]}>
                    When list items drop in price
                  </Text>
                </View>
              </View>
              <Switch
                value={notifPriceAlerts}
                onValueChange={setNotifPriceAlerts}
                trackColor={{ false: colors.neutral.lightGray, true: colors.primary.main }}
                thumbColor="#FFFFFF"
              />
            </View>
          </GlassCard>

          {isAuthenticated && (
            <>
              <Text style={[styles.settingsSectionLabel, { color: '#DC2626' }]}>
                Danger Zone
              </Text>
              <GlassCard blur="subtle" padding="md">
                <AnimatedPressable
                  onPress={handleDeleteAccount}
                  style={[styles.logoutButton, { borderColor: '#DC262640', marginTop: 0 }]}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text style={styles.logoutText}>Delete Account</Text>
                </AnimatedPressable>
              </GlassCard>
            </>
          )}
        </ScrollView>
      </GlassModal>

      <GlassModal
        visible={authVisible}
        onClose={() => setAuthVisible(false)}
        fullScreen
      >
        <AuthScreen
          onSuccess={() => setAuthVisible(false)}
          initialMode={authInitialMode}
          initialEmail={authInitialMode === 'forgotPassword' && user ? user.email : undefined}
        />
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

  featuredFlatList: {
    backgroundColor: 'transparent',
  },
  featuredList: {
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    backgroundColor: 'transparent',
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
  usernameRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  usernameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editUsernameBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  usernameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  usernameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.fontSize.base,
    ...textFont.regular,
  },
  usernameAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
});

export default HomeScreen;
