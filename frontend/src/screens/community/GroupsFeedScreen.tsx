import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import api from '@/services/api';
import type { CommunityGroup } from '@/types/community';
import { useAuthStore } from '@/store';
import { GroupDetailScreen } from './GroupDetailScreen';

const CATEGORY_ICONS: Record<string, string> = {
  food: '🥦',
  budget: '💰',
  local: '📍',
  health: '💪',
  recipes: '🍳',
  general: '💬',
};

// ── Create Group Modal ────────────────────────────────────────────────────────
const CATEGORIES = ['food', 'budget', 'local', 'health', 'recipes', 'general'];

const CreateGroupModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreated: (g: CommunityGroup) => void;
}> = ({ visible, onClose, onCreated }) => {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert('Validation', 'Name and description are required.');
      return;
    }
    setLoading(true);
    try {
      const g = await api.community.createGroup({ name: name.trim(), description: description.trim(), category });
      onCreated(g);
      setName(''); setDescription(''); setCategory('general');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create group.');
    } finally {
      setLoading(false);
    }
  };

  const overlayBg = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(15,23,42,0.97)' : 'rgba(248,250,252,0.98)';
  const inputBg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.90)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={[styles.overlay, { backgroundColor: overlayBg }]} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: cardBg, borderColor: colors.surface.glassBorder }]}>
          <Text style={[styles.modalTitle, { color: colors.neutral.charcoal }, textFont.bold]}>Create Group</Text>

          <TextInput
            style={[styles.modalInput, { color: colors.neutral.charcoal, backgroundColor: inputBg, borderColor: colors.surface.glassBorder }]}
            placeholder="Group name"
            placeholderTextColor={colors.neutral.gray}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.modalInput, styles.modalTextarea, { color: colors.neutral.charcoal, backgroundColor: inputBg, borderColor: colors.surface.glassBorder }]}
            placeholder="What is this group about?"
            placeholderTextColor={colors.neutral.gray}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Text style={[{ fontSize: typography.fontSize.sm, color: colors.neutral.darkGray, marginBottom: 4 }, textFont.medium]}>
            Category
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: category === cat ? colors.primary.main + '25' : 'transparent',
                    borderColor: category === cat ? colors.primary.main : colors.surface.glassBorder,
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[{ fontSize: typography.fontSize.xs, color: category === cat ? colors.primary.main : colors.neutral.gray }, textFont.medium]}>
                  {CATEGORY_ICONS[cat]} {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { borderColor: colors.surface.glassBorder, borderWidth: 1 }]} activeOpacity={0.8}>
              <Text style={[{ color: colors.neutral.darkGray, fontSize: typography.fontSize.base }, textFont.medium]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={loading} style={[styles.modalBtn, { backgroundColor: colors.primary.main }]} activeOpacity={0.8}>
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[{ color: '#fff', fontSize: typography.fontSize.base }, textFont.semibold]}>Create</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Group Card ────────────────────────────────────────────────────────────────
const GroupCard: React.FC<{ group: CommunityGroup; onPress: () => void }> = ({ group, onPress }) => {
  const { colors, isDark } = useTheme();
  const bg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.75)';
  const icon = CATEGORY_ICONS[group.category] ?? '💬';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.groupCard, { backgroundColor: bg, borderColor: colors.surface.glassBorder }]}
      activeOpacity={0.8}
    >
      <View style={styles.groupCardTop}>
        <View style={[styles.groupIcon, { backgroundColor: colors.primary.main + '20' }]}>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: colors.neutral.charcoal }, textFont.semibold]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[styles.groupMeta, { color: colors.neutral.gray }, textFont.regular]}>
            👥 {group.member_count} · 📝 {group.topic_count}
          </Text>
        </View>
        <View style={styles.groupBadges}>
          {group.is_featured && (
            <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
              <Text style={[{ color: '#F59E0B', fontSize: typography.fontSize.xs }, textFont.semibold]}>⭐ Featured</Text>
            </View>
          )}
          {group.is_trending && (
            <View style={[styles.badge, { backgroundColor: colors.primary.main + '20' }]}>
              <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.xs }, textFont.semibold]}>🔥 Trending</Text>
            </View>
          )}
          {group.is_member && (
            <View style={[styles.badge, { backgroundColor: colors.primary.main + '30' }]}>
              <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.xs }, textFont.semibold]}>✓ Joined</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.groupDesc, { color: colors.neutral.darkGray }, textFont.regular]} numberOfLines={2}>
        {group.description}
      </Text>
    </TouchableOpacity>
  );
};

// ── GroupsFeedScreen ──────────────────────────────────────────────────────────
type FeedTab = 'mine' | 'trending' | 'featured';

export const GroupsFeedScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<FeedTab>('trending');
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);

  const loadGroups = useCallback(async (tab: FeedTab) => {
    setLoading(true);
    try {
      const filter = tab === 'mine' ? 'mine' : tab === 'trending' ? 'trending' : 'featured';
      const data = await api.community.listGroups(filter);
      setGroups(data);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadGroups(activeTab);
  }, [activeTab, loadGroups]);

  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);
  };

  if (selectedGroup) {
    return (
      <GroupDetailScreen
        group={selectedGroup}
        currentUsername={user?.username ?? null}
        onBack={() => setSelectedGroup(null)}
        onGroupUpdated={(updated) => {
          setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
          setSelectedGroup(updated);
        }}
      />
    );
  }

  const switcherBg = isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.70)';
  const TABS: { key: FeedTab; label: string }[] = [
    { key: 'trending', label: '🔥 Trending' },
    { key: 'featured', label: '⭐ Featured' },
    { key: 'mine', label: '👤 My Groups' },
  ];

  return (
    <View style={styles.container}>
      {/* Sub-tab switcher */}
      <View style={styles.switcherRow}>
        <View style={[styles.switcher, { backgroundColor: switcherBg, borderColor: colors.surface.glassBorder }]}>
          {TABS.map(({ key, label }) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleTabChange(key)}
                style={[styles.subTab, active && { backgroundColor: colors.primary.main }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.subTabText, { color: active ? '#fff' : colors.neutral.gray }, active ? textFont.semibold : textFont.medium]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {isAuthenticated && (
          <TouchableOpacity
            onPress={() => setShowCreateGroup(true)}
            style={[styles.createBtn, { backgroundColor: colors.primary.main }]}
            activeOpacity={0.8}
          >
            <Text style={[{ color: '#fff', fontSize: typography.fontSize.sm }, textFont.semibold]}>+ Group</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Groups list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.main} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => setSelectedGroup(item)} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: 'transparent' }}
          ListEmptyComponent={
            <View style={styles.center}>
              {activeTab === 'mine' && !isAuthenticated ? (
                <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.regular]}>
                  Sign in to see your groups
                </Text>
              ) : (
                <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.regular]}>
                  {activeTab === 'mine'
                    ? "You haven't joined any groups yet"
                    : `No ${activeTab} groups yet`}
                </Text>
              )}
            </View>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}

      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(g) => {
          setGroups(prev => [g, ...prev]);
          setSelectedGroup(g);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  switcher: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    borderWidth: glass.borderWidth,
    padding: 3,
  },
  subTab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  subTabText: { fontSize: typography.fontSize.xs },
  createBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: borderRadius.full,
  },

  listContent: { paddingHorizontal: spacing.lg, paddingTop: 4 },

  groupCard: {
    borderRadius: borderRadius.lg,
    borderWidth: glass.borderWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  groupIcon: { width: 44, height: 44, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  groupInfo: { flex: 1 },
  groupName: { fontSize: typography.fontSize.base, marginBottom: 2 },
  groupMeta: { fontSize: typography.fontSize.xs },
  groupBadges: { gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  groupDesc: { fontSize: typography.fontSize.sm, lineHeight: 18, marginLeft: 44 + spacing.sm },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: typography.fontSize.base, textAlign: 'center' },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    borderRadius: borderRadius.xl,
    borderWidth: glass.borderWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: { fontSize: typography.fontSize.xl, marginBottom: spacing.xs },
  modalInput: {
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
  },
  modalTextarea: { minHeight: 80, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  modalBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    minWidth: 80,
  },
});
