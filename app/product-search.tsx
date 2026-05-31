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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { searchProducts, saveProduct, getSavedProducts, unsaveProduct, upsertExternalProduct, getRecentlyViewedProducts } from "../lib/products";
import { Product, UserSavedProduct, RecentlyViewedProduct } from "../lib/types";
import { useAuth } from "../lib/auth-context";
import { calculateMatch } from "../lib/matching";
import { calculateElexirScore } from "../lib/scoring";
import { formatCategory, formatProductName, formatBrandName, getProductImageFallback } from "../lib/productDisplay";
import { ProductRow } from "../src/components/ProductRow";
import { PageContainer } from "../src/components/ui/PageContainer";
import { SoftCard } from "../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, Shadows, Typography } from "../src/constants/theme";
import { useColorScheme } from "../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const TOP_CATEGORIES = [
  { icon: "moon-outline" as keyof typeof Ionicons.glyphMap, name: "Magnesium" },
  { icon: "sunny-outline" as keyof typeof Ionicons.glyphMap, name: "Vitamin D" },
  { icon: "water-outline" as keyof typeof Ionicons.glyphMap, name: "Omega-3" },
  { icon: "shield-checkmark-outline" as keyof typeof Ionicons.glyphMap, name: "Zinc" },
  { icon: "flask-outline" as keyof typeof Ionicons.glyphMap, name: "Probiotics" },
  { icon: "leaf-outline" as keyof typeof Ionicons.glyphMap, name: "Ashwagandha" },
  { icon: "sparkles-outline" as keyof typeof Ionicons.glyphMap, name: "Collagen" },
  { icon: "pulse-outline" as keyof typeof Ionicons.glyphMap, name: "Iron" }
];

const RECENT_SEARCHES_KEY = "@recent_searches";

interface CompactRecentlyViewedRowProps {
  item: RecentlyViewedProduct;
  onPress: () => void;
  themeColors: typeof Colors.light | typeof Colors.dark;
}

const CompactRecentlyViewedRow = ({ item, onPress, themeColors }: CompactRecentlyViewedRowProps) => {
  const product = item.product;
  if (!product) return null;
  const elexir = calculateElexirScore(product);
  
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.compactRow, 
        { 
          backgroundColor: themeColors.background, 
          borderColor: themeColors.borderMuted,
          ...Shadows.low
        }, 
        pressed && { opacity: 0.85 }
      ]} 
      onPress={onPress}
    >
      <View style={[styles.compactImageContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
        {product.image_url ? (
          <Image 
            source={{ uri: product.image_url }} 
            style={styles.compactImage} 
          />
        ) : (
          <Ionicons name={getProductImageFallback(product.category) as keyof typeof Ionicons.glyphMap || "cube-outline"} size={20} color={themeColors.textMuted} />
        )}
      </View>
      <View style={styles.compactInfo}>
        <Text style={[styles.compactName, { color: themeColors.text }]} numberOfLines={1}>{formatProductName(product.name)}</Text>
        <Text style={[styles.compactBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {formatBrandName(product.brands?.name || product.brand)}
        </Text>
      </View>
      <View style={[styles.scoreBadgeMini, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Ionicons name="sparkles" size={10} color={themeColors.text} style={{ marginRight: 4 }} />
        <Text style={[styles.scoreBadgeText, { color: themeColors.text }]}>{elexir.score}</Text>
      </View>
    </Pressable>
  );
};

export default function ProductSearchScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

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
        await unsaveProduct(userId, savedItem.product_id);
      } else {
        await saveProduct(userId, product);
      }
      await fetchSavedProducts(userId);
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const saved = isSaved(item);
    
    const productGoals = item.product_goals?.length
      ? item.product_goals.map(g => g.goal)
      : (item.inferred_goals || []);
    const match = calculateMatch(
      userPreferences?.primary_goals,
      userPreferences?.health_concerns,
      productGoals
    );

    const saveButton = (
      <Pressable 
        style={[
          styles.saveBtn, 
          { backgroundColor: themeColors.backgroundElement },
          saved && { backgroundColor: themeColors.text }
        ]} 
        onPress={() => toggleSave(item)}
      >
        <Text style={[styles.saveBtnText, { color: themeColors.textSecondary }, saved && { color: themeColors.background }]}>
          {saved ? "Saved" : "Save"}
        </Text>
      </Pressable>
    );

    return (
      <View style={styles.productRowContainer}>
        <ProductRow
          product={item}
          match={match}
          goals={productGoals}
          onPress={() => handleProductTap(item)}
          rightAccessory={saveButton}
          style={{
            backgroundColor: themeColors.background,
            borderColor: themeColors.borderMuted,
            borderWidth: 1,
            borderRadius: BorderRadii.xl,
            padding: Spacing.md,
            ...Shadows.low,
          }}
        />
      </View>
    );
  };

  return (
    <PageContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        {/* Premium Discovery Header */}
        <View style={styles.heroHeader}>
          <Pressable 
            style={[styles.backBtn, { backgroundColor: themeColors.backgroundElement }]} 
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color={themeColors.text} />
          </Pressable>
        </View>

        <View style={styles.titleContainer}>
          <Text style={[styles.heroTitle, { color: themeColors.text }]}>Formulary</Text>
          <Text style={[styles.heroSubtitle, { color: themeColors.textSecondary }]}>Search verified supplements and clinical protocols.</Text>
        </View>

        {/* Large Premium Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[
            styles.searchInputWrapper, 
            { 
              backgroundColor: themeColors.background, 
              borderColor: themeColors.borderMuted,
              ...Shadows.premium
            }
          ]}>
            <Ionicons name="search" size={20} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search formulations, ingredients..."
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
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setHasSearched(false); setResults([]); }} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={themeColors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={themeColors.textSecondary} />
          </View>
        ) : results.length === 0 && hasSearched ? (
          <View style={styles.emptyContainer}>
            {apiError ? (
              <>
                <View style={[styles.emptyIconCircle, { backgroundColor: themeColors.backgroundElement }]}>
                  <Ionicons name="cloud-offline" size={32} color={themeColors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Service Unavailable</Text>
                <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>Unable to connect to the medical database.</Text>
              </>
            ) : (
              <>
                <View style={[styles.emptyIconCircle, { backgroundColor: themeColors.backgroundElement }]}>
                  <Ionicons name="search" size={32} color={themeColors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Matches Found</Text>
                <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>No supplements matched the query. Try alternative ingredient names.</Text>
              </>
            )}
          </View>
        ) : results.length === 0 && !hasSearched ? (
          <ScrollView 
            style={styles.guidedContainer} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Active Categories */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Clinical Categories</Text>
            </View>
            <View style={styles.categoriesGrid}>
              {TOP_CATEGORIES.map(cat => (
                <Pressable 
                  key={cat.name} 
                  style={[
                    styles.categoryGridCard, 
                    { 
                      backgroundColor: themeColors.background, 
                      borderColor: themeColors.borderMuted,
                      ...Shadows.low
                    }
                  ]}
                  onPress={() => handleSearch(cat.name)}
                >
                  <View style={[styles.categoryIconCircle, { backgroundColor: themeColors.backgroundElement }]}>
                    <Ionicons name={cat.icon} size={16} color={themeColors.text} />
                  </View>
                  <Text style={[styles.categoryGridName, { color: themeColors.text }]}>{cat.name}</Text>
                </Pressable>
              ))}
            </View>

            {/* Recently Analyzed */}
            {recentlyViewed.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Recently Analyzed</Text>
                </View>
                {recentlyViewed.map(rv => (
                  <CompactRecentlyViewedRow 
                    key={rv.id} 
                    item={rv} 
                    onPress={() => router.push(`/product/${rv.product_id}`)} 
                    themeColors={themeColors}
                  />
                ))}
              </View>
            )}

            {/* Recent Queries */}
            {recentSearches.length > 0 && (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>Recent Queries</Text>
                  <Pressable onPress={clearRecentSearches} style={styles.clearBtn} hitSlop={12}>
                    <Text style={[styles.clearBtnText, { color: themeColors.textSecondary }]}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.recentChipsContainer}>
                  {recentSearches.map((term, index) => (
                    <Pressable 
                      key={`${term}-${index}`} 
                      style={[
                        styles.recentSearchChip, 
                        { 
                          backgroundColor: themeColors.background, 
                          borderColor: themeColors.borderMuted,
                          ...Shadows.low
                        }
                      ]}
                      onPress={() => handleSearch(term)}
                    >
                      <Ionicons name="time-outline" size={12} color={themeColors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.recentSearchChipText, { color: themeColors.textSecondary }]}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <View style={{ height: 100 }} />
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
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 100,
    paddingHorizontal: 20,
    height: 56,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    padding: 0,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: { 
    fontSize: 15, 
    textAlign: "center", 
    lineHeight: 22 
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  productRowContainer: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  guidedContainer: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  categoryGridCard: {
    width: "48%",
    borderRadius: BorderRadii.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  categoryGridName: {
    fontSize: 14,
    fontWeight: "600",
  },
  recentSection: {
    marginTop: 24,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 24,
  },
  recentSearchChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  recentSearchChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadii.xl,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    marginHorizontal: 24,
  },
  compactImageContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadii.md,
    overflow: "hidden",
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  compactImage: {
    width: "80%",
    height: "80%",
    resizeMode: "contain",
  },
  compactInfo: {
    flex: 1,
    marginRight: 16,
  },
  compactName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  compactBrand: {
    fontSize: 13,
  },
  scoreBadgeMini: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadii.sm,
  },
  scoreBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
