import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatGoalLabel } from '../../lib/productDisplay';
import { SoftCard } from './ui/SoftCard';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

interface GoalProgressCardProps {
  goals?: string[] | null;
  goalStatus?: Record<string, 'improving' | 'stable' | 'needs_attention'>;
}

const GOAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sleep: 'moon-outline',
  energy: 'flash-outline',
  stress: 'leaf-outline',
  focus: 'eye-outline',
  recovery: 'battery-charging-outline',
  gut_health: 'medkit-outline',
  immunity: 'shield-outline',
  bone_health: 'body-outline',
  heart_health: 'heart-outline',
  brain_health: 'bulb-outline',
  hair: 'sparkles-outline',
  skin: 'sparkles-outline',
  hormones: 'scale-outline',
  joints: 'body-outline'
};

export function GoalProgressCard({ goals, goalStatus = {} }: GoalProgressCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const displayGoals = goals && goals.length > 0 ? goals : ['sleep', 'energy', 'stress'];

  return (
    <SoftCard style={styles.card}>
      <Text style={[styles.header, { color: themeColors.textMuted }]}>Health Progress</Text>
      <View style={styles.goalsContainer}>
        {displayGoals.map((goal, i) => {
          const label = formatGoalLabel(goal) || goal;
          const iconName = GOAL_ICONS[goal.toLowerCase()] || 'sparkles-outline';
          const status = goalStatus[goal] || 'stable';
          
          let statusText = 'Stable';
          let statusColor: string = themeColors.warning;
          let trendIcon: keyof typeof Ionicons.glyphMap = 'arrow-forward-outline';

          if (status === 'improving') {
            statusText = 'Improving';
            statusColor = themeColors.success;
            trendIcon = 'trending-up-outline';
          } else if (status === 'needs_attention') {
            statusText = 'Needs attention';
            statusColor = themeColors.error;
            trendIcon = 'trending-down-outline';
          }

          return (
            <View key={i} style={[styles.goalRow, i === displayGoals.length - 1 && styles.lastRow, { borderBottomColor: themeColors.borderMuted }]}>
              <View style={styles.goalInfo}>
                <View style={[styles.iconContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <Ionicons name={iconName} size={16} color={themeColors.textSecondary} />
                </View>
                <Text style={[styles.goalLabel, { color: themeColors.text }]}>{label}</Text>
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                <Ionicons name={trendIcon} size={16} color={statusColor} />
              </View>
            </View>
          );
        })}
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
  },
  header: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  goalsContainer: {
    gap: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trend: {
    fontSize: 14,
    fontWeight: '700',
  },
});
