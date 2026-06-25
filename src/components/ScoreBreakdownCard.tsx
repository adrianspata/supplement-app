import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadii, Shadows } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import { ScorePillarRow } from './ScorePillarRow';
import { ElexirScoreResult } from '../../lib/scoring';

interface ScoreBreakdownCardProps {
  scoreResult: ElexirScoreResult;
}

export function ScoreBreakdownCard({ scoreResult }: ScoreBreakdownCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  return (
    <View style={[styles.card, { backgroundColor: themeColors.background, borderColor: themeColors.borderMuted }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.textSecondary }]}>DIAGNOSTIC SIGNAL</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>Clinical quality index</Text>
        </View>
        <Text style={[styles.mainScore, { color: themeColors.text }]}>{scoreResult.score}</Text>
      </View>

      <View style={styles.breakdown}>
        <ScorePillarRow label="Ingredient Quality" score={scoreResult.breakdown.ingredientQuality} />
        <ScorePillarRow label="Dosage Quality" score={scoreResult.breakdown.dosageQuality} />
        <ScorePillarRow label="Transparency" score={scoreResult.breakdown.transparency} />
        <ScorePillarRow label="Evidence" score={scoreResult.breakdown.evidence} />
        <ScorePillarRow label="Cleanliness" score={scoreResult.breakdown.cleanliness} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadii.xl,
    padding: 24,
    borderWidth: 1,
    ...Shadows.low,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  mainScore: {
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -2,
    lineHeight: 50,
  },
  breakdown: {
    gap: 4,
  },
});
