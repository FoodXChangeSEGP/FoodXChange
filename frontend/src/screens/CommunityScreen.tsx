/**
 * CommunityScreen — container with three sub-tabs: Map | Feed | Messages
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import { CommunityMapScreen } from './CommunityMapScreen';
import { GroupsFeedScreen } from './community/GroupsFeedScreen';
import { MessagesScreen } from './community/MessagesScreen';
import type { CommunityGroup } from '@/types/community';

type SubTab = 'map' | 'feed' | 'messages';

const SUB_TAB_LABELS: Record<SubTab, string> = {
  map: 'My Neighbourhood',
  feed: 'My Groups',
  messages: 'My Journey',
};

export const CommunityScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<SubTab>('map');
  const [pendingGroup, setPendingGroup] = useState<CommunityGroup | null>(null);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface.background }]}
      edges={['top']}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.neutral.charcoal }, textFont.bold]}>
            Community
          </Text>
          <Text style={[styles.subtitle, { color: colors.neutral.darkGray }, textFont.regular]}>
            My FoodX Neighbourhood
          </Text>
        </View>
      </View>

      {/* ── Sub-tab pill switcher ── */}
      <View style={styles.switcherRow}>
        <View style={[
          styles.switcher,
          {
            backgroundColor: isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.70)',
            borderColor:     colors.surface.glassBorder,
          },
        ]}>
          {(['map', 'feed', 'messages'] as SubTab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.subTab,
                  active && {
                    backgroundColor: colors.primary.main,
                    shadowColor:     colors.primary.glow,
                    shadowOffset:    { width: 0, height: 0 },
                    shadowOpacity:   0.35,
                    shadowRadius:    10,
                    elevation:       3,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.subTabText,
                  { color: active ? '#FFFFFF' : colors.neutral.gray },
                  active ? textFont.semibold : textFont.medium,
                ]}>
                  {SUB_TAB_LABELS[tab]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Tab content ── */}
      <View style={styles.content}>
        {activeTab === 'map' ? (
          <CommunityMapScreen
            onNavigateToGroup={(group) => {
              setPendingGroup(group);
              setActiveTab('feed');
            }}
          />
        ) : activeTab === 'feed' ? (
          <GroupsFeedScreen
            pendingGroup={pendingGroup}
            onClearPendingGroup={() => setPendingGroup(null)}
          />
        ) : (
          <MessagesScreen />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.md,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },

  switcherRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
  },
  switcher: {
    flexDirection:  'row',
    borderRadius:   borderRadius.full,
    borderWidth:    glass.borderWidth,
    padding:        3,
    alignSelf:      'flex-start',
  },
  subTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      borderRadius.full,
  },
  subTabText: {
    fontSize: typography.fontSize.sm,
    letterSpacing: 0.2,
  },

  content: {
    flex: 1,
  },

});

export default CommunityScreen;
