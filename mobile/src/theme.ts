import { StyleSheet } from 'react-native';

export const COLORS = {
  surface: '#0a0a0a',
  surfaceContainer: '#1a1a1a',
  surfaceContainerHigh: '#222222',
  surfaceContainerHighest: '#2a2a2a',
  surfaceContainerLow: '#111111',
  primary: '#b6a0ff',
  primaryDim: '#8b6dff',
  secondary: '#00e3fd',
  onSurface: '#f0f0f0',
  onSurfaceVariant: '#888888',
  outlineVariant: '#333333',
  black: '#000000',
  white: '#ffffff',
  error: '#ff4a4a',
};

export const FONTS = {
  headline: {
    fontWeight: '900' as const,
  },
  bold: {
    fontWeight: '700' as const,
  },
  semiBold: {
    fontWeight: '600' as const,
  },
  regular: {
    fontWeight: '400' as const,
  },
};

export const globalStyles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
