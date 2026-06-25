import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadii } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';

interface ScorePillarRowProps {
  label: string;
  score: number;
  maxScore?: number;
}

export function ScorePillarRow({ label, score, maxScore = 20 }: ScorePillarRowProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const fillPercentage = Math.max(0, Math.min(100, (score / maxScore) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{label}</Text>
        <Text style={[styles.score, { color: themeColors.text }]}>{score} <Text style={{ color: themeColors.textMuted }}>/ {maxScore}</Text></Text>
      </View>
      <View style={[styles.barBackground, { backgroundColor: themeColors.backgroundSecondary }]}>
        <View style={[styles.barFill, { width: `${fillPercentage}%`, backgroundColor: themeColors.text }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
  },
  barBackground: {
    height: 6,
    borderRadius: BorderRadii.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadii.sm,
  },
});
