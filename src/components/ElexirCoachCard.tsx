import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { CoachInsight } from "../../lib/coach";

interface ElexirCoachCardProps {
  insights: CoachInsight[];
}

export function ElexirCoachCard({ insights }: ElexirCoachCardProps) {
  const [currentInsight, setCurrentInsight] = useState<CoachInsight | null>(null);

  useEffect(() => {
    if (insights.length > 0) {
      // Pick a random insight on mount or when insights change
      const randomIndex = Math.floor(Math.random() * insights.length);
      setCurrentInsight(insights[randomIndex]);
    } else {
      setCurrentInsight(null);
    }
  }, [insights]);

  if (!currentInsight) return null;

  const handleNextInsight = () => {
    if (insights.length <= 1) return;
    
    // Pick next insight that is different from current
    let nextIndex = Math.floor(Math.random() * insights.length);
    while (insights[nextIndex].id === currentInsight.id) {
      nextIndex = Math.floor(Math.random() * insights.length);
    }
    setCurrentInsight(insights[nextIndex]);
  };

  return (
    <Pressable style={styles.card} onPress={handleNextInsight}>
      <View style={styles.header}>
        <Text style={styles.coachLabel}>Elexir Coach</Text>
        <Text style={styles.rotateIcon}>↻</Text>
      </View>
      <Text style={styles.title}>{currentInsight.title}</Text>
      <Text style={styles.message}>{currentInsight.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F2F2F7", // Slightly distinct from pure white to stand out
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  coachLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#636366",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rotateIcon: {
    fontSize: 16,
    color: "#8E8E93",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3F3F46",
  },
});
