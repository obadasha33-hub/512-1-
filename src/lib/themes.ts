export type ThemeName = 'Pinky' | 'Rose' | 'Ocean' | 'Matcha' | 'Vanilla' | 'Dracula' | 'Midnight';

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceContainer: string;
  accent: string;
  textMain: string;
  textSub: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  Pinky: {
    primary: '#FF4D94',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFD9E2',
    onPrimaryContainer: '#8E0048',
    background: '#FFF0F6',
    onBackground: '#26181B',
    surface: '#FFFFFF',
    onSurface: '#26181B',
    surfaceContainer: '#FFE8ED',
    accent: '#FF4D94',
    textMain: '#4A0E26',
    textSub: '#9E6079',
  },
  Rose: {
    primary: '#D8395F',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFD9E2',
    onPrimaryContainer: '#8E0048',
    background: '#FFF1F3',
    onBackground: '#26181B',
    surface: '#FFFFFF',
    onSurface: '#26181B',
    surfaceContainer: '#FCE2E7',
    accent: '#D8395F',
    textMain: '#501A2A',
    textSub: '#966072',
  },
  Ocean: {
    primary: '#0B7FAB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D1E6FF',
    onPrimaryContainer: '#003550',
    background: '#EAF8FF',
    onBackground: '#101C2B',
    surface: '#FFFFFF',
    onSurface: '#101C2B',
    surfaceContainer: '#D1EFFF',
    accent: '#0B7FAB',
    textMain: '#103447',
    textSub: '#5F8190',
  },
  Matcha: {
    primary: '#3F7D4A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DCEBDB',
    onPrimaryContainer: '#002206',
    background: '#F1F8EF',
    onBackground: '#1A1C19',
    surface: '#FFFFFF',
    onSurface: '#1A1C19',
    surfaceContainer: '#E2EEDF',
    accent: '#3F7D4A',
    textMain: '#1D3B25',
    textSub: '#6A836D',
  },
  Vanilla: {
    primary: '#A76A13',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFDDB3',
    onPrimaryContainer: '#291800',
    background: '#FFF9EC',
    onBackground: '#1F1B16',
    surface: '#FFFFFF',
    onSurface: '#1F1B16',
    surfaceContainer: '#F6EBD8',
    accent: '#A76A13',
    textMain: '#463012',
    textSub: '#8A7350',
  },
  Dracula: {
    primary: '#BD93F9',
    onPrimary: '#282A36',
    primaryContainer: '#44475A',
    onPrimaryContainer: '#F8F8F2',
    background: '#282A36',
    onBackground: '#F8F8F2',
    surface: '#343746',
    onSurface: '#F8F8F2',
    surfaceContainer: '#44475A',
    accent: '#BD93F9',
    textMain: '#F8F8F2',
    textSub: '#BFB7D5',
  },
  Midnight: {
    primary: '#00E5FF',
    onPrimary: '#00363D',
    primaryContainer: '#004F58',
    onPrimaryContainer: '#97F0FF',
    background: '#0B0B14',
    onBackground: '#E1E2E5',
    surface: '#181825',
    onSurface: '#E1E2E5',
    surfaceContainer: '#27273A',
    accent: '#00E5FF',
    textMain: '#FFFFFF',
    textSub: '#C0C0D0',
  },
};

export type FontStyle = 'Default' | 'Serif' | 'Monospace';

export const FONTS: Record<FontStyle, string> = {
  Default: 'Inter, sans-serif',
  Serif: '"Playfair Display", serif',
  Monospace: '"JetBrains Mono", monospace',
};
