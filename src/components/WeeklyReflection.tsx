import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { WeeklyReflectionData } from "../../lib/trends";
import { SoftCard } from "./ui/SoftCard";
import { Colors, Spacing, BorderRadii } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

interface WeeklyReflectionProps {
  reflection: WeeklyReflectionData | null;
}

export function WeeklyReflection({ reflection }: WeeklyReflectionProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  if (!reflection) return null;

  const {
    streakText,
    trends,
    correlationText,
    areaNeedingFocus,
    bestSupportedGoal,
    recommendedAction,
    hasEnoughData,
    stackDaysCompleted
  } = reflection;

  const METRIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    sleep: 'moon-outline',
    energy: 'flash-outline',
    stress: 'leaf-outline',
  };

  if (!hasEnoughData) {
    return (
      <SoftCard style={{ marginHorizontal: 24 }}>
        <Text style={[styles.header, { color: themeColors.textMuted }]}>Weekly Reflection</Text>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Personalized insights are unlocking</Text>
        <Text style={[styles.emptyBody, { color: themeColors.textSecondary }]}>
          Log at least 3 days of check-ins to view your trends, stack consistency, and goal correlations.
        </Text>
        <View style={[styles.confidenceBadge, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Text style={[styles.confidenceText, { color: themeColors.textSecondary }]}>✦ {streakText}</Text>
        </View>
      </SoftCard>
    );
  }

  // Helper for trend labels & styling
  const getTrendStyle = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return { text: 'Improving', color: themeColors.success, bg: colorScheme === 'dark' ? '#142E1B' : '#F0F9F0', iconName: 'trending-up-outline' as keyof typeof Ionicons.glyphMap };
      case 'declining':
        return { text: 'Needs attention', color: themeColors.error, bg: colorScheme === 'dark' ? '#2E1010' : '#FFF0F0', iconName: 'trending-down-outline' as keyof typeof Ionicons.glyphMap };
      case 'stable':
      default:
        return { text: 'Stable', color: themeColors.textSecondary, bg: themeColors.backgroundSecondary, iconName: 'arrow-forward-outline' as keyof typeof Ionicons.glyphMap };
    }
  };

  return (
    <SoftCard style={{ marginHorizontal: 24 }}>
      <Text style={[styles.header, { color: themeColors.textMuted }]}>Weekly Reflection</Text>

      {/* Top summary sentence */}
      <View style={styles.insightSection}>
        <Text style={[styles.insightQuote, { color: themeColors.text }]}>
          {correlationText && correlationText !== "Not enough data yet."
            ? correlationText
            : bestSupportedGoal
            ? `Your ${bestSupportedGoal.toLowerCase()} scores tended to lead your metrics this week.`
            : "Your baseline scores are establishing. Keep logging daily."}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: themeColors.borderMuted }]} />

      {/* Metrics list */}
      <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Weekly adherence metrics</Text>
      <View style={styles.trendsList}>
        {trends.map((t) => {
          const trendConfig = getTrendStyle(t.trend);
          const scoreDisplay = t.currentAverage !== null ? t.currentAverage.toFixed(1) : '—';
          const iconName = METRIC_ICONS[t.metric] || 'pulse-outline';
          
          return (
            <View key={t.metric} style={styles.trendRow}>
              <View style={styles.trendLabelContainer}>
                <Ionicons name={iconName} size={15} color={themeColors.textSecondary} />
                <Text style={[styles.trendLabel, { color: themeColors.text }]}>{t.label}</Text>
              </View>
              <View style={styles.trendRight}>
                <Text style={[styles.trendScore, { color: themeColors.text }]}>{scoreDisplay}</Text>
                <View style={[styles.trendBadge, { backgroundColor: trendConfig.bg }]}>
                  <Ionicons name={trendConfig.iconName} size={12} color={trendConfig.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.trendBadgeText, { color: trendConfig.color }]}>
                    {trendConfig.text}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Stack consistency row */}
        <View style={styles.trendRow}>
          <View style={styles.trendLabelContainer}>
            <Ionicons name="medkit-outline" size={15} color={themeColors.textSecondary} />
            <Text style={[styles.trendLabel, { color: themeColors.text }]}>Stack Consistency</Text>
          </View>
          <View style={styles.trendRight}>
            <Text style={[styles.trendScore, { color: themeColors.text }]}>{stackDaysCompleted} / 7</Text>
            <Text style={[styles.daysText, { color: themeColors.textMuted }]}>days</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: themeColors.borderMuted }]} />

      {/* Quick summary highlights */}
      <View style={styles.highlightsContainer}>
        {bestSupportedGoal && (
          <View style={[styles.highlightItem, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.borderMuted }]}>
            <Text style={[styles.highlightLabel, { color: themeColors.textMuted }]}>Supporting goal</Text>
            <Text style={[styles.highlightValue, { color: themeColors.text }]}>{bestSupportedGoal}</Text>
          </View>
        )}
        
        {areaNeedingFocus && (
          <View style={[styles.highlightItem, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.borderMuted }]}>
            <Text style={[styles.highlightLabel, { color: themeColors.textMuted }]}>Focus area</Text>
            <Text style={[styles.highlightValue, { color: themeColors.text }]}>{areaNeedingFocus}</Text>
          </View>
        )}
      </View>

      <View style={[styles.actionCard, { backgroundColor: themeColors.backgroundSelected, borderColor: themeColors.border }]}>
        <Text style={[styles.actionLabel, { color: themeColors.text }]}>Recommended Action</Text>
        <Text style={[styles.actionText, { color: themeColors.text }]}>{recommendedAction}</Text>
      </View>

      {/* Data confidence streak badge */}
      <View style={styles.confidenceFooter}>
        <Text style={[styles.confidenceFooterText, { color: themeColors.textMuted }]}>✦ {streakText}</Text>
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.0,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadii.sm,
    alignSelf: "flex-start",
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  insightSection: {
    marginVertical: 4,
  },
  insightQuote: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  trendsList: {
    gap: 12,
  },
  trendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  trendRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trendScore: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "right",
  },
  daysText: {
    fontSize: 13,
  },
  trendBadge: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
    minWidth: 125,
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  highlightsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  highlightItem: {
    flex: 1,
    padding: 12,
    borderRadius: BorderRadii.md,
    borderWidth: 1,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  actionCard: {
    padding: 16,
    borderRadius: BorderRadii.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  confidenceFooter: {
    alignItems: "center",
  },
  confidenceFooterText: {
    fontSize: 12,
  },
});
