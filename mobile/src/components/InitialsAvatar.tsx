import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name: string;
  size: number;
  borderRadius?: number;
  fontSize?: number;
  borderColor?: string;
  borderWidth?: number;
}

export const InitialsAvatar: React.FC<Props> = ({
  name,
  size,
  borderRadius,
  fontSize,
  borderColor,
  borderWidth = 2,
}) => {
  const initials = getInitials(name);
  const radius = borderRadius ?? size / 2;
  const fSize = fontSize ?? Math.floor(size * 0.36);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: borderColor ?? COLORS.primary,
          borderWidth,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: fSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: COLORS.primary,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
