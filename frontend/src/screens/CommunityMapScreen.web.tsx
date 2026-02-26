/**
 * CommunityMapScreen — web implementation using maplibre-gl
 * Light/dark style via versatiles. Search via maplibre-gl-geocoder + Nominatim.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

const LIGHT_STYLE = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';
const DARK_STYLE  = 'https://tiles.versatiles.org/assets/styles/eclipse/style.json';

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

export const CommunityMapScreen: React.FC = () => {
  const { isDark } = useTheme();
  const containerRef = useRef<View>(null);
  const mapRef       = useRef<any>(null);
  // Track isDark in a ref so the initialization effect can read the initial value
  // without re-running on theme changes (style update is handled separately).
  const isDarkRef = useRef(isDark);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // ── Inject & update geocoder/controls CSS when theme changes ──────────────
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
    const navIcon      = isDark ? '#e2e8f0'                      : '#1e293b';

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
    `);
  }, [isDark]);

  // ── Initialize map (once on mount) ────────────────────────────────────────
  useEffect(() => {
    const domNode = containerRef.current as unknown as HTMLElement;
    if (!domNode) return;

    let cancelled = false;

    // Inject vendor CSS via CDN (avoids Metro CSS bundling issues)
    injectLink('maplibre-gl-css',       'https://unpkg.com/maplibre-gl/dist/maplibre-gl.css');
    injectLink('maplibre-geocoder-css', 'https://unpkg.com/@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css');

    Promise.all([
      import('maplibre-gl'),
      import('@maplibre/maplibre-gl-geocoder'),
    ]).then(([mlMod, geocoderMod]) => {
      if (cancelled) return;

      const maplibregl        = (mlMod as any).default ?? mlMod;
      const MaplibreGeocoder  = (geocoderMod as any).default ?? geocoderMod;

      const map = new maplibregl.Map({
        container:         domNode,
        style:             isDarkRef.current ? DARK_STYLE : LIGHT_STYLE,
        center:            [-0.1278, 51.5074], // London — sensible default
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
  }, []); // intentionally empty — map is initialised once

  // ── Swap map style when light/dark changes ────────────────────────────────
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(isDark ? DARK_STYLE : LIGHT_STYLE);
    }
  }, [isDark]);

  return (
    <View style={styles.container}>
      <View ref={containerRef} style={styles.map} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
});

export default CommunityMapScreen;
