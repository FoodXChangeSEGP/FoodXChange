import { Platform } from 'react-native';

export { useTheme, ThemeProvider } from './ThemeContext';
export type { ThemeColors } from './palettes';

export const colors = {
  primary: {
    dark: '#166534',
    main: '#22C55E',
    light: '#4ADE80',
    glow: '#86EFAC',
  },

  accent: {
    lime: '#84CC16',
    orange: '#FB923C',
    fuschia: '#F472B6',
    cyan: '#22D3EE',
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
  } as Record<number, string>,

  nutriScore: {
    A: '#16A34A',
    B: '#84CC16',
    C: '#FBBF24',
    D: '#FB923C',
    E: '#EF4444',
  } as Record<string, string>,
};

export const glass = {
  blur: {
    subtle: 15,
    medium: 25,
    heavy: 40,
    extreme: 60,
  },
  opacity: {
    light: { tint: 0.75, border: 0.12, shadow: 0.08 },
    dark: { tint: 0.65, border: 0.15, shadow: 0.25 },
  },
  borderWidth: 1,
};

export const typography = {
  fontFamily: {
    regular: 'SpaceGrotesk-Regular',
    medium: 'SpaceGrotesk-Medium',
    semibold: 'SpaceGrotesk-SemiBold',
    bold: 'SpaceGrotesk-Bold',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

const _webFont = (weight: '300' | '400' | '500' | '600' | '700') =>
  ({ fontFamily: '"Space Grotesk", system-ui, -apple-system, sans-serif', fontWeight: weight } as const);

export const textFont = {
  regular:  Platform.OS === 'web' ? _webFont('400') : ({ fontFamily: 'SpaceGrotesk-Regular'  } as const),
  medium:   Platform.OS === 'web' ? _webFont('500') : ({ fontFamily: 'SpaceGrotesk-Medium'   } as const),
  semibold: Platform.OS === 'web' ? _webFont('600') : ({ fontFamily: 'SpaceGrotesk-SemiBold' } as const),
  bold:     Platform.OS === 'web' ? _webFont('700') : ({ fontFamily: 'SpaceGrotesk-Bold'     } as const),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  base: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
  screenPadding: 32,
};

export const borderRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const glassShadows = {
  glow: {
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const getNovaColor = (score: number | null): string => {
  if (score === null) return colors.neutral.gray;
  return colors.nova[score as keyof typeof colors.nova] || colors.neutral.gray;
};

export const getNutriScoreColor = (grade: string | null): string => {
  if (!grade) return colors.neutral.gray;
  const normalizedGrade = grade.toUpperCase();
  return colors.nutriScore[normalizedGrade as keyof typeof colors.nutriScore] || colors.neutral.gray;
};

export const trafficLightColors = {
  green: '#22C55E',
  amber: '#FBBF24',
  red: '#EF4444',
  unknown: colors.neutral.lightGray,
} as const;

export const getTrafficLightColor = (level: string): string => {
  return trafficLightColors[level as keyof typeof trafficLightColors] || trafficLightColors.unknown;
};

export const theme = {
  colors,
  glass,
  glassShadows,
  typography,
  textFont,
  spacing,
  borderRadius,
  shadows,
  getNovaColor,
  getNutriScoreColor,
  getTrafficLightColor,
  trafficLightColors,
};

export type Theme = typeof theme;
export default theme;
