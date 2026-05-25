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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { searchProducts, saveProduct, getSavedProducts, unsaveProduct, upsertExternalProduct } from "../lib/products";
import { Product, UserSavedProduct } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { calculateMatch } from "../lib/matching";
import { formatCategory, formatProductName, formatBrandName, formatGoalLabel, formatIngredientList, shouldDisplayField, getProductImageFallback } from "../lib/productDisplay";
import { ProductRow } from "../src/components/ProductRow";

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        fetchSavedProducts(data.user.id);
      }
    });
  }, []);

  const fetchSavedProducts = async (uid: string) => {
    const saved = await getSavedProducts(uid);
    setSavedProducts(saved);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setApiError(false);
    setHasSearched(true);
    const data = await searchProducts(query.trim());
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
            placeholder="Search supplements, e.g. Magnesium..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Search for supplements</Text>
            <Text style={styles.emptySubtitle}>Find products by name or brand</Text>
          </View>
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
    paddingBottom: 16,
  },
  searchInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1C1C1E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
});
