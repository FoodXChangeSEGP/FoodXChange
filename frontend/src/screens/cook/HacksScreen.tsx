/**
 * HacksScreen — browse cooking hacks with category filter
 */
import React, { useEffect } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius, typography, textFont, shadows } from '@/theme';
import { useCookStore } from '@/store/useCookStore';
import type { CookingHackCategory, CookingHack } from '@/types/cook';

const HACK_CATEGORIES: { key: CookingHackCategory | null; label: string; icon: string }[] = [
  { key: null, label: 'All', icon: 'apps-outline' },
  { key: 'time_saving', label: 'Time', icon: 'timer-outline' },
  { key: 'money_saving', label: 'Saving', icon: 'cash-outline' },
  { key: 'health', label: 'Health', icon: 'heart-outline' },
  { key: 'storage', label: 'Storage', icon: 'cube-outline' },
  { key: 'technique', label: 'Technique', icon: 'construct-outline' },
  { key: 'substitution', label: 'Subs', icon: 'swap-horizontal-outline' },
  { key: 'cleanup', label: 'Cleanup', icon: 'sparkles-outline' },
];

const CATEGORY_COLORS: Record<string, string> = {
  time_saving: '#3B82F6',
  money_saving: '#22C55E',
  health: '#EF4444',
  storage: '#8B5CF6',
  technique: '#F59E0B',
  substitution: '#06B6D4',
  cleanup: '#EC4899',
  other: '#6B7280',
};

export const HacksScreen: React.FC = () => {
  const { colors } = useTheme();
  const { hacks, hacksLoading, loadHacks, hackCategoryFilter, setHackCategoryFilter } = useCookStore();

  useEffect(() => {
    const params: Record<string, string> = {};
    if (hackCategoryFilter) params.category = hackCategoryFilter;
    loadHacks(params);
  }, [hackCategoryFilter]);

  const renderHack = ({ item }: { item: CookingHack }) => {
    const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
    return (
      <View style={[styles.hackCard, { backgroundColor: colors.surface.card }]}>
        <View style={[styles.hackCatDot, { backgroundColor: catColor }]} />
        <View style={styles.hackBody}>
          <Text style={[styles.hackTitle, { color: colors.neutral.charcoal }, textFont.semibold]}>
            {item.title}
          </Text>
          <Text style={[styles.hackDesc, { color: colors.neutral.darkGray }, textFont.regular]} numberOfLines={3}>
            {item.description}
          </Text>
          <View style={styles.hackMeta}>
            <View style={[styles.hackCatBadge, { backgroundColor: catColor + '18' }]}>
              <Text style={[styles.hackCatText, { color: catColor }, textFont.medium]}>
                {item.category.replace('_', ' ')}
              </Text>
            </View>
            {item.tags.slice(0, 2).map((t) => (
              <View key={t} style={[styles.hackTag, { backgroundColor: colors.neutral.lightGray }]}>
                <Text style={[styles.hackTagText, { color: colors.neutral.darkGray }, textFont.regular]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContainer}>
        {HACK_CATEGORIES.map((cat) => {
          const active = hackCategoryFilter === cat.key;
          return (
            <TouchableOpacity
              key={cat.key ?? 'all'}
              onPress={() => setHackCategoryFilter(cat.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary.main : colors.surface.card,
                  borderColor: active ? colors.primary.main : colors.surface.glassBorder,
                },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={active ? '#FFF' : colors.neutral.darkGray}
              />
              <Text style={[
                styles.chipText,
                { color: active ? '#FFF' : colors.neutral.darkGray },
                active ? textFont.semibold : textFont.regular,
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {hacksLoading ? (
        <ActivityIndicator size="large" color={colors.primary.main} style={styles.loader} />
      ) : (
        <FlatList
          data={hacks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderHack}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bulb-outline" size={48} color={colors.neutral.gray} />
              <Text style={[styles.emptyText, { color: colors.neutral.darkGray }, textFont.medium]}>
                No cooking hacks found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  chipsScroll: {
    maxHeight: 42,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  loader: {
    marginTop: spacing['2xl'],
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
  },
  hackCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  hackCatDot: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  hackBody: {
    flex: 1,
  },
  hackTitle: {
    fontSize: typography.fontSize.md,
    marginBottom: spacing.xs,
  },
  hackDesc: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  hackMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  hackCatBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  hackCatText: {
    fontSize: typography.fontSize.xs,
    textTransform: 'capitalize',
  },
  hackTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  hackTagText: {
    fontSize: typography.fontSize.xs,
  },
});
