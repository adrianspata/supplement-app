import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { StackInsightsResult } from "../../lib/insights";

interface DailyInsightCardProps {
  insights: StackInsightsResult | null;
  onPressWeekly?: () => void;
}

export function DailyInsightCard({ insights, onPressWeekly }: DailyInsightCardProps) {
  if (!insights) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily Insight</Text>
      </View>

      <View style={styles.content}>
        {/* Coverage Score */}
        <View style={styles.scoreSection}>
          <Text style={styles.scoreLabel}>Coverage Score</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{insights.coverageScore}</Text>
            <Text style={styles.scoreMax}> / 100</Text>
          </View>
        </View>

        {/* Today's Stack */}
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Today's Stack</Text>
          <Text style={styles.rowText}>{insights.todayStatus}</Text>
        </View>

        {/* What Changed */}
        <View style={styles.row}>
          <Text style={styles.rowTitle}>What Changed?</Text>
          {insights.whatChanged.map((change, idx) => (
            <Text key={idx} style={styles.rowTextNeutral}>• {change}</Text>
          ))}
        </View>

        {/* Opportunity */}
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Opportunity</Text>
          {insights.opportunity.map((opp, idx) => (
            <Text key={idx} style={styles.rowTextNeutral}>• {opp}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: "#FDFDFD",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#FDF4E6",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706", // warm amber
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  content: {
    padding: 20,
  },
  scoreSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  scoreMax: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A1A1AA",
  },
  row: {
    marginBottom: 16,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rowText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    lineHeight: 22,
  },
  rowTextNeutral: {
    fontSize: 15,
    color: "#3F3F46",
    lineHeight: 22,
    marginBottom: 4,
  },
});
