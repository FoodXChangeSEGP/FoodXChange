/**
 * Theme Palettes — dark & light color sets with identical shape.
 * NOVA / Nutri-Score colors are the same in both palettes (semantic health indicators).
 */

const shared = {
  primary: {
    dark: '#14532D',
    main: '#16A34A',
    light: '#4ADE80',
  },
  accent: {
    lime: '#73FF00',
    orange: '#FFB300',
    fuschia: '#FF1493',
  },
  semantic: {
    success: '#28A745',
    warning: '#FFB300',
    error: '#DC3545',
    info: '#17A2B8',
  },
  nova: {
    1: '#28A745',
    2: '#FFC107',
    3: '#FD7E14',
    4: '#DC3545',
  },
  nutriScore: {
    A: '#038141',
    B: '#85BB2F',
    C: '#FECB02',
    D: '#EE8100',
    E: '#E63E11',
  },
};

export const darkColors = {
  ...shared,
  primary: {
    dark: '#14532D',
    main: '#22C55E',
    light: '#4ADE80',
  },
  neutral: {
    white: '#FFFFFF',
    offWhite: '#0D1117',
    lightGray: '#30363D',
    gray: '#6B7B8D',
    darkGray: '#9BA4B5',
    charcoal: '#E6EDF3',
    black: '#F0F6FC',
  },
  surface: {
    card: '#161B22',
    elevated: '#1C2333',
    glass: 'rgba(255,255,255,0.06)',
  },
};

export const lightColors = {
  ...shared,
  primary: {
    dark: '#14532D',
    main: '#16A34A',
    light: '#4ADE80',
  },
  neutral: {
    white: '#FFFFFF',
    offWhite: '#F5F7FA',
    lightGray: '#E2E8F0',
    gray: '#94A3B8',
    darkGray: '#64748B',
    charcoal: '#1A1D23',
    black: '#0F172A',
  },
  surface: {
    card: '#FFFFFF',
    elevated: '#F8FAFC',
    glass: 'rgba(0,0,0,0.06)',
  },
};

export type ThemeColors = typeof darkColors;
