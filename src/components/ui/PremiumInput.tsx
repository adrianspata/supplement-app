import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadii } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

interface PremiumInputProps extends TextInputProps {
  containerStyle?: StyleProp<ViewStyle>;
  iconName?: keyof typeof Ionicons.glyphMap;
}

export function PremiumInput({
  containerStyle,
  iconName,
  style,
  ...props
}: PremiumInputProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: themeColors.backgroundSecondary, 
          borderColor: themeColors.border,
        }, 
        containerStyle
      ]}
    >
      {iconName && (
        <Ionicons 
          name={iconName} 
          size={18} 
          color={themeColors.textSecondary} 
          style={styles.icon} 
        />
      )}
      <TextInput
        style={[
          styles.input, 
          { 
            color: themeColors.text,
          }, 
          style
        ]}
        placeholderTextColor={themeColors.textMuted}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadii.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
});
