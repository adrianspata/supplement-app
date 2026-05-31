import React from 'react';
import { View, StyleSheet, ScrollView, ViewProps } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

interface PageContainerProps extends SafeAreaViewProps {
  children?: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: ViewProps['style'];
  refreshControl?: React.ReactElement<any>;
}

export function PageContainer({
  children,
  scrollable = false,
  contentContainerStyle,
  style,
  edges = ['top', 'left', 'right'],
  refreshControl,
  ...props
}: PageContainerProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const containerStyle = [
    styles.container,
    { backgroundColor: themeColors.background },
    style,
  ];

  if (scrollable) {
    return (
      <SafeAreaView style={containerStyle} edges={edges} {...props}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle} edges={edges} {...props}>
      <View style={[styles.flex, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  flex: {
    flex: 1,
  },
});
