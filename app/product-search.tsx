import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { searchProducts, upsertExternalProduct, getRecentlyViewedProducts, getSavedProducts } from "../lib/products";
import { Product, UserSavedProduct, RecentlyViewedProduct } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { calculateElexirScore } from "../lib/scoring";
import { formatCategory, formatProductName, formatBrandName, formatIngredientName } from "../lib/productDisplay";
import { PageContainer } from "../src/components/ui/PageContainer";
import { Colors, BorderRadii, Shadows, Spacing, getContentContainerStyle } from "../src/constants/theme";
import { useColorScheme } from "../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const TOP_CATEGORIES = [
  { icon: "moon-outline" as keyof typeof Ionicons.glyphMap, name: "Magnesium" },
  { icon: "sunny-outline" as keyof typeof Ionicons.glyphMap, name: "Vitamin D" },
  { icon: "water-outline" as keyof typeof Ionicons.glyphMap, name: "Omega-3" },
  { icon: "fitness-outline" as keyof typeof Ionicons.glyphMap, name: "Creatine" },
  { icon: "barbell-outline" as keyof typeof Ionicons.glyphMap, name: "Protein" },
  { icon: "flask-outline" as keyof typeof Ionicons.glyphMap, name: "Probiotics" },
  { icon: "bed-outline" as keyof typeof Ionicons.glyphMap, name: "Sleep" },
  { icon: "pulse-outline" as keyof typeof Ionicons.glyphMap, name: "Stress" },
  { icon: "flash-outline" as keyof typeof Ionicons.glyphMap, name: "Energy" },
  { icon: "sparkles-outline" as keyof typeof Ionicons.glyphMap, name: "Skin" }
];

const RECENT_SEARCHES_KEY = "@recent_searches";

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  themeColors: any;
  isDark: boolean;
  cardBg: string;
  imageBg: string;
  borderCol: string;
}

const ProductCard = ({ product, onPress, themeColors, isDark, cardBg, imageBg, borderCol }: ProductCardProps) => {
  const elexir = calculateElexirScore(product);

  const hasIngredients = (product.product_ingredients && product.product_ingredients.length > 0) ||
                         (product.raw_data?.supplement_facts?.active_ingredients || product.supplement_facts?.active_ingredients) ||
                         (product.ingredients_text && product.ingredients_text.trim() !== "");

  const score = elexir.score;
  let badgeLabel = "";
  let badgeBg = "";
  let badgeText = "";

  if (!hasIngredients) {
    badgeLabel = "Not scored";
    badgeBg = isDark ? "rgba(255,255,255,0.06)" : "#F2F2F7";
    badgeText = themeColors.textSecondary;
  } else if (score >= 85) {
    badgeLabel = "Excellent";
    badgeBg = isDark ? "rgba(74, 222, 128, 0.12)" : "#E8FDF0";
    badgeText = isDark ? "#4ADE80" : "#15803D";
  } else if (score >= 60) {
    badgeLabel = "Good";
    badgeBg = isDark ? "rgba(96, 165, 250, 0.12)" : "#EFF6FF";
    badgeText = isDark ? "#60A5FA" : "#1D4ED8";
  } else {
    badgeLabel = "Needs review";
    badgeBg = isDark ? "rgba(245, 158, 11, 0.12)" : "#FFFBEB";
    badgeText = isDark ? "#F59E0B" : "#B45309";
  }

  const brand = formatBrandName(product.brands?.name || product.brand) || "Basis";
  const name = formatProductName(product.name);
  const category = formatCategory(product.category);
  const firstIngredient = product.product_ingredients && product.product_ingredients.length > 0
    ? formatIngredientName(product.product_ingredients[0].ingredient?.name)
    : null;

  const subLabel = category || firstIngredient;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        {
          backgroundColor: cardBg,
          borderColor: borderCol,
        },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
      ]}
      onPress={onPress}
    >
      <View style={[styles.productImageContainer, { backgroundColor: imageBg }]}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="contain" />
        ) : (
          <Ionicons name="flask-outline" size={28} color={themeColors.textMuted} />
        )}
      </View>

      <View style={styles.productInfoContainer}>
        <Text style={[styles.productBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {brand}
        </Text>
        
        <Text style={[styles.productNameText, { color: themeColors.text }]} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.productBadgeRow}>
          <View style={[styles.qualityBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.qualityBadgeText, { color: badgeText }]}>{badgeLabel}</Text>
          </View>

          {subLabel ? (
            <Text style={[styles.productCategoryLabel, { color: themeColors.textMuted }]} numberOfLines={1}>
              {subLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

export default function ProductSearchScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  const isDark = colorScheme === "dark";
  const screenBg = isDark ? themeColors.background : "#F6F6F9";
  const cardBg = isDark ? themeColors.backgroundSecondary : "#FFFFFF";
  const imageBg = isDark ? "rgba(255,255,255,0.02)" : "#F9F9F9";
  const borderCol = isDark ? themeColors.border : "#E5E5EA";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadRecentSearches();
    fetchRecommended();
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        fetchRecentlyViewed(data.user.id);
      }
    });
  }, []);

  const fetchRecommended = async () => {
    try {
      // Prefer curated stack products
      const { data: curated, error: curatedErr } = await supabase
        .from("products")
        .select(`
          *,
          brands(*),
          product_ingredients(*, ingredients(*)),
          product_goals(*),
          product_quality_attributes(*)
        `)
        .eq("source", "elexir_curated")
        .limit(6);

      if (curatedErr) throw curatedErr;

      if (curated && curated.length > 0) {
        setRecommendedProducts(curated);
      } else {
        // Fallback to highest available general stack products
        const { data: fallback, error: fallbackErr } = await supabase
          .from("products")
          .select(`
            *,
            brands(*),
            product_ingredients(*, ingredients(*)),
            product_goals(*),
            product_quality_attributes(*)
          `)
          .limit(6);

        if (fallbackErr) throw fallbackErr;

        if (fallback) {
          const sorted = [...fallback].sort((a, b) => {
            const scoreA = calculateElexirScore(a).score;
            const scoreB = calculateElexirScore(b).score;
            return scoreB - scoreA;
          });
          setRecommendedProducts(sorted);
        }
      }
    } catch (err) {
      console.error("Failed to load recommended products:", err);
    }
  };

  const fetchRecentlyViewed = async (uid: string) => {
    try {
      const viewed = await getRecentlyViewedProducts(uid);
      setRecentlyViewed(viewed.slice(0, 5));
    } catch (error) {
      console.error("Failed to load recently viewed", error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent searches", e);
    }
  };

  const saveRecentSearch = async (term: string) => {
    try {
      const lowerTerm = term.toLowerCase();
      const filtered = recentSearches.filter(s => s.toLowerCase() !== lowerTerm);
      const updated = [term, ...filtered].slice(0, 8);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save recent search", e);
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (e) {
      console.error("Failed to clear recent searches", e);
    }
  };

  const handleSearch = async (searchTerm?: string) => {
    const term = typeof searchTerm === "string" ? searchTerm : query;
    if (!term.trim()) return;
    setQuery(term);
    setLoading(true);
    setApiError(false);
    setHasSearched(true);
    saveRecentSearch(term.trim());
    
    const data = await searchProducts(term.trim());
    setResults(data.results);
    setApiError(data.apiError);
    setLoading(false);
  };

  const handleProductTap = async (product: Product) => {
    try {
      let productId = product.id;
      if (!productId && (product.barcode || product.external_id || product.name)) {
        productId = await upsertExternalProduct(product);
      }

      if (productId && productId.trim() !== "") {
        router.push(`/product/${productId}`);
      } else {
        Alert.alert("Product Unavailable", "Product profile is not available yet.");
      }
    } catch (error) {
      console.error("Failed to navigate to product details:", error);
      Alert.alert("Product Unavailable", "Product profile is not available yet.");
    }
  };

  const activeCategory = TOP_CATEGORIES.find(
    cat => query.toLowerCase().trim() === cat.name.toLowerCase().trim()
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!query && !hasSearched ? (
        // ─── Discovery State (Scrollable ScrollView) ───────────────────────────
        <PageContainer scrollable={true} style={{ backgroundColor: screenBg }} contentContainerStyle={getContentContainerStyle(false)}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable 
              style={[styles.backBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: borderCol }]} 
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={22} color={themeColors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Search</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputWrapper, { backgroundColor: cardBg, borderColor: borderCol, ...Shadows.low }]}>
              <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search products, brands or ingredients"
                placeholderTextColor={themeColors.textMuted}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (text === "") {
                    setHasSearched(false);
                    setResults([]);
                  }
                }}
                onSubmitEditing={() => handleSearch()}
                returnKeyType="search"
                autoFocus={false}
              />
            </View>
          </View>

          {/* Category Chips Scroll */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Categories</Text>
          </View>
          <View style={{ height: 44, marginBottom: Spacing.md }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {TOP_CATEGORIES.map(cat => {
                const isActive = activeCategory?.name === cat.name;
                return (
                  <Pressable 
                    key={cat.name} 
                    style={[
                      styles.categoryChip, 
                      { backgroundColor: cardBg, borderColor: borderCol },
                      isActive && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                    ]}
                    onPress={() => handleSearch(cat.name)}
                  >
                    <Ionicons 
                      name={cat.icon} 
                      size={14} 
                      color={isActive ? themeColors.background : themeColors.textSecondary} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text 
                      style={[
                        styles.categoryChipText, 
                        { color: themeColors.textSecondary },
                        isActive && { color: themeColors.background, fontWeight: "700" }
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Recently Viewed Scroll (up to 5 cards) */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Recently viewed</Text>
          </View>
          {recentlyViewed.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.recentScroll}
              contentContainerStyle={styles.recentScrollContent}
            >
              {recentlyViewed.map(rv => {
                if (!rv.product) return null;
                return (
                  <View key={rv.id} style={{ width: 160, marginRight: 12 }}>
                    <ProductCard 
                      product={rv.product}
                      onPress={() => handleProductTap(rv.product!)}
                      themeColors={themeColors}
                      isDark={isDark}
                      cardBg={cardBg}
                      imageBg={imageBg}
                      borderCol={borderCol}
                    />
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.recentEmptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.recentEmptyText, { color: themeColors.textMuted }]}>
                Products you view will appear here.
              </Text>
            </View>
          )}

          {/* Recommended / Top Rated Grid */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Recommended</Text>
          </View>
          {recommendedProducts.length > 0 ? (
            <View style={styles.gridContainer}>
              {recommendedProducts.map(p => (
                <View key={p.id} style={{ width: "48%", marginBottom: 16 }}>
                  <ProductCard 
                    product={p}
                    onPress={() => handleProductTap(p)}
                    themeColors={themeColors}
                    isDark={isDark}
                    cardBg={cardBg}
                    imageBg={imageBg}
                    borderCol={borderCol}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.recommendedEmptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.recommendedEmptyTitle, { color: themeColors.text }]}>No recommendations yet</Text>
              <Text style={[styles.recommendedEmptyText, { color: themeColors.textSecondary }]}>
                Complete your profile or add products to your stack to improve suggestions.
              </Text>
            </View>
          )}
        </PageContainer>
      ) : (
        // ─── Search Results State (Non-Scrollable Root View) ───────────────────
        <PageContainer scrollable={false} style={{ backgroundColor: screenBg }} contentContainerStyle={getContentContainerStyle(false)}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable 
              style={[styles.backBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)", borderColor: borderCol }]} 
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={22} color={themeColors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Search</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputWrapper, { backgroundColor: cardBg, borderColor: borderCol, ...Shadows.low }]}>
              <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search products, brands or ingredients"
                placeholderTextColor={themeColors.textMuted}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (text === "") {
                    setHasSearched(false);
                    setResults([]);
                  }
                }}
                onSubmitEditing={() => handleSearch()}
                returnKeyType="search"
                autoFocus={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => { setQuery(""); setHasSearched(false); setResults([]); }} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={themeColors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Category Chips Scroll (for quick filtering) */}
          <View style={{ height: 44, marginBottom: Spacing.sm }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {TOP_CATEGORIES.map(cat => {
                const isActive = activeCategory?.name === cat.name;
                return (
                  <Pressable 
                    key={cat.name} 
                    style={[
                      styles.categoryChip, 
                      { backgroundColor: cardBg, borderColor: borderCol },
                      isActive && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                    ]}
                    onPress={() => {
                      if (isActive) {
                        setQuery("");
                        setHasSearched(false);
                        setResults([]);
                      } else {
                        handleSearch(cat.name);
                      }
                    }}
                  >
                    <Ionicons 
                      name={cat.icon} 
                      size={14} 
                      color={isActive ? themeColors.background : themeColors.textSecondary} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text 
                      style={[
                        styles.categoryChipText, 
                        { color: themeColors.textSecondary },
                        isActive && { color: themeColors.background, fontWeight: "700" }
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={themeColors.text} />
            </View>
          ) : results.length === 0 && hasSearched ? (
            <View style={styles.emptyResultsContainer}>
              <Ionicons name="search-outline" size={48} color={themeColors.textMuted} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyResultsTitle, { color: themeColors.text }]}>No products found</Text>
              <Text style={[styles.emptyResultsText, { color: themeColors.textSecondary }]}>
                Try searching for a brand, ingredient or category.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) => item.id || `res-${index}`}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              renderItem={({ item }) => (
                <View style={{ width: "48%", marginBottom: 16 }}>
                  <ProductCard 
                    product={item}
                    onPress={() => handleProductTap(item)}
                    themeColors={themeColors}
                    isDark={isDark}
                    cardBg={cardBg}
                    imageBg={imageBg}
                    borderCol={borderCol}
                  />
                </View>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </PageContainer>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  searchContainer: {
    paddingVertical: 16,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 100,
    paddingHorizontal: 20,
    height: 52,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    padding: 0,
  },
  sectionHeader: {
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  categoriesScroll: {
  },
  categoriesScrollContent: {
    paddingRight: 48,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentScroll: {
  },
  recentScrollContent: {
    paddingRight: 48,
  },
  recentEmptyCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  recentEmptyText: {
    fontSize: 13,
    fontWeight: "500",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  recommendedEmptyCard: {
    padding: 24,
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendedEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  recommendedEmptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  emptyResultsContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyResultsTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyResultsText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  listContent: {
    paddingBottom: 60,
  },
  productCard: {
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
    padding: 12,
    flex: 1,
  },
  productImageContainer: {
    borderRadius: BorderRadii.lg,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
    padding: 8,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productInfoContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  productBrand: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 8,
  },
  productBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  qualityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
  },
  qualityBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  productCategoryLabel: {
    fontSize: 11,
    maxWidth: "55%",
  },
});
