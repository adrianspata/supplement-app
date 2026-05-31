import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { getTodayCheckIn, upsertTodayCheckIn } from '../../lib/checkins';
import { DailyCheckIn } from '../../lib/types';
import { SoftCard } from './ui/SoftCard';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

interface TodayCheckInCardProps {
  userId: string;
}

export function TodayCheckInCard({ userId }: TodayCheckInCardProps) {
  const [checkIn, setCheckIn] = useState<DailyCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  useEffect(() => {
    async function loadCheckIn() {
      if (!userId) return;
      const data = await getTodayCheckIn(userId);
      setCheckIn(data);
      setLoading(false);
    }
    loadCheckIn();
  }, [userId]);

  const handleScoreChange = async (metric: 'sleep_score' | 'energy_score' | 'stress_score', value: number) => {
    if (!userId) return;
    setSaving(true);
    
    // Optimistic update
    const newCheckIn = { ...checkIn, [metric]: value } as DailyCheckIn;
    setCheckIn(newCheckIn);

    const scores = {
      sleep_score: newCheckIn.sleep_score ?? 3,
      energy_score: newCheckIn.energy_score ?? 3,
      stress_score: newCheckIn.stress_score ?? 3,
    };

    const { data } = await upsertTodayCheckIn(userId, scores);
    if (data) {
      setCheckIn(data);
    }
    setSaving(false);
  };

  const renderMetric = (label: string, metric: 'sleep_score' | 'energy_score' | 'stress_score', iconName: keyof typeof Ionicons.glyphMap) => {
    const currentScore = checkIn?.[metric] || 0;
    
    return (
      <View style={styles.metricRow}>
        <View style={styles.metricLabelContainer}>
          <Ionicons name={iconName} size={16} color={themeColors.textSecondary} />
          <Text style={[styles.metricLabel, { color: themeColors.text }]}>{label}</Text>
        </View>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((val) => (
            <Pressable
              key={val}
              style={[
                styles.ratingBubble,
                { 
                  backgroundColor: themeColors.backgroundSecondary,
                  borderColor: themeColors.border,
                  borderWidth: 1 
                },
                currentScore === val && { 
                  backgroundColor: themeColors.text,
                  borderColor: themeColors.text
                }
              ]}
              onPress={() => handleScoreChange(metric, val)}
              disabled={saving}
            >
              <Text style={[
                styles.ratingText,
                { color: themeColors.textSecondary },
                currentScore === val && { color: themeColors.background }
              ]}>
                {val}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SoftCard style={[styles.card, styles.center]}>
        <ActivityIndicator color={themeColors.text} />
      </SoftCard>
    );
  }

  return (
    <SoftCard style={styles.card}>
      <Text style={[styles.header, { color: themeColors.textMuted }]}>How are you feeling today?</Text>
      <View style={styles.metricsContainer}>
        {renderMetric('Sleep', 'sleep_score', 'moon-outline')}
        {renderMetric('Energy', 'energy_score', 'flash-outline')}
        {renderMetric('Stress', 'stress_score', 'leaf-outline')}
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  header: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  metricsContainer: {
    gap: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
