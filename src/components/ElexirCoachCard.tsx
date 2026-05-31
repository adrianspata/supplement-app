import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { CoachInsight } from "../../lib/coach";
import { Colors, Spacing, BorderRadii } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

interface ElexirCoachCardProps {
  insights: CoachInsight[];
}

export function ElexirCoachCard({ insights }: ElexirCoachCardProps) {
  const [currentInsight, setCurrentInsight] = useState<CoachInsight | null>(null);
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  useEffect(() => {
    if (insights.length > 0) {
      const randomIndex = Math.floor(Math.random() * insights.length);
      setCurrentInsight(insights[randomIndex]);
    } else {
      setCurrentInsight(null);
    }
  }, [insights]);

  if (!currentInsight) return null;

  const handleNextInsight = () => {
    if (insights.length <= 1) return;
    
    let nextIndex = Math.floor(Math.random() * insights.length);
    while (insights[nextIndex].id === currentInsight.id) {
      nextIndex = Math.floor(Math.random() * insights.length);
    }
    setCurrentInsight(insights[nextIndex]);
  };

  return (
    <Pressable 
      style={[
        styles.card, 
        { 
          backgroundColor: themeColors.backgroundSelected,
          borderColor: themeColors.border
        }
      ]} 
      onPress={handleNextInsight}
    >
      <View style={styles.header}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={14} color={themeColors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.coachLabel, { color: themeColors.text }]}>Elexir AI Coach</Text>
        </View>
        <Ionicons name="refresh-outline" size={14} color={themeColors.textSecondary} />
      </View>
      <Text style={[styles.title, { color: themeColors.text }]}>{currentInsight.title}</Text>
      <Text style={[styles.message, { color: themeColors.textSecondary }]}>{currentInsight.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadii.xl,
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  coachLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
});
