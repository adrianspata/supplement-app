import React from "react";
import { Pressable, View, Text, Image, StyleSheet } from "react-native";
import { Product } from "../../lib/types";
import { calculateElexirScore } from "../../lib/scoring";
import { formatProductName, formatBrandName, getProductImageFallback, formatIngredientName, formatQualityAttribute } from "../../lib/productDisplay";
import { Colors, Spacing, BorderRadii, Shadows } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

export interface ProductCompareRowProps {
  product: Product;
  match?: { score: number; label: string };
  onPress: () => void;
}

export function ProductCompareRow({ product, match, onPress }: ProductCompareRowProps) {
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  const imageUrl = getProductImageFallback(product.image_url);
  const elexir = calculateElexirScore(product);

  const ingredients = product.product_ingredients
    ?.map(i => formatIngredientName(i.ingredient?.name))
    .filter(Boolean)
    .slice(0, 3) || [];

  const attributes = product.product_quality_attributes
    ?.map(a => formatQualityAttribute(a.attribute))
    .filter(Boolean)
    .slice(0, 3) || [];

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.card, 
        { 
          backgroundColor: themeColors.background,
          borderColor: themeColors.borderMuted,
        },
        pressed && { opacity: 0.85 }
      ]} 
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={[styles.imageContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <Ionicons name="flask-outline" size={24} color={themeColors.textMuted} />
          )}
        </View>
        <View style={styles.headerContent}>
          <Text style={[styles.brand, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {formatBrandName(product.brands?.name || product.brand) || "Basis Curated"}
          </Text>
          <Text style={[styles.name, { color: themeColors.text }]} numberOfLines={2}>
            {formatProductName(product.name)}
          </Text>
          
          <View style={styles.badges}>
            <View style={[styles.scoreBadge, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Text style={[styles.scoreValue, { color: themeColors.text }]}>{elexir.score}</Text>
            </View>
            
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
          </View>
        </View>
      </View>

      {(ingredients.length > 0 || attributes.length > 0) && (
        <View style={[styles.details, { borderTopColor: themeColors.borderMuted }]}>
          {ingredients.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>Key Ingredients:</Text>
              <Text style={[styles.detailText, { color: themeColors.textSecondary }]} numberOfLines={1}>{ingredients.join(", ")}</Text>
            </View>
          )}
          
          {attributes.length > 0 && (
            <View style={[styles.detailRow, { marginTop: ingredients.length > 0 ? 6 : 0 }]}>
              <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>Quality:</Text>
              <Text style={[styles.detailText, { color: themeColors.textSecondary }]} numberOfLines={1}>{attributes.join(", ")}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadii.xl,
    padding: 16,
    borderWidth: 1,
    ...Shadows.low,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadii.md,
  },
  headerContent: {
    flex: 1,
    justifyContent: "center",
  },
  brand: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: "800",
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
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    width: 110,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
});
