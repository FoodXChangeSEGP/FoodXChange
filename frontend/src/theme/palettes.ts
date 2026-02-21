/**
 * Theme Palettes for Glassmorphism UI
 * Softer, more translucent colors optimized for frosted glass effects.
 * NOVA / Nutri-Score colors are semantic and identical across palettes.
 */

const shared = {
  accent: {
    lime: '#84CC16',
    orange: '#FB923C',
    fuschia: '#F472B6',
    cyan: '#22D3EE',
  },
  semantic: {
    success: '#22C55E',
    warning: '#FBBF24',
    error: '#EF4444',
    info: '#38BDF8',
  },
  nova: {
    1: '#22C55E',
    2: '#FBBF24',
    3: '#FB923C',
    4: '#EF4444',
  },
  nutriScore: {
    A: '#16A34A',
    B: '#84CC16',
    C: '#FBBF24',
    D: '#FB923C',
    E: '#EF4444',
  },
};

export const lightColors = {
  ...shared,
  primary: {
    dark: '#166534',
    main: '#22C55E',
    light: '#4ADE80',
    glow: '#86EFAC',
  },
  neutral: {
    white: '#FFFFFF',
    offWhite: '#F8FAFC',
    lightGray: '#E2E8F0',
    gray: '#94A3B8',
    darkGray: '#64748B',
    charcoal: '#1E293B',
    black: '#0F172A',
  },
  surface: {
    background: '#F1F5F9',
    card: 'rgba(255, 255, 255, 0.85)',
    elevated: 'rgba(255, 255, 255, 0.95)',
    glass: 'rgba(255, 255, 255, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.25)',
    glassOverlay: 'rgba(0, 0, 0, 0.02)',
  },
  gradient: {
    primary: ['#22C55E', '#16A34A'] as [string, string],
    accent: ['#84CC16', '#22C55E'] as [string, string],
    surface: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] as [string, string],
  },
};

export const darkColors = {
  ...shared,
  primary: {
    dark: '#166534',
    main: '#4ADE80',
    light: '#86EFAC',
    glow: '#BBF7D0',
  },
  neutral: {
    white: '#FFFFFF',
    offWhite: '#0F172A',
    lightGray: '#1E293B',
    gray: '#64748B',
    darkGray: '#94A3B8',
    charcoal: '#E2E8F0',
    black: '#F8FAFC',
  },
  surface: {
    background: '#020617',
    card: 'rgba(15, 23, 42, 0.92)',
    elevated: 'rgba(30, 41, 59, 0.97)',
    glass: 'rgba(15, 23, 42, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.10)',
    glassOverlay: 'rgba(255, 255, 255, 0.03)',
  },
  gradient: {
    primary: ['#4ADE80', '#22C55E'] as [string, string],
    accent: ['#86EFAC', '#4ADE80'] as [string, string],
    surface: ['rgba(15,23,42,0.9)', 'rgba(15,23,42,0.7)'] as [string, string],
  },
};

export type ThemeColors = typeof lightColors;
