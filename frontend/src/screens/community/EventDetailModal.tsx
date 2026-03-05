import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/theme';
import { FoodXEvent, EventCategory, CommunityGroup } from '@/types/community';
import api from '@/services/api';

const CATEGORY_META: Record<EventCategory, { emoji: string; label: string; color: string }> = {
  festival:  { emoji: '🎪', label: 'Food Festival',    color: '#f59e0b' },
  market:    { emoji: '🛒', label: 'Food Market',      color: '#10b981' },
  swap:      { emoji: '🔄', label: 'Food Swap',        color: '#3b82f6' },
  workshop:  { emoji: '🍳', label: 'Workshop',         color: '#8b5cf6' },
  tasting:   { emoji: '🍷', label: 'Tasting',          color: '#ef4444' },
  community: { emoji: '🤝', label: 'Community Meal',   color: '#22c55e' },
  other:     { emoji: '📍', label: 'Event',            color: '#94a3b8' },
};

const GROUP_CATEGORY_ICONS: Record<string, string> = {
  food: '🥦', budget: '💰', local: '📍', health: '💪', recipes: '🍳', general: '💬',
};

// Maps event category → relevant group categories (in priority order)
const EVENT_TO_GROUP_CATS: Record<EventCategory, string[]> = {
  festival:  ['food', 'local'],
  market:    ['food', 'budget', 'local'],
  swap:      ['food', 'budget'],
  workshop:  ['recipes', 'health', 'food'],
  tasting:   ['food', 'recipes'],
  community: ['local', 'health', 'general'],
  other:     ['food', 'general'],
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  event: FoodXEvent | null;
  onClose: () => void;
  onNavigateToGroup?: (group: CommunityGroup) => void;
}

export const EventDetailModal: React.FC<Props> = ({ event, onClose, onNavigateToGroup }) => {
  const { colors, isDark } = useTheme();

  // Use the groups explicitly linked to this event; fall back to category-based suggestions
  // only if the event has no linked groups yet.
  const [relatedGroups, setRelatedGroups] = useState<CommunityGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  useEffect(() => {
    if (!event || !onNavigateToGroup) return;

    if (event.linked_groups && event.linked_groups.length > 0) {
      // Use explicitly linked groups — cast to CommunityGroup (fields are compatible)
      setRelatedGroups(event.linked_groups as unknown as CommunityGroup[]);
      setGroupsLoading(false);
      return;
    }

    // Fallback: auto-suggest by category
    setRelatedGroups([]);
    setGroupsLoading(true);
    api.community.listGroups()
      .then((all) => {
        const relevantCats = EVENT_TO_GROUP_CATS[event.category] ?? ['food'];
        const scored = all
          .map((g) => ({ g, score: relevantCats.indexOf(g.category) }))
          .filter(({ score }) => score !== -1)
          .sort((a, b) => a.score - b.score);
        setRelatedGroups(scored.slice(0, 3).map(({ g }) => g));
      })
      .catch(() => setRelatedGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [event?.id, !!onNavigateToGroup]);

  if (!event) return null;

  const meta  = CATEGORY_META[event.category] ?? CATEGORY_META.other;
  const bg    = isDark ? '#0f172a' : '#ffffff';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const text  = isDark ? '#f1f5f9' : '#0f172a';
  const divBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      {/* Dim backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        {/* Hero image */}
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: meta.color + '33' }]}>
            <Text style={styles.heroEmoji}>{meta.emoji}</Text>
          </View>
        )}

        {/* Close button */}
        <Pressable
          style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)' }]}
          onPress={onClose}
        >
          <Text style={[styles.closeBtnText, { color: isDark ? '#e2e8f0' : '#1e293b' }]}>✕</Text>
        </Pressable>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Category badge */}
          <View style={[styles.badge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.emoji}  {meta.label}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: text }]}>{event.title}</Text>

          {/* Meta rows */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={[styles.metaText, { color: muted }]}>{formatDate(event.date)}</Text>
            </View>
            {event.event_time ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>🕐</Text>
                <Text style={[styles.metaText, { color: muted }]}>{event.event_time}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={[styles.metaText, { color: muted }]}>{event.location_name}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: text }]}>{event.price}</Text>
              <Text style={[styles.statLabel, { color: muted }]}>Price</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: text }]}>{event.attendee_count.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: muted }]}>Expected</Text>
            </View>
            {event.organizer ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: text }]} numberOfLines={1}>{event.organizer}</Text>
                  <Text style={[styles.statLabel, { color: muted }]}>Organiser</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Description */}
          <Text style={[styles.sectionLabel, { color: muted }]}>About this event</Text>
          <Text style={[styles.description, { color: isDark ? '#cbd5e1' : '#334155' }]}>
            {event.long_description || event.description}
          </Text>

          {/* Tags */}
          {event.tags?.length > 0 && (
            <View style={styles.tags}>
              {event.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: divBg }]}>
                  <Text style={[styles.tagText, { color: muted }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Related Groups ─────────────────────────────────────────── */}
          {onNavigateToGroup && (
            <>
              <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]} />
              <Text style={[styles.sectionLabel, { color: muted }]}>
                {event.linked_groups?.length > 0 ? 'Linked Community Groups' : 'Related Community Groups'}
              </Text>

              {groupsLoading ? (
                <ActivityIndicator size="small" color={colors.primary.main} style={{ marginVertical: 12 }} />
              ) : relatedGroups.length === 0 ? (
                <Text style={[styles.noGroups, { color: muted }]}>No related groups found.</Text>
              ) : (
                relatedGroups.map((group) => {
                  const icon = GROUP_CATEGORY_ICONS[group.category] ?? '💬';
                  return (
                    <TouchableOpacity
                      key={group.id}
                      onPress={() => { onClose(); onNavigateToGroup(group); }}
                      style={[styles.groupCard, {
                        backgroundColor: isDark ? 'rgba(30,41,59,0.70)' : 'rgba(248,250,252,0.95)',
                        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      }]}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.groupIcon, { backgroundColor: colors.primary.main + '20' }]}>
                        <Text style={{ fontSize: 20 }}>{icon}</Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={[styles.groupName, { color: text }]} numberOfLines={1}>{group.name}</Text>
                        <Text style={[styles.groupMeta, { color: muted }]} numberOfLines={1}>
                          👥 {group.member_count} members · 📝 {group.topic_count} topics
                        </Text>
                      </View>
                      <Text style={[styles.groupArrow, { color: colors.primary.main }]}>›</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  hero: { width: '100%', height: 200 },
  heroPlaceholder: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 64 },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(12px)',
  } as any,
  closeBtnText: { fontSize: 16, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: 20 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28, marginBottom: 14 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 180 },
  metaIcon: { fontSize: 14 },
  metaText: { fontSize: 13, flex: 1 },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  statValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  description: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { fontSize: 12 },

  // Related groups
  divider: { height: 1, marginTop: 20, marginBottom: 20 },
  noGroups: { fontSize: 13, marginBottom: 12 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  groupMeta: { fontSize: 12 },
  groupArrow: { fontSize: 22, fontWeight: '300' },
});

export default EventDetailModal;
