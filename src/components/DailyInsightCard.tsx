import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { StackInsightsResult } from "../../lib/insights";
import { SoftCard } from "./ui/SoftCard";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

interface DailyInsightCardProps {
  insights: StackInsightsResult | null;
  onPressWeekly?: () => void;
}

export function DailyInsightCard({ insights, onPressWeekly }: DailyInsightCardProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  if (!insights) return null;

  return (
    <SoftCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={themeColors.text} />
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>AI Overview</Text>
      </View>

      <View style={styles.content}>
        {/* Health Summary */}
        <Text style={[styles.healthSummary, { color: themeColors.text }]}>{insights.healthSummary}</Text>

        {/* What's Going Well */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Diagnostic Strengths</Text>
          {insights.goingWell.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="checkmark-circle-outline" size={14} color={themeColors.success} style={styles.bullet} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Focus Area */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Actionable Risks</Text>
          {insights.focusArea.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="alert-circle-outline" size={14} color={themeColors.warning} style={styles.bullet} />
              <Text style={[styles.listText, { color: themeColors.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Recommended Action */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Suggested Intervention</Text>
          {insights.recommendedAction && (
            <View style={[styles.actionBadge, { backgroundColor: themeColors.backgroundSelected }]}>
              <Text style={[styles.actionText, { color: themeColors.text }]}>{insights.recommendedAction}</Text>
            </View>
          )}
        </View>
      </View>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
    padding: 0,
    overflow: "hidden",
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  content: {
    padding: 24,
  },
  healthSummary: {
    fontSize: 19,
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: 24,
    letterSpacing: -0.4,
  },
  section: {
    marginBottom: 20,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.0,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.1,
  },
});
