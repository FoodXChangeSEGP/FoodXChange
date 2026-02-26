import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import api from '@/services/api';
import type { CommunityGroup, Topic, VoteType } from '@/types/community';
import { useAuthStore } from '@/store';
import { TopicDetailScreen } from './TopicDetailScreen';

interface Props {
  group: CommunityGroup;
  onBack: () => void;
  onGroupUpdated: (g: CommunityGroup) => void;
  currentUsername: string | null;
}

// ── Create Topic Modal ────────────────────────────────────────────────────────
const CreateTopicModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreated: (t: Topic) => void;
  groupId: number;
}> = ({ visible, onClose, onCreated, groupId }) => {
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Validation', 'Title and description are required.');
      return;
    }
    setLoading(true);
    try {
      const t = await api.community.createTopic(groupId, { title: title.trim(), body: body.trim() });
      onCreated(t);
      setTitle('');
      setBody('');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create topic.');
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
          <Text style={[styles.modalTitle, { color: colors.neutral.charcoal }, textFont.bold]}>New Topic</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.neutral.charcoal, backgroundColor: inputBg, borderColor: colors.surface.glassBorder }]}
            placeholder="Topic title"
            placeholderTextColor={colors.neutral.gray}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.modalInput, styles.modalTextarea, { color: colors.neutral.charcoal, backgroundColor: inputBg, borderColor: colors.surface.glassBorder }]}
            placeholder="What would you like to discuss?"
            placeholderTextColor={colors.neutral.gray}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
          />
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

// ── Topic Card ────────────────────────────────────────────────────────────────
const TopicCard: React.FC<{
  topic: Topic;
  onPress: () => void;
  onVote: (type: VoteType) => void;
}> = ({ topic, onPress, onVote }) => {
  const { colors, isDark } = useTheme();
  const bg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.75)';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.topicCard, { backgroundColor: bg, borderColor: colors.surface.glassBorder }]}
      activeOpacity={0.8}
    >
      <Text style={[styles.topicTitle, { color: colors.neutral.charcoal }, textFont.semibold]} numberOfLines={2}>
        {topic.title}
      </Text>
      <Text style={[styles.topicBody, { color: colors.neutral.darkGray }, textFont.regular]} numberOfLines={2}>
        {topic.body}
      </Text>
      <View style={styles.topicMeta}>
        <Text style={[{ color: colors.neutral.gray, fontSize: typography.fontSize.xs }, textFont.regular]}>
          @{topic.created_by_username ?? 'deleted'} · {new Date(topic.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </Text>
        <Text style={[{ color: colors.neutral.gray, fontSize: typography.fontSize.xs }, textFont.regular]}>
          💬 {topic.comment_count}
        </Text>
      </View>
      <View style={styles.voteRow}>
        {(['useful', 'not_useful'] as VoteType[]).map((type) => {
          const active = topic.my_vote === type;
          const label = type === 'useful' ? `👍 ${topic.useful_count}` : `👎 ${topic.not_useful_count}`;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => onVote(type)}
              style={[styles.voteBtn, active && { backgroundColor: colors.primary.main + '25' }]}
              activeOpacity={0.7}
            >
              <Text style={[{ fontSize: typography.fontSize.xs, color: active ? colors.primary.main : colors.neutral.gray }, textFont.medium]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </TouchableOpacity>
  );
};

// ── GroupDetailScreen ─────────────────────────────────────────────────────────
export const GroupDetailScreen: React.FC<Props> = ({ group: initialGroup, onBack, onGroupUpdated, currentUsername }) => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();

  const [group, setGroup] = useState<CommunityGroup>(initialGroup);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningLeaving, setJoiningLeaving] = useState(false);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  const loadTopics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.community.listTopics(group.id);
      setTopics(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [group.id]);

  React.useEffect(() => { loadTopics(); }, [loadTopics]);

  const handleJoinLeave = async () => {
    if (!isAuthenticated) { Alert.alert('Sign in required'); return; }
    setJoiningLeaving(true);
    try {
      if (group.is_member) {
        const res = await api.community.leaveGroup(group.id);
        const updated = { ...group, is_member: false, member_count: res.member_count };
        setGroup(updated);
        onGroupUpdated(updated);
      } else {
        const res = await api.community.joinGroup(group.id);
        const updated = { ...group, is_member: true, member_count: res.member_count };
        setGroup(updated);
        onGroupUpdated(updated);
      }
    } catch {
      Alert.alert('Error', 'Could not update membership.');
    } finally {
      setJoiningLeaving(false);
    }
  };

  const handleTopicVote = async (topicId: number, type: VoteType) => {
    if (!isAuthenticated) { Alert.alert('Sign in required', 'Please sign in to vote.'); return; }
    try {
      const res = await api.community.voteTopic(topicId, type);
      setTopics(prev => prev.map(t =>
        t.id === topicId
          ? { ...t, useful_count: res.useful_count, not_useful_count: res.not_useful_count, my_vote: res.removed ? null : res.vote_type }
          : t
      ));
    } catch { /* ignore */ }
  };

  if (selectedTopic) {
    return (
      <TopicDetailScreen
        topic={selectedTopic}
        currentUsername={currentUsername}
        onBack={() => setSelectedTopic(null)}
        onTopicDeleted={() => {
          setTopics(prev => prev.filter(t => t.id !== selectedTopic.id));
          setSelectedTopic(null);
        }}
      />
    );
  }

  const headerBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)';
  const groupBg = isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.75)';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: colors.surface.glassBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.base }, textFont.semibold]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }, textFont.bold]} numberOfLines={1}>
          {group.name}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={topics}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Group card */}
            <View style={[styles.groupCard, { backgroundColor: groupBg, borderColor: colors.surface.glassBorder }]}>
              <View style={styles.groupTitleRow}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.primary.main + '20' }]}>
                  <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.xs }, textFont.semibold]}>
                    {group.category}
                  </Text>
                </View>
              </View>
              <Text style={[styles.groupName, { color: colors.neutral.charcoal }, textFont.bold]}>
                {group.name}
              </Text>
              <Text style={[styles.groupDesc, { color: colors.neutral.darkGray }, textFont.regular]}>
                {group.description}
              </Text>
              <View style={styles.groupStats}>
                <Text style={[{ color: colors.neutral.gray, fontSize: typography.fontSize.sm }, textFont.regular]}>
                  👥 {group.member_count} members · 📝 {group.topic_count ?? topics.length} topics
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleJoinLeave}
                disabled={joiningLeaving}
                style={[
                  styles.joinBtn,
                  {
                    backgroundColor: group.is_member ? 'transparent' : colors.primary.main,
                    borderColor: group.is_member ? colors.surface.glassBorder : colors.primary.main,
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                {joiningLeaving
                  ? <ActivityIndicator size="small" color={group.is_member ? colors.neutral.gray : '#fff'} />
                  : <Text style={[{ color: group.is_member ? colors.neutral.darkGray : '#fff', fontSize: typography.fontSize.base }, textFont.semibold]}>
                      {group.is_member ? 'Leave Group' : 'Join Group'}
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Topics header */}
            <View style={styles.topicsHeader}>
              <Text style={[styles.topicsLabel, { color: colors.neutral.charcoal }, textFont.bold]}>
                Topics
              </Text>
              {isAuthenticated && (
                <TouchableOpacity
                  onPress={() => setShowCreateTopic(true)}
                  style={[styles.newTopicBtn, { backgroundColor: colors.primary.main }]}
                  activeOpacity={0.8}
                >
                  <Text style={[{ color: '#fff', fontSize: typography.fontSize.sm }, textFont.semibold]}>+ New Topic</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading && <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.md }} />}
            {!loading && topics.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.neutral.gray }, textFont.regular]}>
                No topics yet. Be the first to start a discussion!
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TopicCard
            topic={item}
            onPress={() => setSelectedTopic(item)}
            onVote={(type) => handleTopicVote(item.id, type)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'transparent' }}
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      <CreateTopicModal
        visible={showCreateTopic}
        groupId={group.id}
        onClose={() => setShowCreateTopic(false)}
        onCreated={(t) => setTopics(prev => [t, ...prev])}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: glass.borderWidth,
    justifyContent: 'space-between',
  },
  backBtn: { minWidth: 60 },
  headerTitle: { fontSize: typography.fontSize.base, flex: 1, textAlign: 'center' },

  listContent: { paddingHorizontal: spacing.lg },
  listHeader: { paddingTop: spacing.md },

  groupCard: {
    borderRadius: borderRadius.lg,
    borderWidth: glass.borderWidth,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  groupTitleRow: { flexDirection: 'row', marginBottom: spacing.xs },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  groupName: { fontSize: typography.fontSize.xl, marginBottom: spacing.xs },
  groupDesc: { fontSize: typography.fontSize.base, lineHeight: 22, marginBottom: spacing.sm },
  groupStats: { marginBottom: spacing.md },
  joinBtn: {
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },

  topicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topicsLabel: { fontSize: typography.fontSize.lg },
  newTopicBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },

  emptyText: { fontSize: typography.fontSize.base, textAlign: 'center', marginTop: spacing.xl },

  topicCard: {
    borderRadius: borderRadius.md,
    borderWidth: glass.borderWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  topicTitle: { fontSize: typography.fontSize.base, marginBottom: 4 },
  topicBody: { fontSize: typography.fontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  topicMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  voteRow: { flexDirection: 'row', gap: spacing.xs },
  voteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },

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
  modalTextarea: { minHeight: 100, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  modalBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    minWidth: 80,
  },
});
