import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatGoalLabel } from '../../lib/productDisplay';

interface GoalProgressCardProps {
  goals?: string[] | null;
  goalStatus?: Record<string, 'improving' | 'stable' | 'needs_attention'>;
}

const GOAL_ICONS: Record<string, string> = {
  sleep: '🌙',
  energy: '⚡️',
  stress: '🧘',
  focus: '🧠',
  recovery: '🔋',
  gut_health: '🦠',
  immunity: '🛡️',
  bone_health: '🦴',
  heart_health: '❤️',
  brain_health: '🧠',
  hair: '✨',
  skin: '✨',
  hormones: '⚖️',
  joints: '🦴'
};

export function GoalProgressCard({ goals, goalStatus = {} }: GoalProgressCardProps) {
  const displayGoals = goals && goals.length > 0 ? goals : ['sleep', 'energy', 'stress'];

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Health Progress</Text>
      <View style={styles.goalsContainer}>
        {displayGoals.map((goal, i) => {
          const label = formatGoalLabel(goal) || goal;
          const icon = GOAL_ICONS[goal.toLowerCase()] || '✨';
          const status = goalStatus[goal] || 'stable';
          
          let statusText = 'Stable';
          let statusColor = '#FF9500';
          let trend = '→';

          if (status === 'improving') {
            statusText = 'Improving';
            statusColor = '#34C759';
            trend = '↗';
          } else if (status === 'needs_attention') {
            statusText = 'Needs attention';
            statusColor = '#FF3B30';
            trend = '↘';
          }

          return (
            <View key={i} style={[styles.goalRow, i === displayGoals.length - 1 && styles.lastRow]}>
              <View style={styles.goalInfo}>
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>{icon}</Text>
                </View>
                <Text style={styles.goalLabel}>{label}</Text>
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                <Text style={[styles.trend, { color: statusColor }]}>{trend}</Text>
              </View>
            </View>
          );
        })}
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
  header: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    borderBottomColor: 'rgba(0,0,0,0.04)',
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
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 16,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
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
