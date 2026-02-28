/**
 * CommunityMapScreen — web implementation using maplibre-gl
 * Light/dark style via versatiles. Search via maplibre-gl-geocoder + Nominatim.
 * Displays FoodX event markers with hover tooltips and a detail modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { api } from '@/services/api';
import type { FoodXEvent, EventCategory } from '@/types/community';
import { EventDetailModal } from './community/EventDetailModal';

const LIGHT_STYLE = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
const DARK_STYLE  = 'https://tiles.versatiles.org/assets/styles/eclipse/style.json';

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
  const el   = document.createElement('div');
  el.style.cssText = `
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
    cursor: pointer;
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
  el.appendChild(inner);

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'rotate(-45deg) scale(1.15)';
    el.style.boxShadow = `0 6px 20px rgba(0,0,0,0.4)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = 'rotate(-45deg) scale(1)';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  });

  return el;
}

export const CommunityMapScreen: React.FC = () => {
  const { isDark } = useTheme();
  const containerRef = useRef<View>(null);
  const mapRef       = useRef<any>(null);
  const isDarkRef    = useRef(isDark);
  const eventsRef    = useRef<FoodXEvent[]>([]);

  const [selectedEvent, setSelectedEvent] = useState<FoodXEvent | null>(null);

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
      }
      .maplibregl-ctrl-geocoder--icon-close {
        fill: ${iconFill} !important;
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
        events.forEach((event) => {
          const markerEl = createMarkerElement(event);
          const marker   = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
            .setLngLat([event.longitude, event.latitude])
            .addTo(map);

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

  return (
    <View style={styles.container}>
      <View ref={containerRef} style={styles.map} />
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
});

export default CommunityMapScreen;
