import React, { ReactNode } from "react";
import { Pressable, View, Text, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Product } from "../../lib/types";
import { formatProductName, formatBrandName, formatCategory, formatGoalLabel, shouldDisplayField, getProductImageFallback } from "../../lib/productDisplay";
import { Colors, Spacing, BorderRadii, Shadows } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

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
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const imageUrl = image || getProductImageFallback(product.image_url);

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.card, 
        compact && styles.compactCard,
        {
          backgroundColor: themeColors.background,
          borderColor: themeColors.borderMuted,
        },
        pressed && { opacity: 0.85 }, 
        style
      ]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.imageContainer, compact && styles.compactImageContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <Ionicons name="flask-outline" size={compact ? 20 : 26} color={themeColors.textSecondary} />
        )}
      </View>
      
      <View style={styles.content}>
        <Text 
          style={[
            styles.name, 
            compact && styles.compactName, 
            { color: themeColors.text }
          ]} 
          numberOfLines={compact ? 1 : 2}
        >
          {formatProductName(product.name) || "Unknown Product"}
        </Text>
        
        {shouldDisplayField(formatBrandName(product.brands?.name || product.brand)) ? (
          <Text style={[styles.brand, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {formatBrandName(product.brands?.name || product.brand)}
          </Text>
        ) : shouldDisplayField(formatCategory(product.category)) ? (
          <Text style={[styles.brand, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {formatCategory(product.category)}
          </Text>
        ) : null}

        <View style={styles.badges}>
          {(product.source === "curated" || product.source === "elexir_curated") && (
            <View style={[styles.goalChip, { backgroundColor: themeColors.backgroundSelected, borderColor: themeColors.border, borderWidth: 1 }]}>
              <Text style={[styles.goalText, { color: themeColors.text, fontWeight: '700' }]}>
                {product.verified_status === "verified" ? "✓ Verified" : "Curated"}
              </Text>
            </View>
          )}

          {typeof product.data_quality_score === "number" && product.data_quality_score > 0 && (
            <View style={[styles.goalChip, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Text style={[styles.goalText, { color: themeColors.textSecondary }]}>
                CQI {product.data_quality_score}
              </Text>
            </View>
          )}

          {match && match.score > 0 && (
            <View 
              style={[
                styles.matchBadge, 
                match.score === 3 && { backgroundColor: colorScheme === 'dark' ? '#142E1B' : '#F0F9F0' },
                match.score === 2 && { backgroundColor: colorScheme === 'dark' ? '#1B2E3E' : '#F0F4F9' },
                match.score === 1 && { backgroundColor: themeColors.backgroundElement }
              ]}
            >
              <Text style={[styles.matchBadgeText, { color: themeColors.text }]}>
                {match.label}
              </Text>
            </View>
          )}

          {goals && goals.length > 0 && (
            <View style={styles.goalsContainer}>
              {goals.slice(0, 3).map((g) => {
                const label = formatGoalLabel(g);
                if (!label) return null;
                return (
                  <View key={g} style={[styles.goalChip, { backgroundColor: themeColors.backgroundSecondary }]}>
                    <Text style={[styles.goalText, { color: themeColors.textSecondary }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          {reason && (
            <View style={[styles.reasonChip, { backgroundColor: themeColors.backgroundSelected }]}>
              <Text style={[styles.reasonText, { color: themeColors.textSecondary }]}>{reason}</Text>
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
    borderRadius: BorderRadii.xl,
    padding: 16,
    borderWidth: 1,
    ...Shadows.low,
    marginBottom: 12,
  },
  compactCard: {
    padding: 12,
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadii.md,
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
    borderRadius: BorderRadii.md,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  compactName: {
    marginBottom: 2,
  },
  brand: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.0,
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
    borderRadius: BorderRadii.sm,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  goalsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  goalChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
  },
  goalText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  rightAccessory: {
    justifyContent: "center",
    marginLeft: 12,
    alignItems: "flex-end",
  },
  reasonChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
    marginTop: 2,
    width: "100%",
  },
  reasonText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
