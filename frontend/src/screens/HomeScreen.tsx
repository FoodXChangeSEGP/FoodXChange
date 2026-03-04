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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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

type FaqItem = { q: string; a: string };
type FaqSection = { category: string; items: FaqItem[] };

const FAQ_DATA: FaqSection[] = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is foodXchange?',
        a: 'foodXchange is a community-owned app that helps you make small, sustainable changes to how you buy, cook and share food. It brings together food information, price comparison, planning tools and local community support in one place.',
      },
      {
        q: 'Do I need a smartphone to access foodXchange?',
        a: 'Yes. foodXchange is available on both iPhone and Android smartphones.\n\niPhone: iOS 15.1 or later. We do not support iPad.\n\nAndroid: Android 8.0 or later.',
      },
      {
        q: 'How do I get started?',
        a: 'Create an account and head over to My Journey where your FoodX Guide will provide you with a tour of foodXchange.',
      },
    ],
  },
  {
    category: 'Free & Premium Features',
    items: [
      {
        q: 'Is foodXchange free to use?',
        a: 'Core features including FoodX, My List, My Neighbourhood, My Groups and My Journey are free to use.',
      },
      {
        q: 'What premium features are available?',
        a: 'There are three tiers of premium features:\n\nBronze – £14.99/year: FoodX Guide personalised support, push notifications, offline mode with re-sync, list sharing and food preferences.\n\nSilver – £39.99/year: All Bronze features plus Cook features including a recipe finder, cooking hacks and meal planning tools.\n\nGold – £59.99/year: All Silver features plus Pantry features including waste tracking and food inventory management.',
      },
    ],
  },
  {
    category: 'Food & Shopping',
    items: [
      {
        q: 'How does foodXchange help me eat healthier?',
        a: 'We provide food profiling, simple tips, and meal ideas to help you make informed choices. You can also access guidance through FoodX Guide.',
      },
      {
        q: 'How does price comparison work?',
        a: 'foodXchange shows prices across selected retailers to help you find the best value options. Prices are updated regularly but may vary in-store.',
      },
      {
        q: 'Can I build shopping lists?',
        a: 'Yes. You can create, save and compare shopping lists, and explore ways to make them more affordable or healthier.',
      },
    ],
  },
  {
    category: 'Cooking & Meal Planning',
    items: [
      {
        q: 'Do I need cooking experience to use the app?',
        a: 'Not at all. foodXchange is designed to support all levels, from beginners to confident cooks.',
      },
      {
        q: 'Where can I find recipes or meal ideas?',
        a: "You'll find simple, budget-friendly meal ideas within the app, along with guidance from FoodX Guide and community groups.",
      },
    ],
  },
  {
    category: 'Community',
    items: [
      {
        q: 'How do I find affordable food near me?',
        a: 'Use the map and filters in My Neighbourhood to find options like community fridges, pantries and local markets.',
      },
      {
        q: 'What are My Groups?',
        a: 'My Groups are community spaces where you can connect with others, share experiences, ask questions and get support.',
      },
      {
        q: 'Can I create my own group?',
        a: "Yes. If you can't find a group that fits your needs, you can create one and invite others to join.",
      },
    ],
  },
  {
    category: 'FoodX Guide',
    items: [
      {
        q: 'What is FoodX Guide?',
        a: 'FoodX Guide provides tips, guidance and personalised support based on your goals and activity.',
      },
      {
        q: 'Are the tips personalised?',
        a: 'Yes. The more you use the app, the better FoodX Guide can tailor suggestions to your needs.',
      },
    ],
  },
  {
    category: 'Data & Privacy',
    items: [
      {
        q: 'How is my data used?',
        a: 'Your data is used to personalise your experience and improve the app. We do not sell your personal data.',
      },
      {
        q: 'Will my information be shared?',
        a: 'We only share anonymised, aggregated data where appropriate (e.g. for research or improving services).',
      },
    ],
  },
  {
    category: 'Troubleshooting & Support',
    items: [
      {
        q: "I can't find what I'm looking for, what should I do?",
        a: 'Try using search or ask in a community group. You can also contact support via the app.',
      },
      {
        q: 'How do I report an issue or give feedback?',
        a: 'We welcome feedback. Use the feedback option in My Groups or contact us directly at food.investors.society@gmail.com.',
      },
    ],
  },
  {
    category: 'About foodXchange',
    items: [
      {
        q: 'Who runs foodXchange?',
        a: 'foodXchange is developed by The Food Investors Society, a non-profit, community-owned co-operative.',
      },
      {
        q: 'Why is foodXchange different?',
        a: 'We are independent and mission-led. Our focus is on improving public health and supporting a fairer food system, not promoting specific products.',
      },
    ],
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
  const [openFaqKeys, setOpenFaqKeys] = useState<Set<string>>(new Set());

  const toggleFaq = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaqKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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

        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.neutral.charcoal }]}>
              FAQs
            </Text>
          </View>
          <View style={styles.sectionPad}>
            {FAQ_DATA.map((section) => (
              <View key={section.category} style={styles.faqCategory}>
                <View style={[styles.faqCategoryHeader, { backgroundColor: colors.primary.main + '15' }]}>
                  <Text style={[styles.faqCategoryTitle, { color: colors.primary.main }]}>
                    {section.category}
                  </Text>
                </View>
                {section.items.map((item, idx) => {
                  const key = `${section.category}-${idx}`;
                  const isOpen = openFaqKeys.has(key);
                  return (
                    <GlassCard
                      key={key}
                      blur="subtle"
                      padding="md"
                      style={styles.faqCard}
                      onPress={() => toggleFaq(key)}
                    >
                      <View style={styles.faqQuestion}>
                        <Text style={[styles.faqQuestionText, { color: colors.neutral.charcoal }]}>
                          {item.q}
                        </Text>
                        <Ionicons
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.neutral.gray}
                        />
                      </View>
                      {isOpen && (
                        <Text style={[styles.faqAnswer, { color: colors.neutral.darkGray, borderTopColor: colors.surface.glassBorder }]}>
                          {item.a}
                        </Text>
                      )}
                    </GlassCard>
                  );
                })}
              </View>
            ))}
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

  faqCategory: {
    marginBottom: spacing.md,
  },
  faqCategoryHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  faqCategoryTitle: {
    ...textFont.semibold,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  faqCard: {
    marginBottom: spacing.xs,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqQuestionText: {
    ...textFont.semibold,
    fontSize: typography.fontSize.base,
    flex: 1,
    lineHeight: 20,
  },
  faqAnswer: {
    ...textFont.regular,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});

export default HomeScreen;
