import React, { ReactNode } from "react";
import { Pressable, View, Text, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Product } from "../../lib/types";
import { formatProductName, formatBrandName, formatCategory, formatGoalLabel, shouldDisplayField, getProductImageFallback } from "../../lib/productDisplay";

export interface ProductRowProps {
  product: Product;
  match?: { score: number; label: string };
  goals?: string[]; // List of goal strings to display as chips
  reason?: string; // Engine explanation chip
  image?: string; // Optional image URL override
  rightAccessory?: ReactNode;
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProductRow({
  product,
  match,
  goals,
  reason,
  image,
  rightAccessory,
  onPress,
  compact,
  style
}: ProductRowProps) {
  const imageUrl = image || getProductImageFallback(product.image_url);

  return (
    <Pressable 
      style={({ pressed }) => [styles.card, compact && styles.compactCard, pressed && { opacity: 0.85 }, style]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.imageContainer, compact && styles.compactImageContainer]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: compact ? 20 : 28 }}>🧴</Text>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.name, compact && styles.compactName]} numberOfLines={compact ? 1 : 2}>
          {formatProductName(product.name) || "Unknown Product"}
        </Text>
        
        {shouldDisplayField(formatBrandName(product.brands?.name || product.brand)) ? (
          <Text style={styles.brand} numberOfLines={1}>{formatBrandName(product.brands?.name || product.brand)}</Text>
        ) : shouldDisplayField(formatCategory(product.category)) ? (
          <Text style={styles.brand} numberOfLines={1}>{formatCategory(product.category)}</Text>
        ) : null}

        <View style={styles.badges}>
          {match && match.score > 0 && (
            <View style={[styles.matchBadge, styles[`match_${match.score}` as keyof typeof styles]]}>
              <Text style={styles.matchBadgeText}>
                {match.score >= 3 ? "✨ " : ""}{match.label}
              </Text>
            </View>
          )}

          {goals && goals.length > 0 && (
            <View style={styles.goalsContainer}>
              {goals.slice(0, 3).map((g) => {
                const label = formatGoalLabel(g);
                if (!label) return null;
                return (
                  <View key={g} style={styles.goalChip}>
                    <Text style={styles.goalText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          {reason && (
            <View style={styles.reasonChip}>
              <Text style={styles.reasonText}>✨ {reason}</Text>
            </View>
          )}
        </View>
      </View>

      {rightAccessory && (
        <View style={styles.rightAccessory}>
          {rightAccessory}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  compactCard: {
    padding: 12,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  compactImageContainer: {
    width: 56,
    height: 56,
    marginRight: 12,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  compactName: {
    marginBottom: 2,
  },
  brand: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  matchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  match_3: { backgroundColor: "#E8F5E9" },
  match_2: { backgroundColor: "#E3F2FD" },
  match_1: { backgroundColor: "#F2F2F7" },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  goalsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  goalChip: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  goalText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#636366",
    textTransform: "capitalize",
  },
  rightAccessory: {
    justifyContent: "center",
    marginLeft: 12,
    alignItems: "flex-end",
  },
  reasonChip: {
    backgroundColor: "#FDF4E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 2,
    width: "100%",
  },
  reasonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
  },
});
