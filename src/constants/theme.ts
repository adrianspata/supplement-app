import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Standard keys for compatibility
    text: '#1C1C1E',
    background: '#F4F4F6', // Light grey/off-white screen background (Bevel style)
    backgroundElement: '#EBEAEF',
    backgroundSelected: '#E5E5EA',
    textSecondary: '#636366',
    textMuted: '#8E8E93',

    // Premium custom keys
    backgroundSecondary: '#FFFFFF', // Pure white card background (Bevel style)
    border: '#E5E5EA',
    borderMuted: '#F2F2F7',
    primary: '#1C1C1E',

    success: '#34C759', // Bevel green
    warning: '#FF9500', // Bevel orange
    error: '#FF3B30', // Bevel red
  },
  dark: {
    text: '#FFFFFF',
    background: '#111111',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    textSecondary: '#A0A0A0',
    textMuted: '#6B6B6B',

    backgroundSecondary: '#1C1C1E',
    border: '#2C2C2E',
    borderMuted: '#1C1C1E',
    primary: '#FFFFFF',

    success: '#22C55E',
    warning: '#F59E0B',
    error: '#F59E0B',
  },
} as const;

export const StatusBgs = {
  light: {
    success: '#F0FDF4',
    warning: '#FFFBEB',
    error: '#FFFBEB',
  },
  dark: {
    success: '#14532D',
    warning: '#78350F',
    error: '#78350F',
  },
} as const;


export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  // Detailed semantic names
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const BorderRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Shadows = {
  premium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  low: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
  },
  glowing: {
    shadowColor: '#8F7EEC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 4,
  },
};

export const Atmospheres = {
  light: {
    neutralGlow: ['rgba(240, 240, 240, 0.7)', 'rgba(255, 255, 255, 0)'],
    greenGlow: ['rgba(240, 253, 244, 0.7)', 'rgba(255, 255, 255, 0)'],
    orangeGlow: ['rgba(255, 251, 235, 0.7)', 'rgba(255, 255, 255, 0)'],
  },
  dark: {
    neutralGlow: ['rgba(30, 30, 30, 0.4)', 'rgba(17, 17, 17, 0)'],
    greenGlow: ['rgba(20, 83, 45, 0.4)', 'rgba(17, 17, 17, 0)'],
    orangeGlow: ['rgba(120, 53, 15, 0.4)', 'rgba(17, 17, 17, 0)'],
  }
} as const;

export const BlurLevels = {
  level1: 20,
  level2: 40,
  level3: 60,
} as const;

export const Motion = {
  spring: {
    stiffness: 200,
    damping: 20,
    mass: 1,
  },
  press: {
    scale: 0.98,
    opacity: 0.9,
  }
} as const;

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodySemiBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  subheadline: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
  },
};

export const ChartColors = {
  light: {
    primary: '#111111',
    secondary: '#A0A0A0',
    accent: '#111111', // Monochrome by default, will use semantic green/orange in usage
    background: '#F7F7F7',
    gridLines: '#EAEAEA',
  },
  dark: {
    primary: '#FFFFFF',
    secondary: '#6B6B6B',
    accent: '#FFFFFF',
    background: '#1C1C1E',
    gridLines: '#2C2C2E',
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Layout = {
  screenPadding: 24,
  bottomTabPadding: 140,
  maxContentWidth: 640,
};

export function getContentContainerStyle(isTabScreen: boolean = true) {
  return {
    width: "100%" as const,
    maxWidth: Layout.maxContentWidth,
    alignSelf: "center" as const,
    paddingHorizontal: Layout.screenPadding,
    paddingBottom: isTabScreen ? Layout.bottomTabPadding : 40,
  };
}


