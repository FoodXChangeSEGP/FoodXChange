/**
 * FoodXchange Theme Configuration
 * 
 * Design tokens extracted from Figma design:
 * https://www.figma.com/design/IQeh2ZpozJf1cD2sfYxYY4
 */

export const colors = {
  // Primary Colors (from Figma palette)
  primary: {
    dark: '#004000',      // Primary dark green - main brand color
    main: '#006400',      // Dark green variant
    light: '#228B22',     // Forest green
  },
  
  // Accent Colors
  accent: {
    lime: '#73FF00',      // Bright lime green - interactive elements
    orange: '#FFB300',    // Orange/amber - highlights, warnings
    fuschia: '#FF1493',   // Fuschia - special accents
  },
  
  // Neutral Colors
  neutral: {
    white: '#FFFFFF',
    offWhite: '#F8F9FA',
    lightGray: '#E9ECEF',
    gray: '#ADB5BD',
    darkGray: '#6C757D',
    charcoal: '#343A40',
    black: '#212529',
  },
  
  // Semantic Colors
  semantic: {
    success: '#28A745',
    warning: '#FFB300',
    error: '#DC3545',
    info: '#17A2B8',
  },
  
  // NOVA Score Colors
  nova: {
    1: '#28A745',  // Unprocessed - Green
    2: '#FFC107',  // Processed Ingredients - Yellow
    3: '#FD7E14',  // Processed - Orange
    4: '#DC3545',  // Ultra-Processed - Red
  },
  
  // Nutri-Score Colors
  nutriScore: {
    A: '#038141',  // Dark green
    B: '#85BB2F',  // Light green
    C: '#FECB02',  // Yellow
    D: '#EE8100',  // Orange
    E: '#E63E11',  // Red
  },
};

export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
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
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export type Theme = typeof theme;
export default theme;
