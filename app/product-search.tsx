import { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { searchProducts, saveProduct, getSavedProducts, unsaveProduct, upsertExternalProduct, getRecentlyViewedProducts } from "../lib/products";
import { Product, UserSavedProduct, RecentlyViewedProduct } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { calculateMatch } from "../lib/matching";
import { calculateElexirScore } from "../lib/scoring";
import { formatCategory, formatProductName, formatBrandName, formatGoalLabel, formatIngredientList, shouldDisplayField, getProductImageFallback } from "../lib/productDisplay";
import { ProductRow } from "../src/components/ProductRow";

const TOP_CATEGORIES = [
  { icon: "💤", name: "Magnesium" },
  { icon: "☀️", name: "Vitamin D" },
  { icon: "🐟", name: "Omega-3" },
  { icon: "🛡️", name: "Zinc" },
  { icon: "🦠", name: "Probiotics" },
  { icon: "🌿", name: "Ashwagandha" },
  { icon: "✨", name: "Collagen" },
  { icon: "🩸", name: "Iron" }
];

const RECENT_SEARCHES_KEY = "@recent_searches";

const CompactRecentlyViewedRow = ({ item, onPress }: { item: RecentlyViewedProduct, onPress: () => void }) => {
  const product = item.product;
  if (!product) return null;
  const elexir = calculateElexirScore(product);
  
  return (
    <Pressable style={styles.compactRow} onPress={onPress}>
      <View style={styles.compactImageContainer}>
        <Image 
          source={{ uri: product.image_url || getProductImageFallback(product.category) }} 
          style={styles.compactImage} 
        />
      </View>
      <View style={styles.compactInfo}>
        <Text style={styles.compactName} numberOfLines={1}>{formatProductName(product.name)}</Text>
        <Text style={styles.compactBrand} numberOfLines={1}>{formatBrandName(product.brands?.name)}</Text>
      </View>
      <View style={styles.scoreCircle}>
        <Text style={styles.scoreCircleText}>{elexir.score}</Text>
      </View>
    </Pressable>
  );
};

export default function ProductSearchScreen() {
  const router = useRouter();
  const { userPreferences } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedProducts, setSavedProducts] = useState<UserSavedProduct[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    loadRecentSearches();
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        fetchSavedProducts(data.user.id);
        fetchRecentlyViewed(data.user.id);
      }
    });
  }, []);

  const fetchRecentlyViewed = async (uid: string) => {
    try {
      const viewed = await getRecentlyViewedProducts(uid);
      setRecentlyViewed(viewed.slice(0, 5));
    } catch (error) {
      console.error("Failed to load recently viewed", error);
    }
  };

  const fetchSavedProducts = async (uid: string) => {
    const saved = await getSavedProducts(uid);
    setSavedProducts(saved);
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
      // Dedupe, move to front
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
      // Upsert without saving to user cabinet if it's from OFF
      const productId = await upsertExternalProduct(product);
      router.push(`/product/${productId}`);
    } catch (error) {
      console.error("Failed to navigate to product details:", error);
    }
  };

  const isSaved = (product: Product) => {
    return savedProducts.some((sp) => 
      sp.product_id === product.id || 
      (sp.product?.barcode && sp.product.barcode === product.barcode) ||
      (sp.product?.external_id && sp.product.external_id === product.external_id)
    );
  };

  const toggleSave = async (product: Product) => {
    if (!userId) return;

    const savedItem = savedProducts.find((sp) => 
      sp.product_id === product.id || 
      (sp.product?.barcode && sp.product.barcode === product.barcode) ||
      (sp.product?.external_id && sp.product.external_id === product.external_id)
    );

    try {
      if (savedItem) {
        // Unsave
        await unsaveProduct(userId, savedItem.product_id);
      } else {
        // Save
        await saveProduct(userId, product);
      }
      // Refresh saved products state to reflect the change
      await fetchSavedProducts(userId);
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const saved = isSaved(item);
    
    // Calculate Match
    const productGoals = item.product_goals?.length ? item.product_goals.map(g => g.goal) : (item.inferred_goals || []);
    const match = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, productGoals);

    if (match.score === 0 && item.source === "open_food_facts") {
      console.log("[Debug] No match for OFF product:", {
        name: item.name,
        brand: item.brand,
        category: item.category,
        ingredients: item.raw_data?.ingredients_text,
        inferred_goals: item.inferred_goals,
        user_goals: userPreferences?.primary_goals,
      });
    }

    const saveButton = (
      <Pressable 
        style={[styles.saveBtn, saved && styles.savedBtn]} 
        onPress={() => toggleSave(item)}
      >
        <Text style={[styles.saveBtnText, saved && styles.savedBtnText]}>
          {saved ? "♥ Saved" : "♡ Save"}
        </Text>
      </Pressable>
    );

    return (
      <ProductRow
        product={item}
        match={match}
        goals={productGoals}
        onPress={() => handleProductTap(item)}
        rightAccessory={saveButton}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Find Products</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search supplements, ingredients or brands"
            placeholderTextColor="#8E8E93"
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
          />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#1C1C1E" />
          </View>
        ) : results.length === 0 && hasSearched ? (
          <View style={styles.emptyContainer}>
            {apiError ? (
              <>
                <Text style={styles.emptyEmoji}>⚠️</Text>
                <Text style={styles.emptyTitle}>Connection issue</Text>
                <Text style={styles.emptySubtitle}>We couldn’t reach the product database right now. Try again in a moment.</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySubtitle}>We couldn't find any products matching your search.</Text>
              </>
            )}
          </View>
        ) : results.length === 0 && !hasSearched ? (
          <ScrollView 
            style={styles.guidedContainer} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoriesGrid}>
              {TOP_CATEGORIES.map(cat => (
                <Pressable 
                  key={cat.name} 
                  style={styles.categoryGridCard}
                  onPress={() => handleSearch(cat.name)}
                >
                  <Text style={styles.categoryGridIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryGridName}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>

            {recentlyViewed.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recently Viewed</Text>
                {recentlyViewed.map(rv => (
                  <CompactRecentlyViewedRow 
                    key={rv.id} 
                    item={rv} 
                    onPress={() => router.push(`/product/${rv.product_id}`)} 
                  />
                ))}
              </View>
            )}

            {recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <Pressable onPress={clearRecentSearches} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.recentChipsContainer}>
                  {recentSearches.map((term, index) => (
                    <Pressable 
                      key={`${term}-${index}`} 
                      style={styles.recentSearchChip}
                      onPress={() => handleSearch(term)}
                    >
                      <Text style={styles.recentSearchChipText}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, index) => item.id || `temp-${index}`}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  backBtnText: { fontSize: 24, color: "#1C1C1E" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1C1C1E",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#8E8E93", textAlign: "center", lineHeight: 22 },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: "#F2F2F7",
  },
  savedBtn: {
    backgroundColor: "#1C1C1E",
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  savedBtnText: {
    color: "#FFFFFF",
  },
  guidedContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryGridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryGridIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  categoryGridName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  recentSection: {
    marginTop: 24,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  recentChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentSearchChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  recentSearchChipText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#3F3F46",
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  compactImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
    marginRight: 16,
  },
  compactImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  compactInfo: {
    flex: 1,
    marginRight: 16,
  },
  compactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  compactBrand: {
    fontSize: 14,
    color: "#8E8E93",
  },
  scoreCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreCircleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
