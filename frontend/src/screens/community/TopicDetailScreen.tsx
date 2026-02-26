import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius, typography, textFont, glass } from '@/theme';
import api from '@/services/api';
import type { Topic, Comment, VoteType } from '@/types/community';
import { useAuthStore } from '@/store';

interface Props {
  topic: Topic;
  onBack: () => void;
  onTopicDeleted: () => void;
  currentUsername: string | null;
}

// ── Vote Row ──────────────────────────────────────────────────────────────────
const VoteRow: React.FC<{
  usefulCount: number;
  notUsefulCount: number;
  myVote: VoteType | null;
  onVote: (type: VoteType) => void;
  compact?: boolean;
}> = ({ usefulCount, notUsefulCount, myVote, onVote, compact }) => {
  const { colors } = useTheme();
  const size = compact ? typography.fontSize.xs : typography.fontSize.sm;
  const pad = compact ? { paddingHorizontal: 8, paddingVertical: 4 } : { paddingHorizontal: 12, paddingVertical: 6 };

  return (
    <View style={styles.voteRow}>
      <TouchableOpacity
        onPress={() => onVote('useful')}
        style={[styles.voteBtn, pad, myVote === 'useful' && { backgroundColor: colors.primary.main + '30' }]}
        activeOpacity={0.7}
      >
        <Text style={[{ fontSize: size }, textFont.medium, { color: myVote === 'useful' ? colors.primary.main : colors.neutral.gray }]}>
          👍 {usefulCount}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onVote('not_useful')}
        style={[styles.voteBtn, pad, myVote === 'not_useful' && { backgroundColor: '#EF444430' }]}
        activeOpacity={0.7}
      >
        <Text style={[{ fontSize: size }, textFont.medium, { color: myVote === 'not_useful' ? '#EF4444' : colors.neutral.gray }]}>
          👎 {notUsefulCount}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ── Comment Card ──────────────────────────────────────────────────────────────
const CommentCard: React.FC<{
  comment: Comment;
  isReply?: boolean;
  onVote: (id: number, type: VoteType) => void;
  onReply: (comment: Comment) => void;
}> = ({ comment, isReply = false, onVote, onReply }) => {
  const { colors, isDark } = useTheme();
  const bg = isDark ? 'rgba(30,41,59,0.60)' : 'rgba(255,255,255,0.70)';

  return (
    <View style={[
      styles.commentCard,
      {
        backgroundColor: bg,
        borderColor: colors.surface.glassBorder,
        marginLeft: isReply ? spacing.xl : 0,
      },
    ]}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentUser, { color: colors.primary.main }, textFont.semibold]}>
          @{comment.created_by_username ?? 'deleted'}
        </Text>
        <Text style={[styles.commentTime, { color: colors.neutral.gray }, textFont.regular]}>
          {new Date(comment.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      <Text style={[styles.commentBody, { color: colors.neutral.charcoal }, textFont.regular]}>
        {comment.body}
      </Text>
      <View style={styles.commentActions}>
        <VoteRow
          usefulCount={comment.useful_count}
          notUsefulCount={comment.not_useful_count}
          myVote={comment.my_vote}
          onVote={(type) => onVote(comment.id, type)}
          compact
        />
        {!isReply && (
          <TouchableOpacity onPress={() => onReply(comment)} style={styles.replyBtn} activeOpacity={0.7}>
            <Text style={[{ fontSize: typography.fontSize.xs, color: colors.neutral.darkGray }, textFont.medium]}>
              Reply
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {!isReply && comment.replies?.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              isReply
              onVote={onVote}
              onReply={onReply}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ── TopicDetailScreen ─────────────────────────────────────────────────────────
export const TopicDetailScreen: React.FC<Props> = ({ topic: initialTopic, onBack, onTopicDeleted, currentUsername }) => {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();
  // GlassTabBar: height 68 + bottom: max(insets.bottom, 12)
  const tabBarOffset = Math.max(insets.bottom, 12) + 68;

  const [topic, setTopic] = useState<Topic>(initialTopic);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'most_liked'>('newest');

  const loadComments = useCallback(async (ordering: 'newest' | 'most_liked' = 'newest') => {
    try {
      setLoading(true);
      const data = await api.community.listComments(topic.id, ordering);
      setComments(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [topic.id]);

  React.useEffect(() => {
    loadComments(sortBy);
  }, [loadComments, sortBy]);

  const handleTopicVote = async (type: VoteType) => {
    if (!isAuthenticated) { Alert.alert('Sign in required', 'Please sign in to vote.'); return; }
    try {
      const res = await api.community.voteTopic(topic.id, type);
      setTopic(prev => ({
        ...prev,
        useful_count: res.useful_count,
        not_useful_count: res.not_useful_count,
        flag_count: res.flag_count,
        my_vote: res.removed ? null : res.vote_type,
      }));
    } catch { /* ignore */ }
  };

  const handleCommentVote = async (commentId: number, type: VoteType) => {
    if (!isAuthenticated) { Alert.alert('Sign in required', 'Please sign in to vote.'); return; }
    try {
      const res = await api.community.voteComment(commentId, type);
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, useful_count: res.useful_count, not_useful_count: res.not_useful_count, my_vote: res.removed ? null : res.vote_type };
        }
        const updatedReplies = c.replies?.map(r =>
          r.id === commentId
            ? { ...r, useful_count: res.useful_count, not_useful_count: res.not_useful_count, my_vote: res.removed ? null : res.vote_type }
            : r
        ) ?? [];
        return { ...c, replies: updatedReplies };
      }));
    } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) { Alert.alert('Sign in required', 'Please sign in to comment.'); return; }
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      if (replyingTo) {
        await api.community.replyToComment(replyingTo.id, text);
      } else {
        await api.community.createComment(topic.id, text);
      }
      setCommentText('');
      setReplyingTo(null);
      await loadComments(sortBy);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Topic', 'Are you sure you want to delete this topic?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.community.deleteTopic(topic.id);
            onTopicDeleted();
          } catch {
            Alert.alert('Error', 'Could not delete topic.');
          }
        },
      },
    ]);
  };

  const isOwner = currentUsername && currentUsername === topic.created_by_username;

  const headerBg = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(248,250,252,0.95)';
  const inputBg = isDark ? 'rgba(30,41,59,0.80)' : 'rgba(255,255,255,0.85)';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: colors.surface.glassBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.base }, textFont.semibold]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.neutral.charcoal }, textFont.bold]} numberOfLines={1}>
          Topic
        </Text>
        {isOwner ? (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
            <Text style={[{ color: '#EF4444', fontSize: typography.fontSize.sm }, textFont.medium]}>Delete</Text>
          </TouchableOpacity>
        ) : <View style={styles.deleteBtn} />}
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View style={styles.topicContainer}>
            {/* Topic card */}
            <View style={[styles.topicCard, { backgroundColor: isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.80)', borderColor: colors.surface.glassBorder }]}>
              <Text style={[styles.topicTitle, { color: colors.neutral.charcoal }, textFont.bold]}>
                {topic.title}
              </Text>
              <Text style={[styles.topicMeta, { color: colors.neutral.gray }, textFont.regular]}>
                by @{topic.created_by_username ?? 'deleted'} · {new Date(topic.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <Text style={[styles.topicBody, { color: colors.neutral.darkGray }, textFont.regular]}>
                {topic.body}
              </Text>
              <VoteRow
                usefulCount={topic.useful_count}
                notUsefulCount={topic.not_useful_count}
                myVote={topic.my_vote}
                onVote={handleTopicVote}
              />
            </View>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionLabel, { color: colors.neutral.darkGray }, textFont.semibold]}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>
              <View style={styles.sortPills}>
                {(['newest', 'most_liked'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setSortBy(opt)}
                    style={[
                      styles.sortPill,
                      sortBy === opt
                        ? { backgroundColor: colors.primary.main }
                        : { backgroundColor: colors.surface.glassBorder + '40', borderWidth: glass.borderWidth, borderColor: colors.surface.glassBorder },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: typography.fontSize.xs, color: sortBy === opt ? '#fff' : colors.neutral.gray }, textFont.medium]}>
                      {opt === 'newest' ? 'Newest' : 'Top'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {loading && (
              <ActivityIndicator color={colors.primary.main} style={{ marginTop: spacing.md }} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <CommentCard
            comment={item}
            onVote={handleCommentVote}
            onReply={(c) => { setReplyingTo(c); }}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: 'transparent' }}
        ListFooterComponent={<View style={{ height: tabBarOffset + 100 }} />}
      />

      {/* Comment input */}
      <View style={[styles.inputContainer, { backgroundColor: inputBg, borderTopColor: colors.surface.glassBorder, bottom: tabBarOffset }]}>
        {replyingTo && (
          <View style={[styles.replyingToBar, { backgroundColor: colors.primary.main + '20' }]}>
            <Text style={[{ color: colors.primary.main, fontSize: typography.fontSize.xs, flex: 1 }, textFont.medium]}>
              Replying to @{replyingTo.created_by_username}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={{ color: colors.neutral.gray, fontSize: typography.fontSize.sm }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.textInput, { color: colors.neutral.charcoal, borderColor: colors.surface.glassBorder }]}
            placeholder={isAuthenticated ? (replyingTo ? 'Write a reply…' : 'Write a comment…') : 'Sign in to comment'}
            placeholderTextColor={colors.neutral.gray}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            editable={isAuthenticated}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !commentText.trim()}
            style={[styles.sendBtn, { backgroundColor: colors.primary.main, opacity: commentText.trim() ? 1 : 0.4 }]}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[{ color: '#fff', fontSize: typography.fontSize.sm }, textFont.semibold]}>Send</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
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
  deleteBtn: { minWidth: 60, alignItems: 'flex-end' },

  listContent: { paddingHorizontal: spacing.lg },

  topicContainer: { paddingTop: spacing.md },
  topicCard: {
    borderRadius: borderRadius.lg,
    borderWidth: glass.borderWidth,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  topicTitle: {
    fontSize: typography.fontSize.lg,
    marginBottom: spacing.xs,
  },
  topicMeta: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.md,
  },
  topicBody: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    marginBottom: spacing.md,
  },

  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortPills: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },

  commentCard: {
    borderRadius: borderRadius.md,
    borderWidth: glass.borderWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  commentUser: { fontSize: typography.fontSize.sm },
  commentTime: { fontSize: typography.fontSize.xs },
  commentBody: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replyBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  repliesContainer: { marginTop: spacing.sm, gap: spacing.xs },

  voteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voteBtn: { borderRadius: borderRadius.sm },

  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: glass.borderWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  textInput: {
    flex: 1,
    borderWidth: glass.borderWidth,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 44,
  },
});
