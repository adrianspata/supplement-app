import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { getProductById, getSavedProducts, saveProduct, unsaveProduct, markProductAsViewed, getSimilarProducts } from "../../lib/products";
import { Product, UserSavedProduct } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch, generateWhyItMatches } from "../../lib/matching";
import { calculateElexirScore } from "../../lib/scoring";
import { addToStack } from "../../lib/stack";
import { StackTiming } from "../../lib/types";
import { formatCategory, formatProductName, formatBrandName, formatGoalLabel, formatQualityAttribute, formatIngredientName, shouldDisplayField, getProductImageFallback } from "../../lib/productDisplay";
import { ProductCompareRow } from "../../src/components/ProductCompareRow";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userPreferences } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedProducts, setSavedProducts] = useState<UserSavedProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        fetchSavedProducts(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  useEffect(() => {
    if (product?.id && userId) {
      markProductAsViewed(userId, product.id);
    }
  }, [product?.id, userId]);

  const fetchSavedProducts = async (uid: string) => {
    const saved = await getSavedProducts(uid);
    setSavedProducts(saved);
  };

  const fetchProduct = async (productId: string) => {
    setLoading(true);
    const data = await getProductById(productId);
    setProduct(data);
    if (data) {
      const similar = await getSimilarProducts(data, 3);
      setSimilarProducts(similar);
    }
    setLoading(false);
  };

  const isSaved = product && savedProducts.some((sp) => sp.product_id === product.id);

  const toggleSave = async () => {
    if (!userId || !product) return;
    try {
      if (isSaved) {
        await unsaveProduct(userId, product.id);
      } else {
        await saveProduct(userId, product);
      }
      await fetchSavedProducts(userId);
    } catch (error) {
      console.error("Error toggling save status:", error);
    }
  };

  const handleAddToStack = async (timing: StackTiming) => {
    if (!userId || !product) return;
    try {
      await addToStack(userId, product.id, timing);
      Alert.alert("Added to Stack", `This product has been added to your ${timing.replace("_", " ")} routine.`);
    } catch (error) {
      console.error("Error adding to stack:", error);
      Alert.alert("Error", "Could not add to stack.");
    }
  };

  const promptStack = () => {
    if (!userId) {
      Alert.alert("Please sign in", "You must be signed in to build a stack.");
      return;
    }
    const pref = userPreferences?.reminder_time;
    Alert.alert(
      "Add to Stack",
      "When do you take this supplement?",
      [
        { text: `Morning${pref === 'morning' ? ' (Preferred)' : ''}`, onPress: () => handleAddToStack("morning") },
        { text: `Afternoon${pref === 'afternoon' ? ' (Preferred)' : ''}`, onPress: () => handleAddToStack("afternoon") },
        { text: `Evening${pref === 'evening' ? ' (Preferred)' : ''}`, onPress: () => handleAddToStack("evening") },
        { text: "As needed", onPress: () => handleAddToStack("as_needed") },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
        <Pressable style={styles.backButtonEmpty} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ingredients = product.product_ingredients || [];
  const productGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : (product.inferred_goals || []);
  const attributes = product.product_quality_attributes?.map(a => a.attribute) || [];
  
  const match = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, productGoals);
  const elexir = calculateElexirScore(product);

  const ALLERGY_SYNONYMS: Record<string, string[]> = {
    dairy: ["dairy", "milk", "whey", "casein", "lactose", "cream", "butter", "cheese"],
    gluten: ["gluten", "wheat", "barley", "rye", "malt"],
    soy: ["soy", "soja", "soy lecithin"],
    fish: ["fish", "fish oil", "omega-3 from fish", "cod liver oil"],
    shellfish: ["shellfish", "shrimp", "crab", "lobster", "prawn"]
  };
  
  const userAllergies = userPreferences?.allergies || [];
  const foundAllergies = new Set<string>();
  
  userAllergies.forEach(userAllergy => {
    const normalized = userAllergy.toLowerCase().trim();
    const synonyms = ALLERGY_SYNONYMS[normalized] || [normalized];
    
    ingredients.forEach(pi => {
      const ingName = (pi.ingredient?.name || "").toLowerCase();
      const ingDesc = (pi.ingredient?.description || "").toLowerCase();
      const ingForm = (pi.form || "").toLowerCase();
      
      synonyms.forEach(syn => {
        if (ingName.includes(syn) || ingDesc.includes(syn) || ingForm.includes(syn)) {
          foundAllergies.add(normalized);
        }
      });
    });
  });

  const userDiet = userPreferences?.diet_type;
  let isDietMatch = false;
  if (userDiet) {
    const normDiet = userDiet.toLowerCase();
    isDietMatch = attributes.some(a => {
      const normAttr = a.toLowerCase();
      if (normDiet === "vegetarian" && (normAttr.includes("vegetarian") || normAttr.includes("vegan"))) return true;
      return normAttr.includes(normDiet);
    });
  }

  const isAdvanced = userPreferences?.health_knowledge_level === 'advanced';
  const isBeginner = userPreferences?.health_knowledge_level === 'beginner';
  const formattedGoalsList = productGoals.length > 0 ? productGoals.map(formatGoalLabel).filter(Boolean).join(", ") : "your daily wellness routine";
  
  const introText = isAdvanced 
    ? `The specific compounds in this formulation are designed to support ${formattedGoalsList}.`
    : isBeginner 
      ? `This product is a great starting point to help support ${formattedGoalsList}.`
      : `This product is formulated to support ${formattedGoalsList}.`;

  const knowns: string[] = [];
  const unknowns: string[] = [];

  if (product.brands?.name || product.brand) knowns.push("Brand");
  else unknowns.push("Brand not provided");

  if (ingredients.length > 0) knowns.push("Ingredients");
  else unknowns.push("Full ingredient list unavailable");

  if (productGoals.length > 0) knowns.push("Goals");
  
  if (attributes.length > 0) knowns.push("Quality attributes");

  const hasThirdParty = attributes.some(a => a.toLowerCase().includes("third_party") || a.toLowerCase().includes("third party") || a.toLowerCase().includes("third-party"));
  if (!hasThirdParty) unknowns.push("Third-party testing not provided");

  const hasDosage = ingredients.length > 0 && ingredients.every(i => i.amount);
  if (ingredients.length > 0 && !hasDosage) unknowns.push("Exact dosage missing");

  return (
    <View style={styles.container}>
      {/* Header Navigation overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={[styles.iconButton, { marginRight: 12 }]} onPress={() => router.push(`/assistant?type=product&productId=${id}`)}>
            <Text style={styles.iconText}>✨</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={toggleSave}>
            <Text style={[styles.iconText, isSaved && styles.iconTextSaved]}>
              {isSaved ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Area */}
        <View style={styles.heroContainer}>
          {getProductImageFallback(product.image_url) ? (
            <Image source={{ uri: getProductImageFallback(product.image_url)! }} style={styles.heroImage} resizeMode="contain" />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <Text style={styles.placeholderEmoji}>🧴</Text>
            </View>
          )}
        </View>

        {/* Product Titles */}
        <View style={styles.titleSection}>
          <Text style={styles.brandName}>{formatBrandName(product.brands?.name || product.brand) || "Elexir Curated"}</Text>
          <Text style={styles.productName}>{formatProductName(product.name)}</Text>
          {shouldDisplayField(formatCategory(product.category)) && (
            <Text style={styles.categoryText}>{formatCategory(product.category)}</Text>
          )}
        </View>

        {/* Elexir Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreTitle}>Elexir Score</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>{elexir.score} <Text style={styles.scoreMax}>/ 100</Text></Text>
            </View>
          </View>
          
          <View style={styles.scoreBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Transparency</Text>
              <Text style={styles.breakdownValue}>{elexir.breakdown.transparency} <Text style={styles.breakdownMax}>/ 25</Text></Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Ingredients</Text>
              <Text style={styles.breakdownValue}>{elexir.breakdown.ingredients} <Text style={styles.breakdownMax}>/ 30</Text></Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Quality</Text>
              <Text style={styles.breakdownValue}>{elexir.breakdown.quality} <Text style={styles.breakdownMax}>/ 20</Text></Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Goal Relevance</Text>
              <Text style={styles.breakdownValue}>{elexir.breakdown.goalRelevance} <Text style={styles.breakdownMax}>/ 25</Text></Text>
            </View>
          </View>

          <View style={styles.scoreDivider} />

          <Text style={styles.whyScoreTitle}>Why this scored {elexir.score}</Text>

          {elexir.pros.length > 0 && (
            <View style={styles.scoreList}>
              <Text style={styles.thingsToKnowTitle}>Strengths</Text>
              {elexir.pros.map((pro, idx) => (
                <Text key={`pro-${idx}`} style={styles.scoreItem}>✓ {pro}</Text>
              ))}
            </View>
          )}

          {elexir.thingsToKnow.length > 0 && (
            <View style={[styles.scoreList, { marginTop: elexir.pros.length > 0 ? 16 : 0 }]}>
              <Text style={styles.thingsToKnowTitle}>Limited Information</Text>
              {elexir.thingsToKnow.map((ttk, idx) => (
                <Text key={`ttk-${idx}`} style={styles.scoreItemNeutral}>• {ttk}</Text>
              ))}
            </View>
          )}

          <Text style={styles.scoreDisclaimer}>
            This score reflects available product information, transparency, and goal relevance. It does not measure medical effectiveness.
          </Text>
        </View>

        {/* Why This Matters (Curated) */}
        {product.source === "elexir_curated" && product.raw_data?.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this supplement</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {product.raw_data.description}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why this supplement matters</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {introText}
              </Text>
            </View>
          </View>
        )}

        {/* Why It Matches You */}
        {match.score > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Matches your goals</Text>
            <View style={styles.matchCard}>
              <View style={styles.matchCardHeader}>
                <View style={[styles.matchBadgeDetail, styles[`match_${match.score}` as keyof typeof styles]]}>
                  <Text style={styles.matchBadgeTextDetail}>
                    {match.score >= 3 ? "✨ " : ""}{match.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardText}>
                {generateWhyItMatches(match.matchedGoals)}
              </Text>
              <View style={styles.matchList}>
                {match.matchedGoals.map(g => {
                  const label = formatGoalLabel(g);
                  if (!label) return null;
                  return (
                  <View key={g} style={styles.matchRow}>
                    <Text style={styles.matchCheck}>✓</Text>
                    <Text style={styles.matchText}>{label}</Text>
                  </View>
                )})}
              </View>
            </View>
          </View>
        )}

        {/* Key Benefits */}
        {shouldDisplayField(productGoals) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Benefits</Text>
            <View style={styles.chipsContainer}>
              {productGoals.map(g => {
                const label = formatGoalLabel(g);
                if (!label) return null;
                return (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              )})}
            </View>
          </View>
        )}

        {/* What's Inside */}
        {shouldDisplayField(ingredients) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's inside</Text>
            {ingredients.map((pi) => {
              const ingName = formatIngredientName(pi.ingredient?.name);
              if (!ingName) return null;
              return (
              <View key={pi.id} style={styles.ingredientCard}>
                <View style={styles.ingredientHeader}>
                  <Text style={styles.ingredientName}>{ingName}</Text>
                  {pi.amount && (
                    <Text style={styles.ingredientAmount}>{pi.amount}{pi.unit || ""}</Text>
                  )}
                </View>
                {shouldDisplayField(pi.form) && (
                  <Text style={styles.ingredientForm}>{pi.form}</Text>
                )}
                {shouldDisplayField(pi.ingredient?.description) && (
                  <Text style={styles.ingredientDesc}>{pi.ingredient!.description}</Text>
                )}
              </View>
            )})}
            
            {Array.from(foundAllergies).map(allergy => (
              <View key={`allergy-${allergy}`} style={styles.allergyNotice}>
                <Text style={styles.allergyNoticeText}>Contains possible {allergy}-derived ingredients.</Text>
                <Text style={styles.allergyNoticeSub}>You indicated you avoid {allergy}.</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quality & Transparency */}
        {shouldDisplayField(attributes) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quality & Transparency</Text>
            <View style={styles.card}>
              {isDietMatch && (
                <View style={styles.matchRow}>
                  <Text style={styles.matchCheck}>✓</Text>
                  <Text style={styles.matchText}>Matches your diet</Text>
                </View>
              )}
              {attributes.map(a => {
                const label = formatQualityAttribute(a);
                if (!label) return null;
                return (
                <View key={a} style={styles.matchRow}>
                  <Text style={styles.matchCheck}>✓</Text>
                  <Text style={styles.matchText}>{label}</Text>
                </View>
              )})}
            </View>
          </View>
        )}

        {/* Safety & Trust */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Transparency</Text>
          <View style={styles.card}>
            <View style={{ marginBottom: unknowns.length > 0 ? 16 : 0 }}>
              <Text style={styles.cardLabel}>What we know</Text>
              {knowns.map(k => (
                <View key={`known-${k}`} style={styles.matchRow}>
                  <Text style={styles.matchCheck}>✓</Text>
                  <Text style={styles.matchText}>{k}</Text>
                </View>
              ))}
            </View>
            
            {unknowns.length > 0 && (
              <View>
                <Text style={styles.cardLabel}>What we don't know</Text>
                {unknowns.map(u => (
                  <View key={`unknown-${u}`} style={styles.matchRow}>
                    <Text style={[styles.matchCheck, { color: '#8E8E93' }]}>?</Text>
                    <Text style={[styles.matchText, { color: '#636366' }]}>{u}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Safety Note */}
        <View style={styles.section}>
          <View style={styles.safetyCard}>
            <Text style={styles.safetyEmoji}>⚠️</Text>
            <Text style={styles.safetyText}>
              Elexir provides educational product information only. Always check with a healthcare professional if you are pregnant, breastfeeding, taking medication, or managing a medical condition.
            </Text>
          </View>
        </View>

        {/* How To Use */}
        {(product.source === "elexir_curated" && product.raw_data?.suggested_use) ? (
          <View style={[styles.section, similarProducts.length === 0 ? { paddingBottom: 100 } : undefined]}>
            <Text style={styles.sectionTitle}>How to use</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Suggested use:</Text>
              <Text style={styles.cardText}>
                {product.raw_data.suggested_use}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.section, similarProducts.length === 0 ? { paddingBottom: 100 } : undefined]}>
            <Text style={styles.sectionTitle}>How to use</Text>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Suggested use:</Text>
              <Text style={styles.cardText}>
                1 capsule daily with food, or as directed by your healthcare practitioner.
              </Text>
            </View>
          </View>
        )}

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <View style={[styles.section, { paddingBottom: 100 }]}>
            <Text style={styles.sectionTitle}>Similar products to explore</Text>
            {similarProducts.map(p => {
              const pGoals = p.product_goals?.length ? p.product_goals.map(g => g.goal) : (p.inferred_goals || []);
              const pMatch = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, pGoals);
              return (
                <ProductCompareRow 
                  key={p.id} 
                  product={p} 
                  match={pMatch} 
                  onPress={() => router.push(`/product/${p.id}`)} 
                />
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={[styles.bottomCTAContainer, { paddingBottom: insets.bottom || 24 }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable 
            style={[styles.ctaButton, { flex: 1 }, isSaved && styles.ctaButtonSaved]} 
            onPress={toggleSave}
          >
            <Text style={[styles.ctaText, isSaved && styles.ctaTextSaved]}>
              {isSaved ? "Saved ✓" : "Save"}
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.ctaButton, { flex: 1.5 }]} 
            onPress={promptStack}
          >
            <Text style={styles.ctaText}>Add to Stack</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F6" },
  centerContainer: { flex: 1, backgroundColor: "#FAF9F6", alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 18, color: "#1C1C1E", marginBottom: 16 },
  backButtonEmpty: { padding: 12, backgroundColor: "#1C1C1E", borderRadius: 8 },
  backButtonText: { color: "#FFF", fontWeight: "600" },

  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerRight: { flexDirection: "row" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconText: { fontSize: 22, color: "#1C1C1E", fontWeight: "300" },
  iconTextSaved: { color: "#FF3B30" },

  scrollContent: {
    paddingTop: 100, // space for header
  },

  heroContainer: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  heroImage: {
    width: "80%",
    height: "100%",
  },
  placeholderImage: {
    backgroundColor: "#F2F2F7",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 80 },

  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
    alignItems: "center",
  },
  brandName: { fontSize: 13, color: "#8E8E93", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },
  productName: { fontSize: 32, fontWeight: "800", color: "#1C1C1E", letterSpacing: -0.5, textAlign: "center", marginBottom: 8, lineHeight: 38 },
  categoryText: { fontSize: 15, color: "#636366" },

  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },

  scoreCard: {
    marginHorizontal: 24,
    marginBottom: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  scoreTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  scoreBadge: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  scoreValue: { fontSize: 16, fontWeight: "800", color: "#FFF" },
  scoreMax: { fontSize: 12, fontWeight: "500", color: "#A1A1AA" },
  scoreBreakdown: { marginBottom: 20 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  breakdownLabel: { fontSize: 14, color: "#636366", fontWeight: "500" },
  breakdownValue: { fontSize: 14, fontWeight: "700", color: "#1C1C1E" },
  breakdownMax: { fontSize: 12, color: "#A1A1AA", fontWeight: "500" },
  scoreDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginBottom: 20 },
  whyScoreTitle: { fontSize: 15, fontWeight: "700", color: "#1C1C1E", marginBottom: 12 },
  scoreList: {},
  scoreItem: { fontSize: 14, color: "#3F3F46", marginBottom: 8, fontWeight: "500" },
  thingsToKnowTitle: { fontSize: 12, fontWeight: "700", color: "#8E8E93", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  scoreItemNeutral: { fontSize: 14, color: "#636366", marginBottom: 6, lineHeight: 20 },
  scoreDisclaimer: { fontSize: 11, color: "#A1A1AA", marginTop: 24, fontStyle: "italic", textAlign: "center", lineHeight: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  matchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  matchCardHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  matchBadgeDetail: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  match_3: { backgroundColor: "#E8F5E9" }, // Excellent
  match_2: { backgroundColor: "#E3F2FD" }, // Good
  match_1: { backgroundColor: "#F2F2F7" }, // Partial
  matchBadgeTextDetail: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  matchList: { marginTop: 16 },
  cardText: { fontSize: 16, color: "#3F3F46", lineHeight: 24, fontWeight: "400" },
  cardLabel: { fontSize: 13, color: "#8E8E93", fontWeight: "600", marginBottom: 4 },

  matchRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  matchCheck: { fontSize: 16, color: "#10B981", marginRight: 12, fontWeight: "800" },
  matchText: { fontSize: 16, color: "#1C1C1E", fontWeight: "500", textTransform: "capitalize" },

  chipsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  chipText: { fontSize: 14, fontWeight: "600", color: "#1C1C1E", textTransform: "capitalize" },

  emptyText: { color: "#8E8E93", fontStyle: "italic" },
  ingredientCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  ingredientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  ingredientName: { fontSize: 16, fontWeight: "700", color: "#1C1C1E", flex: 1, marginRight: 8 },
  ingredientAmount: { fontSize: 16, fontWeight: "600", color: "#1C1C1E" },
  ingredientForm: { fontSize: 14, color: "#8E8E93", marginBottom: 8 },
  ingredientDesc: { fontSize: 14, color: "#3F3F46", lineHeight: 22, marginTop: 4 },

  allergyNotice: {
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  allergyNoticeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  allergyNoticeSub: {
    fontSize: 13,
    color: "#636366",
  },

  safetyCard: {
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  safetyEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  safetyText: {
    flex: 1,
    fontSize: 13,
    color: "#636366",
    lineHeight: 18,
  },

  bottomCTAContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  ctaButton: {
    backgroundColor: "#1C1C1E",
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaButtonSaved: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  ctaTextSaved: { color: "#1C1C1E" },
});
