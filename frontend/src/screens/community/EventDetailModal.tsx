import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { FoodXEvent, EventCategory } from '@/types/community';
import { ShareToFriendModal } from '@/components/ShareToFriendModal';

const CATEGORY_META: Record<EventCategory, { emoji: string; label: string; color: string }> = {
  festival:  { emoji: '🎪', label: 'Food Festival',    color: '#f59e0b' },
  market:    { emoji: '🛒', label: 'Food Market',      color: '#10b981' },
  swap:      { emoji: '🔄', label: 'Food Swap',        color: '#3b82f6' },
  workshop:  { emoji: '🍳', label: 'Workshop',         color: '#8b5cf6' },
  tasting:   { emoji: '🍷', label: 'Tasting',          color: '#ef4444' },
  community: { emoji: '🤝', label: 'Community Meal',   color: '#22c55e' },
  other:     { emoji: '📍', label: 'Event',            color: '#94a3b8' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  event: FoodXEvent | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<Props> = ({ event, onClose }) => {
  const { colors, isDark } = useTheme();
  const [shareVisible, setShareVisible] = useState(false);

  if (!event) return null;

  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.other;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      {/* Dim backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
        {/* Hero image */}
        {event.image_url ? (
          <Image
            source={{ uri: event.image_url }}
            style={styles.hero}
            resizeMode="cover"
          />
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

        {/* Share button */}
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)' }]}
          onPress={() => setShareVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={18} color={isDark ? '#e2e8f0' : '#1e293b'} />
        </TouchableOpacity>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Category badge */}
          <View style={[styles.badge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.emoji}  {meta.label}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{event.title}</Text>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={[styles.metaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                {formatDate(event.date)}
              </Text>
            </View>
            {event.event_time ? (
              <View style={styles.metaItem}>
                <Text style={styles.metaIcon}>🕐</Text>
                <Text style={[styles.metaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{event.event_time}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={[styles.metaText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{event.location_name}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{event.price}</Text>
              <Text style={[styles.statLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Price</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{event.attendee_count.toLocaleString()}</Text>
              <Text style={[styles.statLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Expected</Text>
            </View>
            {event.organizer ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>{event.organizer}</Text>
                  <Text style={[styles.statLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>Organiser</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Description */}
          <Text style={[styles.sectionLabel, { color: isDark ? '#64748b' : '#94a3b8' }]}>About this event</Text>
          <Text style={[styles.description, { color: isDark ? '#cbd5e1' : '#334155' }]}>
            {event.long_description || event.description}
          </Text>

          {/* Tags */}
          {event.tags?.length > 0 && (
            <View style={styles.tags}>
              {event.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.tagText, { color: isDark ? '#94a3b8' : '#64748b' }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      <ShareToFriendModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        contentType="event"
        contentId={event.id}
        contentTitle={event.title}
      />
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
  hero: {
    width: '100%',
    height: 200,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 64,
  },
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
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareBtn: {
    position: 'absolute',
    top: 16,
    right: 60,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
  },
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
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 180,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    fontSize: 13,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
  },
});

export default EventDetailModal;
