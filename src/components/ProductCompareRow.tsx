import React from "react";
import { Pressable, View, Text, Image, StyleSheet } from "react-native";
import { Product } from "../../lib/types";
import { calculateElexirScore } from "../../lib/scoring";
import { formatProductName, formatBrandName, getProductImageFallback, formatIngredientName, formatQualityAttribute } from "../../lib/productDisplay";

export interface ProductCompareRowProps {
  product: Product;
  match?: { score: number; label: string };
  onPress: () => void;
}

export function ProductCompareRow({ product, match, onPress }: ProductCompareRowProps) {
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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} 
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <Text style={{ fontSize: 28 }}>🧴</Text>
          )}
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.brand} numberOfLines={1}>
            {formatBrandName(product.brands?.name || product.brand) || "Elexir Curated"}
          </Text>
          <Text style={styles.name} numberOfLines={2}>
            {formatProductName(product.name)}
          </Text>
          
          <View style={styles.badges}>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>{elexir.score}</Text>
            </View>
            
            {match && match.score > 0 && (
              <View style={[styles.matchBadge, styles[`match_${match.score}` as keyof typeof styles]]}>
                <Text style={styles.matchBadgeText}>
                  {match.score >= 3 ? "✨ " : ""}{match.label}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {(ingredients.length > 0 || attributes.length > 0) && (
        <View style={styles.details}>
          {ingredients.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Key Ingredients:</Text>
              <Text style={styles.detailText}>{ingredients.join(", ")}</Text>
            </View>
          )}
          
          {attributes.length > 0 && (
            <View style={[styles.detailRow, { marginTop: ingredients.length > 0 ? 8 : 0 }]}>
              <Text style={styles.detailLabel}>Quality:</Text>
              <Text style={styles.detailText}>{attributes.join(", ")}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: "row",
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
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  headerContent: {
    flex: 1,
    justifyContent: "center",
  },
  brand: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreBadge: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreValue: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
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
  details: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    width: 110,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    color: "#3F3F46",
    fontWeight: "500",
  },
});
