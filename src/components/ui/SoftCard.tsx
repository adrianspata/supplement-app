import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { Colors, BorderRadii, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

interface SoftCardProps extends ViewProps {
  children?: React.ReactNode;
  variant?: 'flat' | 'elevated' | 'outline';
}

export function SoftCard({ children, style, variant = 'elevated', ...props }: SoftCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const cardStyle = [
    styles.base,
    {
      backgroundColor: themeColors.background,
      borderColor: themeColors.border,
    },
    variant === 'elevated' && {
      ...Shadows.premium,
      borderWidth: 1,
      borderColor: themeColors.borderMuted,
    },
    variant === 'outline' && {
      borderWidth: 1.5,
    },
    variant === 'flat' && {
      backgroundColor: themeColors.backgroundSecondary,
    },
    style,
  ];

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadii.xxl,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 20,
  },
});
