/**
 * Home Screen
 * Displays Featured Products and News Articles (MVP placeholders)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/theme';
import { ProductCard, PlaceholderCard } from '@/components';
import { api, Product } from '@/services/api';
import { useRouter } from 'expo-router';
const router = useRouter();

export const HomeScreen: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeaturedProducts = async () => {
    try {
      // Fetch products with best Nutri-Score for featured section
      const products = await api.products.getAll({
        nutri_score: 'A',
        ordering: '-updated_at',
      });
      setFeaturedProducts(products.slice(0, 6));
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.dark}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.appName}>FoodXchange</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle-outline" size={40} color={colors.primary.dark} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.accent.lime }]}>
              <Ionicons name="scan-outline" size={24} color={colors.primary.dark} />
            </View>
            <Text style={styles.quickActionText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.accent.orange }]}>
              <Ionicons name="list-outline" size={24} color={colors.neutral.white} />
            </View>
            <Text style={styles.quickActionText}>My List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionButton} onPress={() => router.push('/compare')}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary.dark }]}>
              <Ionicons name="pricetags-outline" size={24} color={colors.neutral.white} />
            </View>
            <Text style={styles.quickActionText}>Compare</Text>
          </TouchableOpacity>
        </View>

        {/* Featured Products Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary.dark} />
          ) : featuredProducts.length > 0 ? (
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.featuredProductCard}>
                  <ProductCard product={item} />
                </View>
              )}
              contentContainerStyle={styles.featuredList}
            />
          ) : (
            <PlaceholderCard
              title="Featured Products"
              description="Top-rated healthy products will appear here"
              icon="star-outline"
              color={colors.accent.orange}
            />
          )}
        </View>

        {/* News Articles Section - Placeholder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>News & Articles</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <PlaceholderCard
            title="Health & Nutrition News"
            description="Stay updated with the latest food and nutrition articles"
            icon="newspaper-outline"
            color={colors.primary.dark}
          />
          
          {/* Sample Article Cards */}
          <View style={styles.articleCard}>
            <View style={styles.articleImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.neutral.gray} />
            </View>
            <View style={styles.articleContent}>
              <Text style={styles.articleTitle}>Understanding NOVA Scores</Text>
              <Text style={styles.articleExcerpt}>
                Learn how food processing levels affect your health...
              </Text>
              <Text style={styles.articleMeta}>5 min read</Text>
            </View>
          </View>
          
          <View style={styles.articleCard}>
            <View style={styles.articleImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={colors.neutral.gray} />
            </View>
            <View style={styles.articleContent}>
              <Text style={styles.articleTitle}>Smart Shopping Tips</Text>
              <Text style={styles.articleExcerpt}>
                How to find the best prices while eating healthy...
              </Text>
              <Text style={styles.articleMeta}>3 min read</Text>
            </View>
          </View>
        </View>

        {/* Footer Spacing */}
        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.offWhite,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    backgroundColor: colors.neutral.white,
    ...shadows.sm,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSize.base,
    color: colors.neutral.darkGray,
  },
  appName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary.dark,
  },
  profileButton: {
    padding: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.neutral.white,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.neutral.charcoal,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral.charcoal,
  },
  seeAllText: {
    fontSize: typography.fontSize.base,
    color: colors.primary.dark,
    fontWeight: typography.fontWeight.medium,
  },
  featuredList: {
    paddingLeft: spacing.base,
  },
  featuredProductCard: {
    width: 280,
    marginRight: spacing.md,
  },
  articleCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  articleImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: colors.neutral.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  articleTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral.charcoal,
    marginBottom: spacing.xs,
  },
  articleExcerpt: {
    fontSize: typography.fontSize.sm,
    color: colors.neutral.darkGray,
    marginBottom: spacing.xs,
  },
  articleMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral.gray,
  },
  footerSpace: {
    height: spacing['3xl'],
  },
});

export default HomeScreen;
