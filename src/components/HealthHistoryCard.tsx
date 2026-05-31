import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendCalculation } from '../../lib/trends';
import { Sparkline } from './Sparkline';
import { SoftCard } from './ui/SoftCard';
import { Colors, Spacing, BorderRadii } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

interface HealthHistoryCardProps {
  trends: TrendCalculation[];
  hasEnoughData: boolean;
}

export function HealthHistoryCard({ trends, hasEnoughData }: HealthHistoryCardProps) {
  const [timeframe, setTimeframe] = useState<'7d' | '30d'>('7d');
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  // Map metric to Ionicons instead of emojis
  const METRIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    sleep: 'moon-outline',
    energy: 'flash-outline',
    stress: 'leaf-outline',
  };

  if (!hasEnoughData) {
    return (
      <SoftCard style={{ marginHorizontal: 24 }}>
        <Text style={[styles.header, { color: themeColors.textMuted }]}>Trends</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="trending-up-outline" size={28} color={themeColors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            Trends will populate here once you log check-ins. Keep logging to unlock interactive charts.
          </Text>
        </View>
      </SoftCard>
    );
  }

  // Soft muted premium colors
  const metricStyles = {
    sleep: {
      color: '#111111',
      bg: '#F7F7F7',
      gradient: ['rgba(17, 17, 17, 0.1)', 'rgba(17, 17, 17, 0)']
    },
    energy: {
      color: '#C29F5D', // Soft gold/amber
      bg: 'rgba(194, 159, 93, 0.1)',
      gradient: ['rgba(194, 159, 93, 0.15)', 'rgba(194, 159, 93, 0)']
    },
    stress: {
      color: '#22C55E',
      bg: '#F0FDF4',
      gradient: ['rgba(34, 197, 94, 0.1)', 'rgba(34, 197, 94, 0)']
    }
  };

  return (
    <SoftCard style={{ marginHorizontal: 24 }}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: themeColors.textMuted }]}>Trends</Text>
        <View style={[styles.toggleContainer, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
          <Pressable
            style={[styles.toggleBtn, timeframe === '7d' && { backgroundColor: themeColors.background }]}
            onPress={() => setTimeframe('7d')}
          >
            <Text style={[styles.toggleText, timeframe === '7d' && { color: themeColors.text }]}>7D</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, timeframe === '30d' && { backgroundColor: themeColors.background }]}
            onPress={() => setTimeframe('30d')}
          >
            <Text style={[styles.toggleText, timeframe === '30d' && { color: themeColors.text }]}>30D</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricsList}>
        {trends.map((t, idx) => {
          const styleConfig = metricStyles[t.metric as keyof typeof metricStyles] || metricStyles.sleep;
          const chartData = timeframe === '7d' ? t.history7d : t.history30d;
          const loggedValues = chartData.filter(v => v > 0);
          
          const average = loggedValues.length > 0 
            ? (loggedValues.reduce((a, b) => a + b, 0) / loggedValues.length).toFixed(1)
            : '—';

          const iconName = METRIC_ICONS[t.metric] || 'pulse-outline';

          return (
            <View key={t.metric} style={[styles.metricItem, { borderBottomColor: themeColors.borderMuted, borderBottomWidth: idx < trends.length - 1 ? 1 : 0 }]}>
              <View style={styles.metricHeader}>
                <View style={styles.metricLabelRow}>
                  <Ionicons name={iconName} size={15} color={styleConfig.color} />
                  <Text style={[styles.metricLabel, { color: themeColors.text }]}>{t.label}</Text>
                </View>
                <View style={styles.averageContainer}>
                  <Text style={[styles.averageLabel, { color: themeColors.textMuted }]}>Avg</Text>
                  <Text style={[styles.averageValue, { color: styleConfig.color }]}>{average}</Text>
                </View>
              </View>

              <Sparkline
                data={chartData}
                color={styleConfig.color}
                gradientColors={styleConfig.gradient}
                height={55}
              />
            </View>
          );
        })}
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadii.sm,
    padding: 2,
    borderWidth: 1,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
  },
  metricsList: {
    gap: 16,
  },
  metricItem: {
    paddingBottom: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  averageContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  averageLabel: {
    fontSize: 11,
  },
  averageValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
