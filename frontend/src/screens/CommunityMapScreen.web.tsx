/**
 * CommunityMapScreen — web implementation using maplibre-gl
 * Light/dark style via versatiles. Search via maplibre-gl-geocoder + Nominatim.
 * Displays FoodX event markers with hover tooltips and a detail modal.
 * Authenticated users can suggest new events via the floating "+" button.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Modal, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@/theme';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import type { FoodXEvent, EventCategory, CommunityGroup } from '@/types/community';
import { EventDetailModal } from './community/EventDetailModal';

const LIGHT_STYLE = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
const DARK_STYLE  = 'https://tiles.versatiles.org/assets/styles/eclipse/style.json';

// ── Styles (hoisted above components so they're always initialized first) ─────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
});

const mapStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 108,
    right: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%' as any,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBtnText: {
    fontSize: 20,
  },
  locationSet: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 90,
  },

  // Filter bar
  filterBar: {
    position: 'absolute',
    top: 84,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 4,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

const CATEGORY_META: Record<EventCategory, { emoji: string; color: string; label: string }> = {
  festival:  { emoji: '🎪', color: '#f59e0b', label: 'Food Festival' },
  market:    { emoji: '🛒', color: '#10b981', label: 'Food Market' },
  swap:      { emoji: '🔄', color: '#3b82f6', label: 'Food Swap' },
  workshop:  { emoji: '🍳', color: '#8b5cf6', label: 'Workshop' },
  tasting:   { emoji: '🍷', color: '#ef4444', label: 'Tasting' },
  community: { emoji: '🤝', color: '#22c55e', label: 'Community Meal' },
  other:     { emoji: '📍', color: '#94a3b8', label: 'Event' },
};

function injectLink(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function upsertStyle(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el    = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/** Nominatim-backed geocoder API compatible with maplibre-gl-geocoder */
const geocoderApi = {
  forwardGeocode: async (config: { query: string }) => {
    const features: any[] = [];
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(config.query)}&format=geojson&addressdetails=1&limit=5`;
      const resp   = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const geojson = await resp.json();
      for (const f of geojson.features ?? []) {
        const bbox   = f.bbox ?? [-0.5, 51.2, 0.3, 51.8];
        const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as [number, number];
        features.push({
          type: 'Feature',
          geometry:   { type: 'Point', coordinates: center },
          place_name: f.properties.display_name,
          properties: f.properties,
          text:       f.properties.display_name,
          place_type: ['place'],
          center,
          bbox,
        });
      }
    } catch (e) {
      console.error('Geocode error:', e);
    }
    return { features };
  },
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function buildPopupHtml(event: FoodXEvent, isDark: boolean): string {
  const meta  = CATEGORY_META[event.category] ?? CATEGORY_META.other;
  const bg    = isDark ? 'rgba(8,14,30,0.95)' : 'rgba(255,255,255,0.97)';
  const text  = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const btn   = meta.color;
  const img   = event.image_url ? `<img src="${event.image_url}" style="width:100%;height:110px;object-fit:cover;display:block;" />` : '';
  const shortDesc = event.description.length > 80 ? event.description.slice(0, 80) + '…' : event.description;

  return `
    <div style="font-family:'Space Grotesk',system-ui,sans-serif;min-width:230px;max-width:260px;background:${bg};border-radius:16px;overflow:hidden;">
      ${img}
      <div style="padding:12px 14px 14px;">
        <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${meta.color}22;color:${meta.color};margin-bottom:8px;">${meta.emoji} ${meta.label}</div>
        <div style="font-size:14px;font-weight:700;color:${text};margin-bottom:4px;line-height:1.3;">${event.title}</div>
        <div style="font-size:11px;color:${muted};margin-bottom:4px;">📅 ${formatShortDate(event.date)}${event.event_time ? ' · ' + event.event_time : ''}</div>
        <div style="font-size:11px;color:${muted};margin-bottom:10px;line-height:1.4;">${shortDesc}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;color:${text};">${event.price}</span>
          <span style="font-size:11px;color:${muted};">👥 ${event.attendee_count.toLocaleString()} expected</span>
        </div>
        <button
          onclick="window.__openFoodXEvent(${event.id})"
          style="width:100%;padding:9px 0;background:${btn};color:#fff;border:none;border-radius:10px;font-family:'Space Grotesk',system-ui,sans-serif;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.3px;"
        >View Details →</button>
      </div>
    </div>
  `;
}

function createMarkerElement(event: FoodXEvent): HTMLElement {
  const meta = CATEGORY_META[event.category] ?? CATEGORY_META.other;

  // Outer wrapper — maplibre-gl controls this element's `transform` for positioning.
  // Must NOT have transform or transition to avoid conflicts with map panning.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    width: 40px;
    height: 40px;
    cursor: pointer;
  `;

  // Visual pin — all visual transforms and transitions live here (child element).
  const pin = document.createElement('div');
  pin.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: ${meta.color};
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  `;

  const inner = document.createElement('div');
  inner.style.cssText = `
    transform: rotate(45deg);
    font-size: 18px;
    line-height: 1;
    margin-top: -2px;
  `;
  inner.textContent = meta.emoji;
  pin.appendChild(inner);
  wrapper.appendChild(pin);

  wrapper.addEventListener('mouseenter', () => {
    pin.style.transform = 'rotate(-45deg) scale(1.15)';
    pin.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
  });
  wrapper.addEventListener('mouseleave', () => {
    pin.style.transform = 'rotate(-45deg) scale(1)';
    pin.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });

  return wrapper;
}

const EVENT_CATEGORIES: { value: EventCategory; label: string; emoji: string }[] = [
  { value: 'market',    label: 'Food Market',    emoji: '🛒' },
  { value: 'festival',  label: 'Food Festival',  emoji: '🎪' },
  { value: 'swap',      label: 'Food Swap',      emoji: '🔄' },
  { value: 'workshop',  label: 'Workshop',       emoji: '🍳' },
  { value: 'tasting',   label: 'Tasting',        emoji: '🍷' },
  { value: 'community', label: 'Community Meal', emoji: '🤝' },
  { value: 'other',     label: 'Other',          emoji: '📍' },
];

interface SuggestEventForm {
  title: string;
  description: string;
  location_name: string;
  latitude: string;
  longitude: string;
  date: string;
  event_time: string;
  category: EventCategory;
  organizer: string;
  price: string;
}

const EMPTY_FORM: SuggestEventForm = {
  title: '', description: '', location_name: '',
  latitude: '', longitude: '', date: '',
  event_time: '', category: 'other', organizer: '', price: 'Free',
};

const SuggestEventModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreated: (event: FoodXEvent) => void;
}> = ({ visible, onClose, onCreated }) => {
  const { colors, isDark } = useTheme();
  const [form, setForm] = useState<SuggestEventForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');

  const cardBg  = isDark ? 'rgba(15,23,42,0.98)' : 'rgba(248,250,252,0.99)';
  const inputBg = isDark ? 'rgba(30,41,59,0.70)' : 'rgba(255,255,255,0.90)';
  const border  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const textCol = isDark ? '#f1f5f9' : '#0f172a';
  const mutedCol = isDark ? '#94a3b8' : '#64748b';

  const set = (key: keyof SuggestEventForm, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const searchLocation = async () => {
    if (!locationQuery.trim()) return;
    setLocationSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const results = await resp.json();
      if (results.length > 0) {
        const r = results[0];
        setForm(prev => ({
          ...prev,
          location_name: r.display_name,
          latitude: parseFloat(r.lat).toFixed(6),
          longitude: parseFloat(r.lon).toFixed(6),
        }));
        setLocationQuery('');
      } else {
        Alert.alert('Location not found', 'Try a more specific address or postcode.');
      }
    } catch {
      Alert.alert('Error', 'Could not search for location.');
    } finally {
      setLocationSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.location_name.trim() || !form.date.trim()) {
      Alert.alert('Required fields', 'Please fill in title, description, location, and date.');
      return;
    }
    if (!form.latitude || !form.longitude) {
      Alert.alert('Location required', 'Please search for a location to set the map pin.');
      return;
    }
    setLoading(true);
    try {
      const created = await api.community.createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        location_name: form.location_name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        date: form.date.trim(),
        event_time: form.event_time.trim() || undefined,
        category: form.category,
        organizer: form.organizer.trim() || undefined,
        price: form.price.trim() || 'Free',
      });
      onCreated(created);
      setForm(EMPTY_FORM);
      setLocationQuery('');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not submit your event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [mapStyles.input, { backgroundColor: inputBg, borderColor: border, color: textCol }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[mapStyles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[mapStyles.modalCard, { backgroundColor: cardBg, borderColor: border }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[mapStyles.modalTitle, { color: textCol }]}>Suggest an Event</Text>
            <Text style={[mapStyles.modalSubtitle, { color: mutedCol }]}>
              Share a local food event with the community
            </Text>

            {/* Title */}
            <Text style={[mapStyles.label, { color: mutedCol }]}>Event title *</Text>
            <TextInput
              style={inputStyle}
              placeholder="e.g. Hackney Food Swap"
              placeholderTextColor={mutedCol}
              value={form.title}
              onChangeText={v => set('title', v)}
            />

            {/* Description */}
            <Text style={[mapStyles.label, { color: mutedCol }]}>Description *</Text>
            <TextInput
              style={[...inputStyle, mapStyles.textarea]}
              placeholder="What's this event about?"
              placeholderTextColor={mutedCol}
              value={form.description}
              onChangeText={v => set('description', v)}
              multiline
              numberOfLines={3}
            />

            {/* Location search */}
            <Text style={[mapStyles.label, { color: mutedCol }]}>Location *</Text>
            <View style={mapStyles.locationRow}>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder="Search postcode or address…"
                placeholderTextColor={mutedCol}
                value={locationQuery}
                onChangeText={setLocationQuery}
                onSubmitEditing={searchLocation}
              />
              <TouchableOpacity
                onPress={searchLocation}
                disabled={locationSearching}
                style={[mapStyles.locationBtn, { backgroundColor: colors.primary.main }]}
                activeOpacity={0.8}
              >
                {locationSearching
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={mapStyles.locationBtnText}>📍</Text>
                }
              </TouchableOpacity>
            </View>
            {form.location_name ? (
              <Text style={[mapStyles.locationSet, { color: colors.primary.main }]}>
                ✓ {form.location_name}
              </Text>
            ) : null}

            {/* Date + Time */}
            <View style={mapStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[mapStyles.label, { color: mutedCol }]}>Date * (YYYY-MM-DD)</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="2026-05-01"
                  placeholderTextColor={mutedCol}
                  value={form.date}
                  onChangeText={v => set('date', v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[mapStyles.label, { color: mutedCol }]}>Time</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="10:00 AM – 4:00 PM"
                  placeholderTextColor={mutedCol}
                  value={form.event_time}
                  onChangeText={v => set('event_time', v)}
                />
              </View>
            </View>

            {/* Category */}
            <Text style={[mapStyles.label, { color: mutedCol }]}>Category</Text>
            <View style={mapStyles.categoryGrid}>
              {EVENT_CATEGORIES.map(cat => {
                const active = form.category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => set('category', cat.value)}
                    style={[
                      mapStyles.catChip,
                      {
                        backgroundColor: active ? colors.primary.main + '25' : 'transparent',
                        borderColor: active ? colors.primary.main : border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: active ? colors.primary.main : mutedCol }}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Organiser + Price */}
            <View style={mapStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[mapStyles.label, { color: mutedCol }]}>Organiser</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="Your name / org"
                  placeholderTextColor={mutedCol}
                  value={form.organizer}
                  onChangeText={v => set('organizer', v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[mapStyles.label, { color: mutedCol }]}>Price</Text>
                <TextInput
                  style={inputStyle}
                  placeholder="Free"
                  placeholderTextColor={mutedCol}
                  value={form.price}
                  onChangeText={v => set('price', v)}
                />
              </View>
            </View>

            {/* Actions */}
            <View style={mapStyles.modalActions}>
              <TouchableOpacity
                onPress={onClose}
                style={[mapStyles.modalBtn, { borderColor: border, borderWidth: 1 }]}
                activeOpacity={0.8}
              >
                <Text style={{ color: mutedCol, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[mapStyles.modalBtn, { backgroundColor: colors.primary.main }]}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Event</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

interface Props {
  onNavigateToGroup?: (group: CommunityGroup) => void;
}

export const CommunityMapScreen: React.FC<Props> = ({ onNavigateToGroup }) => {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const containerRef = useRef<View>(null);
  const mapRef       = useRef<any>(null);
  const isDarkRef    = useRef(isDark);
  const eventsRef    = useRef<FoodXEvent[]>([]);
  // Each entry: { el: HTMLElement (marker wrapper), category: EventCategory }
  const markersRef   = useRef<{ el: HTMLElement; category: EventCategory }[]>([]);

  const [selectedEvent, setSelectedEvent]   = useState<FoodXEvent | null>(null);
  const [showSuggest, setShowSuggest]       = useState(false);
  const [activeFilter, setActiveFilter]     = useState<EventCategory | 'all'>('all');

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Expose event opener to popup button onclick
  useEffect(() => {
    (window as any).__openFoodXEvent = (id: number) => {
      const ev = eventsRef.current.find((e) => e.id === id) ?? null;
      setSelectedEvent(ev);
    };
    return () => { delete (window as any).__openFoodXEvent; };
  }, []);

  // ── Inject & update geocoder/controls/popup CSS when theme changes ─────────
  useEffect(() => {
    const bg           = isDark ? 'rgba(8,14,30,0.88)'          : 'rgba(255,255,255,0.88)';
    const border       = isDark ? 'rgba(255,255,255,0.10)'       : 'rgba(255,255,255,0.70)';
    const textColor    = isDark ? '#e2e8f0'                      : '#1e293b';
    const placeholder  = isDark ? '#64748b'                      : '#94a3b8';
    const suggestionBg = isDark ? 'rgba(15,23,42,0.97)'          : 'rgba(255,255,255,0.97)';
    const hoverBg      = isDark ? 'rgba(74,222,128,0.12)'        : 'rgba(34,197,94,0.08)';
    const accentColor  = isDark ? '#4ade80'                      : '#22c55e';
    const iconFill     = isDark ? '#64748b'                      : '#94a3b8';
    const navBg        = isDark ? 'rgba(8,14,30,0.88)'           : 'rgba(255,255,255,0.88)';
    const navBorder    = isDark ? 'rgba(255,255,255,0.10)'       : 'rgba(255,255,255,0.70)';

    upsertStyle('community-map-theme', `
      /* ── Position geocoder full-width at the top ── */
      .maplibregl-ctrl-top-left {
        width: 100%;
        padding: 16px 24px;
        box-sizing: border-box;
      }
      .maplibregl-ctrl-top-left .maplibregl-ctrl {
        margin: 0;
        float: none;
      }

      /* ── Glassmorphic geocoder ── */
      .maplibregl-ctrl-geocoder {
        background: ${bg} !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid ${border} !important;
        border-radius: 26px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        height: 52px !important;
      }
      .maplibregl-ctrl-geocoder--input {
        color: ${textColor} !important;
        background: transparent !important;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif !important;
        font-size: 15px !important;
        height: 52px !important;
        line-height: 52px !important;
      }
      .maplibregl-ctrl-geocoder--input::placeholder {
        color: ${placeholder} !important;
      }
      .maplibregl-ctrl-geocoder--icon {
        fill: ${iconFill} !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
      .maplibregl-ctrl-geocoder--icon-close {
        fill: ${iconFill} !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }

      /* ── Suggestions dropdown ── */
      .maplibregl-ctrl-geocoder .suggestions {
        background: ${suggestionBg} !important;
        border: 1px solid ${border} !important;
        border-top: none !important;
        border-radius: 0 0 20px 20px !important;
        box-shadow: 0 12px 24px rgba(0,0,0,0.15) !important;
        backdrop-filter: blur(24px) !important;
        -webkit-backdrop-filter: blur(24px) !important;
        overflow: hidden !important;
      }
      .maplibregl-ctrl-geocoder .suggestions li > a {
        color: ${textColor} !important;
        font-family: "Space Grotesk", system-ui, -apple-system, sans-serif !important;
        font-size: 13px !important;
      }
      .maplibregl-ctrl-geocoder .suggestions li:hover > a,
      .maplibregl-ctrl-geocoder .suggestions .active > a {
        background: ${hoverBg} !important;
        color: ${accentColor} !important;
      }
      .maplibregl-ctrl-geocoder .suggestions li .maplibregl-ctrl-geocoder--suggestion-title {
        color: ${textColor} !important;
      }
      .maplibregl-ctrl-geocoder .suggestions li .maplibregl-ctrl-geocoder--suggestion-address {
        color: ${placeholder} !important;
      }

      /* ── Navigation control ── */
      .maplibregl-ctrl-group {
        background: ${navBg} !important;
        backdrop-filter: blur(24px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
        border: 1px solid ${navBorder} !important;
        border-radius: 14px !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
        overflow: hidden !important;
      }
      .maplibregl-ctrl-group button {
        background: transparent !important;
      }
      .maplibregl-ctrl-group button:hover {
        background: ${hoverBg} !important;
      }
      .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon,
      .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon,
      .maplibregl-ctrl-compass .maplibregl-ctrl-icon {
        filter: ${isDark ? 'invert(1) brightness(0.8)' : 'none'} !important;
      }
      .maplibregl-ctrl-group button + button {
        border-top: 1px solid ${navBorder} !important;
      }

      /* ── Attribution ── */
      .maplibregl-ctrl-attrib {
        background: ${bg} !important;
        color: ${placeholder} !important;
        border-radius: 8px !important;
        font-family: "Space Grotesk", system-ui, sans-serif !important;
        font-size: 11px !important;
        border: 1px solid ${border} !important;
      }
      .maplibregl-ctrl-attrib a { color: ${accentColor} !important; }

      /* ── Push bottom controls above the floating tab bar (~88 px) ── */
      .maplibregl-ctrl-bottom-right,
      .maplibregl-ctrl-bottom-left {
        bottom: 88px !important;
      }

      /* ── Event popup ── */
      .maplibregl-popup-content {
        padding: 0 !important;
        background: transparent !important;
        border-radius: 16px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.25) !important;
        overflow: hidden !important;
      }
      .maplibregl-popup-tip {
        border-top-color: ${isDark ? 'rgba(8,14,30,0.95)' : 'rgba(255,255,255,0.97)'} !important;
      }
      .maplibregl-popup-close-button {
        display: none !important;
      }
    `);
  }, [isDark]);

  // ── Initialize map (once on mount) ────────────────────────────────────────
  useEffect(() => {
    const domNode = containerRef.current as unknown as HTMLElement;
    if (!domNode) return;

    let cancelled = false;

    injectLink('maplibre-gl-css',       'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css');
    injectLink('maplibre-geocoder-css', 'https://unpkg.com/@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css');

    Promise.all([
      import('maplibre-gl'),
      import('@maplibre/maplibre-gl-geocoder'),
      api.community.listEvents(),
    ]).then(([mlMod, geocoderMod, events]) => {
      if (cancelled) return;

      eventsRef.current = events;

      const maplibregl        = (mlMod as any).default ?? mlMod;
      const MaplibreGeocoder  = (geocoderMod as any).default ?? geocoderMod;

      const map = new maplibregl.Map({
        container:         domNode,
        style:             isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
        center:            [-0.1278, 51.5074],
        zoom:              10,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');

      const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl,
        placeholder:             'Search postcode or area\u2026',
        showResultsWhileTyping:  true,
        flyTo:                   true,
        zoom:                    14,
      });
      map.addControl(geocoder, 'top-left');

      // Track open popup so we can close it on re-click
      let activePopup: any = null;
      let activeEventId: number | null = null;

      // Add a marker for each event once the map style has loaded
      const addMarkers = () => {
        markersRef.current = [];
        events.forEach((event) => {
          const markerEl = createMarkerElement(event);
          new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
            .setLngLat([event.longitude, event.latitude])
            .addTo(map);
          // Store the DOM element + category so filter can show/hide it
          markersRef.current.push({ el: markerEl, category: event.category });

          const openPopup = () => {
            if (activeEventId === event.id && activePopup) {
              activePopup.remove();
              activePopup  = null;
              activeEventId = null;
              return;
            }
            if (activePopup) activePopup.remove();

            const popup = new maplibregl.Popup({
              offset:      [0, -44],
              closeButton: false,
              closeOnClick: false,
              maxWidth:    'none',
            })
              .setLngLat([event.longitude, event.latitude])
              .setHTML(buildPopupHtml(event, isDarkRef.current))
              .addTo(map);

            activePopup   = popup;
            activeEventId = event.id;

            popup.on('close', () => {
              if (activeEventId === event.id) {
                activePopup   = null;
                activeEventId = null;
              }
            });
          };

          // Hover (desktop)
          markerEl.addEventListener('mouseenter', openPopup);

          // Click — also works on touch
          markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openPopup();
          });
        });

        // Close popup when clicking the map background
        map.on('click', () => {
          if (activePopup) {
            activePopup.remove();
            activePopup   = null;
            activeEventId = null;
          }
        });
      };

      if (map.isStyleLoaded()) {
        addMarkers();
      } else {
        map.once('load', addMarkers);
      }

      mapRef.current = map;
    }).catch((err: unknown) => {
      console.error('[CommunityMap] failed to load maplibre-gl:', err);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // intentionally empty

  // ── Swap map style when light/dark changes ────────────────────────────────
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
    }
  }, [isDark]);

  // ── Show/hide markers when filter changes ─────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, category }) => {
      el.style.display = (activeFilter === 'all' || category === activeFilter) ? '' : 'none';
    });
  }, [activeFilter]);

  const handleEventCreated = async (event: FoodXEvent) => {
    eventsRef.current = [...eventsRef.current, event];
    Alert.alert('Event submitted! 🎉', 'Your event has been added to the map.');

    if (mapRef.current) {
      try {
        const [mlMod] = await Promise.all([import('maplibre-gl')]);
        const maplibregl = (mlMod as any).default ?? mlMod;
        const markerEl = createMarkerElement(event);
        new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
          .setLngLat([event.longitude, event.latitude])
          .addTo(mapRef.current);
        // Register in markersRef so the filter applies to it too
        markersRef.current.push({ el: markerEl, category: event.category });
        // Apply current filter immediately
        if (activeFilter !== 'all' && event.category !== activeFilter) {
          markerEl.style.display = 'none';
        }
        mapRef.current.flyTo({ center: [event.longitude, event.latitude], zoom: 14 });
      } catch { /* map may have unmounted */ }
    }
  };

  const pillBg    = isDark ? 'rgba(8,14,30,0.88)'    : 'rgba(255,255,255,0.88)';
  const pillBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const pillText   = isDark ? '#e2e8f0'               : '#1e293b';

  return (
    <View style={styles.container}>
      <View ref={containerRef} style={styles.map} />

      {/* ── Category filter pills ── */}
      <View style={mapStyles.filterBar} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {/* "All" pill */}
          {([{ value: 'all', emoji: '🗺️', label: 'All' }, ...EVENT_CATEGORIES] as const).map((cat) => {
            const isAll = cat.value === 'all';
            const active = activeFilter === cat.value;
            const meta = isAll ? null : CATEGORY_META[cat.value as EventCategory];
            const accentColor = isAll ? '#22c55e' : (meta?.color ?? '#94a3b8');
            return (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setActiveFilter(cat.value as EventCategory | 'all')}
                style={[
                  mapStyles.filterPill,
                  {
                    backgroundColor: active
                      ? accentColor + '22'
                      : pillBg,
                    borderColor: active ? accentColor : pillBorder,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    elevation: 3,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                <Text style={[mapStyles.filterPillText, { color: active ? accentColor : pillText }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Floating "suggest event" button — only for authenticated users */}
      {isAuthenticated && (
        <TouchableOpacity
          onPress={() => setShowSuggest(true)}
          style={[mapStyles.fab, { backgroundColor: '#22c55e' }]}
          activeOpacity={0.85}
        >
          <Text style={mapStyles.fabText}>＋ Suggest Event</Text>
        </TouchableOpacity>
      )}

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onNavigateToGroup={onNavigateToGroup}
      />
      <SuggestEventModal
        visible={showSuggest}
        onClose={() => setShowSuggest(false)}
        onCreated={handleEventCreated}
      />
    </View>
  );
};

export default CommunityMapScreen;
