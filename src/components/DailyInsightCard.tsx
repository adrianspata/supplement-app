import React from "react";
import { View, Text, StyleSheet } from "react-native";
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
        {/* Health Summary */}
        <Text style={styles.healthSummary}>{insights.healthSummary}</Text>

        {/* What's Going Well */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Going Well</Text>
          {insights.goingWell.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Focus Area */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Area</Text>
          {insights.focusArea.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Recommended Action */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Recommended Action</Text>
          <View style={styles.actionBadge}>
            <Text style={styles.actionText}>{insights.recommendedAction}</Text>
          </View>
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
  healthSummary: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1C1C1E",
    lineHeight: 28,
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  section: {
    marginBottom: 20,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 15,
    color: "#3F3F46",
    marginRight: 8,
    marginTop: 1,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: "#3F3F46",
    lineHeight: 22,
  },
  actionBadge: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
});
