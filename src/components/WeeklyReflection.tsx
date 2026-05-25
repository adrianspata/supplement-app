import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { StackInsightsResult } from "../../lib/insights";
import { formatGoalLabel } from "../../lib/productDisplay";

interface WeeklyReflectionProps {
  insights: StackInsightsResult | null;
}

export function WeeklyReflection({ insights }: WeeklyReflectionProps) {
  if (!insights) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week</Text>
      
      <View style={styles.content}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Logged activity</Text>
          <Text style={styles.statValue}>{insights.weeklyActivity} of 7 days</Text>
        </View>
        
        {insights.mostSupported.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>Most supported</Text>
            <View style={styles.chipRow}>
              {insights.mostSupported.slice(0, 3).map((g, idx) => (
                <View key={idx} style={styles.chipSupported}>
                  <Text style={styles.chipSupportedText}>✓ {formatGoalLabel(g)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {insights.lessSupported.length > 0 && (
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>Less supported</Text>
            <View style={styles.chipRow}>
              {insights.lessSupported.slice(0, 3).map((g, idx) => (
                <View key={idx} style={styles.chipLacking}>
                  <Text style={styles.chipLackingText}>• {formatGoalLabel(g)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  content: {
    gap: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  statLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3F3F46",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  listSection: {},
  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipSupported: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipSupportedText: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
  },
  chipLacking: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E4E4E7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipLackingText: {
    color: "#71717A",
    fontSize: 13,
    fontWeight: "600",
  },
});
