import React from 'react';
import { Pressable, Text, StyleSheet, PressableProps, ActivityIndicator } from 'react-native';
import { Colors, BorderRadii } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

interface PremiumButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline';
  loading?: boolean;
}

export function PremiumButton({ title, variant = 'primary', loading = false, style, disabled, ...props }: PremiumButtonProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const getButtonStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: themeColors.primary,
          textColor: themeColors.background,
        };
      case 'secondary':
        return {
          backgroundColor: themeColors.backgroundElement,
          textColor: themeColors.text,
        };
      case 'accent':
        return {
          backgroundColor: themeColors.backgroundSelected,
          textColor: themeColors.text,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          textColor: themeColors.text,
          borderWidth: 1.5,
          borderColor: themeColors.border,
        };
    }
  };

  const currentStyles = getButtonStyles();

  return (
    <Pressable
      style={(state) => [
        styles.base,
        {
          backgroundColor: currentStyles.backgroundColor,
          borderWidth: currentStyles.borderWidth ?? 0,
          borderColor: currentStyles.borderColor ?? 'transparent',
        },
        state.pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={disabled || loading}
      {...props}
    >

      {loading ? (
        <ActivityIndicator color={currentStyles.textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: currentStyles.textColor }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadii.xl,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
