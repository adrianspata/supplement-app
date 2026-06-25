import { GlassSurface } from './GlassSurface';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';
import { Atmospheres, BlurLevels, BorderRadii, Colors, Motion, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export type SurfaceVariant = 'default' | 'elevated' | 'atmospheric' | 'glass';

export interface SurfaceCardProps {
  variant?: SurfaceVariant;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  atmosphere?: keyof typeof Atmospheres.light;
  intensity?: number;
}

export function SurfaceCard({
  variant = 'default',
  children,
  style,
  onPress,
  atmosphere = 'neutralGlow',
  intensity = 100
}: SurfaceCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const themeAtmospheres = Atmospheres[colorScheme];

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: Motion.press.scale,
      useNativeDriver: true,
      friction: Motion.spring.damping,
      tension: Motion.spring.stiffness,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: Motion.spring.damping,
      tension: Motion.spring.stiffness,
    }).start();
  };

  const baseStyle: ViewStyle = {
    borderRadius: BorderRadii.xl,
    overflow: 'hidden',
  };

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: themeColors.background,
          borderColor: themeColors.borderMuted,
          borderWidth: 1,
        };
      case 'elevated':
        return {
          backgroundColor: themeColors.background,
          ...Shadows.floating,
        };
      case 'atmospheric':
        return {
          backgroundColor: themeColors.background,
          borderColor: themeColors.borderMuted,
          borderWidth: 1,
          ...Shadows.premium,
        };
      case 'glass':
        return {
          backgroundColor: Platform.OS === 'android' ? themeColors.backgroundElement : 'transparent',
        };
    }
  };

  const content = (
    <View style={[baseStyle, getVariantStyles(), style]}>
      {variant === 'glass' && Platform.OS !== 'android' ? (
        <GlassSurface
          intensity={BlurLevels.level2}
          tint={colorScheme}
          style={StyleSheet.absoluteFill}
        >
          <View />
        </GlassSurface>
      ) : null}

      {variant === 'atmospheric' ? (
        <LinearGradient
          colors={themeAtmospheres[atmosphere]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ width: '100%' }}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return content;
}
