import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadii, StatusBgs } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusIndicatorProps {
  label: string;
  type?: StatusType;
}

export function StatusIndicator({ label, type = 'info' }: StatusIndicatorProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const themeStatusBgs = StatusBgs[colorScheme];

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: themeStatusBgs.success,
          text: themeColors.success,
        };
      case 'warning':
        return {
          bg: themeStatusBgs.warning,
          text: themeColors.warning,
        };
      case 'error':
        return {
          bg: themeStatusBgs.error,
          text: themeColors.error,
        };
      case 'neutral':
        return {
          bg: themeColors.backgroundSelected,
          text: themeColors.text,
        };
      case 'info':
      default:
        return {
          bg: themeColors.backgroundElement,
          text: themeColors.textSecondary,
        };
    }
  };


  const activeColors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: activeColors.bg }]}>
      <Text style={[styles.text, { color: activeColors.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadii.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
});
