import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { getTodayCheckIn, upsertTodayCheckIn } from '../../lib/checkins';
import { DailyCheckIn } from '../../lib/types';

interface TodayCheckInCardProps {
  userId: string;
}

export function TodayCheckInCard({ userId }: TodayCheckInCardProps) {
  const [checkIn, setCheckIn] = useState<DailyCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const renderMetric = (label: string, metric: 'sleep_score' | 'energy_score' | 'stress_score', emoji: string) => {
    const currentScore = checkIn?.[metric] || 0;
    
    return (
      <View style={styles.metricRow}>
        <View style={styles.metricLabelContainer}>
          <Text style={styles.metricEmoji}>{emoji}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((val) => (
            <Pressable
              key={val}
              style={[
                styles.ratingBubble,
                currentScore === val && styles.ratingBubbleActive
              ]}
              onPress={() => handleScoreChange(metric, val)}
              disabled={saving}
            >
              <Text style={[
                styles.ratingText,
                currentScore === val && styles.ratingTextActive
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
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color="#1C1C1E" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.header}>How are you feeling today?</Text>
      <View style={styles.metricsContainer}>
        {renderMetric('Sleep', 'sleep_score', '🌙')}
        {renderMetric('Energy', 'energy_score', '⚡️')}
        {renderMetric('Stress', 'stress_score', '🧘')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 24,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  header: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  metricEmoji: {
    fontSize: 16,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBubbleActive: {
    backgroundColor: '#1C1C1E',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  ratingTextActive: {
    color: '#FFF',
  },
});
