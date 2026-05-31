import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch, generateWhyItMatches } from "../../lib/matching";
import { formatBrandName, formatCategory, formatGoalLabel, formatIngredientName, formatProductName, formatQualityAttribute, getProductImageFallback, shouldDisplayField } from "../../lib/productDisplay";
import { getProductById, getSavedProducts, getSimilarProducts, markProductAsViewed, saveProduct, unsaveProduct } from "../../lib/products";
import { calculateElexirScore } from "../../lib/scoring";
import { addToStack, getUserStack } from "../../lib/stack";
import { supabase } from "../../lib/supabase";
import { Product, StackTiming, UserSavedProduct } from "../../lib/types";
import { ProductCompareRow } from "../../src/components/ProductCompareRow";
import { PremiumButton } from "../../src/components/ui/PremiumButton";
import { SurfaceCard } from "../../src/components/ui/SurfaceCard";
import { BlurLevels, BorderRadii, Colors, Shadows, Spacing } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  const { userPreferences } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedProducts, setSavedProducts] = useState<UserSavedProduct[]>([]);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [inStack, setInStack] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        fetchSavedProducts(data.user.id);
        fetchUserStack(data.user.id);
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

  const fetchUserStack = async (uid: string) => {
    const stack = await getUserStack(uid);
    if (id) {
      const isAdded = stack.some(item => item.product_id === id);
      setInStack(isAdded);
    }
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
      setInStack(true);
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
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.text }]}>Product not found.</Text>
        <PremiumButton title="Go Back" onPress={() => router.back()} style={{ width: 120 }} />
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

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Spatial Hero Surface */}
        <LinearGradient
          colors={colorScheme === 'dark' ? ['#1A2518', '#111111'] : ['#F0FDF4', '#FFFFFF']}
          style={[styles.heroSurface, { paddingTop: insets.top + 12 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.heroHeaderOverlay}>
            <Pressable style={styles.iconButtonContainer} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={themeColors.text} />
            </Pressable>

            <View style={styles.headerRight}>
              <Pressable style={[styles.iconButtonContainer, { marginRight: 8 }]} onPress={() => router.push(`/assistant?type=product&productId=${id}`)}>
                <Ionicons name="sparkles" size={20} color={themeColors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroImageWrapper}>
            {getProductImageFallback(product.image_url) ? (
              <Image
                source={{ uri: getProductImageFallback(product.image_url)! }}
                style={styles.heroImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons name="flask-outline" size={64} color={themeColors.textMuted} />
              </View>
            )}
          </View>

          <View style={styles.titleSection}>
            <Text style={[styles.brandName, { color: themeColors.textSecondary }]}>
              {formatBrandName(product.brands?.name || product.brand) || "Elexir Curated"}
            </Text>
            <Text style={[styles.productName, { color: themeColors.text }]}>
              {formatProductName(product.name)}
            </Text>
            {shouldDisplayField(formatCategory(product.category)) && (
              <Text style={[styles.categoryText, { color: themeColors.textSecondary }]}>
                {formatCategory(product.category)}
              </Text>
            )}
          </View>
        </LinearGradient>

        {/* Elexir Score Diagnostic Report - Clean Supporting Surface */}
        <View style={styles.section}>
          <View style={styles.scoreHeader}>
            <View>
              <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary }]}>DIAGNOSTIC SIGNAL</Text>
              <Text style={[styles.scoreSubtitle, { color: themeColors.textMuted }]}>Clinical quality index</Text>
            </View>
            <Text style={[styles.scoreValue, { color: themeColors.text }]}>
              {elexir.score}
            </Text>
          </View>

          <View style={styles.scoreBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>Transparency</Text>
              <Text style={[styles.breakdownValue, { color: themeColors.text }]}>{elexir.breakdown.transparency}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>Ingredients</Text>
              <Text style={[styles.breakdownValue, { color: themeColors.text }]}>{elexir.breakdown.ingredients}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>Quality</Text>
              <Text style={[styles.breakdownValue, { color: themeColors.text }]}>{elexir.breakdown.quality}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>Goal Relevance</Text>
              <Text style={[styles.breakdownValue, { color: themeColors.text }]}>{elexir.breakdown.goalRelevance}</Text>
            </View>
          </View>

          {elexir.pros.length > 0 && (
            <View style={[styles.scoreList, { marginTop: 32 }]}>
              <Text style={[styles.thingsToKnowTitle, { color: themeColors.textSecondary }]}>CLINICAL STRENGTHS</Text>
              {elexir.pros.map((pro, idx) => (
                <View key={`pro-${idx}`} style={styles.bulletRow}>
                  <Ionicons name="checkmark" size={18} color={themeColors.success} style={{ marginRight: 12, marginTop: 2 }} />
                  <Text style={[styles.scoreItem, { color: themeColors.text }]}>{pro}</Text>
                </View>
              ))}
            </View>
          )}

          {elexir.thingsToKnow.length > 0 && (
            <View style={[styles.scoreList, { marginTop: 24 }]}>
              <Text style={[styles.thingsToKnowTitle, { color: themeColors.textSecondary }]}>CONSIDERATIONS</Text>
              {elexir.thingsToKnow.map((ttk, idx) => (
                <View key={`ttk-${idx}`} style={styles.bulletRow}>
                  <Ionicons name="remove" size={18} color={themeColors.textMuted} style={{ marginRight: 12, marginTop: 2 }} />
                  <Text style={[styles.scoreItemNeutral, { color: themeColors.textSecondary }]}>{ttk}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Why It Matches You */}
        {match.score > 0 && (
          <View style={styles.section}>
            <View style={styles.matchCardHeader}>
              <Ionicons name="sparkles" size={16} color={themeColors.text} style={{ marginRight: 8 }} />
              <Text style={[styles.matchBadgeTextDetail, { color: themeColors.text }]}>
                {match.label} Synergy
              </Text>
            </View>
            <Text style={[styles.bodyText, { color: themeColors.text, marginBottom: 16 }]}>
              {generateWhyItMatches(match.matchedGoals)}
            </Text>
            <View style={styles.matchList}>
              {match.matchedGoals.map(g => {
                const label = formatGoalLabel(g);
                if (!label) return null;
                return (
                  <View key={g} style={styles.matchRow}>
                    <Ionicons name="analytics" size={16} color={themeColors.textSecondary} style={{ marginRight: 10 }} />
                    <Text style={[styles.matchText, { color: themeColors.textSecondary }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Summary & Intro Text */}
        <View style={styles.section}>
          <Text style={[styles.bodyTextLarge, { color: themeColors.textSecondary }]}>
            {product.source === "elexir_curated" && product.raw_data?.description
              ? product.raw_data.description
              : introText}
          </Text>
        </View>

        {/* What's Inside - Ingredients Table */}
        {shouldDisplayField(ingredients) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 16 }]}>FORMULATION</Text>
            <View style={styles.ingredientsList}>
              {ingredients.map((pi, idx) => {
                const ingName = formatIngredientName(pi.ingredient?.name);
                if (!ingName) return null;
                return (
                  <View key={pi.id} style={styles.ingredientRow}>
                    <View style={styles.ingredientMain}>
                      <Text style={[styles.ingredientName, { color: themeColors.text }]}>{ingName}</Text>
                      {pi.amount && (
                        <Text style={[styles.ingredientAmount, { color: themeColors.text }]}>
                          {pi.amount}{pi.unit || ""}
                        </Text>
                      )}
                    </View>
                    {shouldDisplayField(pi.form) && (
                      <Text style={[styles.ingredientForm, { color: themeColors.textSecondary }]}>{pi.form}</Text>
                    )}
                    {shouldDisplayField(pi.ingredient?.description) && (
                      <Text style={[styles.ingredientDesc, { color: themeColors.textMuted }]}>
                        {pi.ingredient!.description}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {Array.from(foundAllergies).map(allergy => (
              <View key={`allergy-${allergy}`} style={styles.allergyNotice}>
                <Ionicons name="warning" size={16} color={themeColors.warning} style={{ marginRight: 12, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.allergyNoticeText, { color: themeColors.text }]}>
                    Contains possible {allergy}-derived ingredients.
                  </Text>
                  <Text style={[styles.allergyNoticeSub, { color: themeColors.textSecondary }]}>
                    Matches your listed allergen avoidance filters.
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quality & Transparency Specs */}
        {shouldDisplayField(attributes) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 16 }]}>QUALITY VERIFICATIONS</Text>
            <View style={styles.specList}>
              {isDietMatch && (
                <View style={styles.specRow}>
                  <Ionicons name="shield-checkmark" size={18} color={themeColors.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.specText, { color: themeColors.textSecondary }]}>Matches your diet type</Text>
                </View>
              )}
              {attributes.map(a => {
                const label = formatQualityAttribute(a);
                if (!label) return null;
                return (
                  <View key={a} style={styles.specRow}>
                    <Ionicons name="shield-checkmark" size={18} color={themeColors.text} style={{ marginRight: 12 }} />
                    <Text style={[styles.specText, { color: themeColors.textSecondary }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* How To Use */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 16 }]}>SUGGESTED PROTOCOL</Text>
          <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>
            {product.source === "elexir_curated" && product.raw_data?.suggested_use
              ? product.raw_data.suggested_use
              : "1 capsule daily with water, preferably taken during mornings or as guided by your health professional."}
          </Text>
        </View>

        {/* Safety Disclaimer */}
        <View style={styles.section}>
          <Text style={[styles.safetyText, { color: themeColors.textMuted }]}>
            Educational information only. Consult with a healthcare professional regarding dosages, drug interactions, or personal clinical conditions.
          </Text>
        </View>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <View style={[styles.section, { paddingBottom: 160, paddingTop: 32 }]}>
            <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 24 }]}>YOU MAY ALSO BENEFIT FROM...</Text>
            {similarProducts.map(p => {
              const pGoals = p.product_goals?.length ? p.product_goals.map(g => g.goal) : (p.inferred_goals || []);
              const pMatch = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, pGoals);
              return (
                <View key={p.id} style={{ marginBottom: 12 }}>
                  <ProductCompareRow
                    product={p}
                    match={pMatch}
                    onPress={() => router.push(`/product/${p.id}`)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom CTA with OS Action Glassmorphism */}
      <View style={styles.bottomCTAWrap}>
        <View
          style={[
            styles.bottomCTAContainer,
            { paddingBottom: insets.bottom || 24, backgroundColor: colorScheme === 'dark' ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)' }
          ]}
        >
          <View style={styles.ctaRow}>
            <Pressable 
              style={[styles.premiumIconBtn, { backgroundColor: themeColors.backgroundSecondary }]}
              onPress={toggleSave}
            >
              <Ionicons name={isSaved ? "heart" : "heart-outline"} size={22} color={themeColors.text} />
            </Pressable>
            <Pressable 
              style={[
                styles.premiumPrimaryBtn, 
                { backgroundColor: themeColors.text },
                inStack && { backgroundColor: themeColors.border }
              ]} 
              onPress={inStack ? undefined : promptStack}
            >
              <Text style={[styles.premiumPrimaryBtnText, { color: themeColors.background }]}>
                {inStack ? "Active in Stack" : "Add to Protocol"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 18, marginBottom: 16 },

  scrollContent: {
    paddingTop: 0,
  },

  heroSurface: {
    paddingBottom: 56,
    marginBottom: 40,
  },
  heroHeaderOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
    zIndex: 10,
  },
  headerRight: { flexDirection: "row" },
  iconButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'rgba(0,0,0,0.03)',
  },

  heroImageWrapper: {
    height: 340,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  heroImage: {
    width: "80%",
    height: "90%",
    ...Shadows.floating,
  },
  placeholderContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  titleSection: {
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 24,
  },
  brandName: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 12
  },
  productName: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginBottom: 12,
    lineHeight: 40,
    textAlign: "center"
  },
  categoryText: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  section: {
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  sectionTitlePrimary: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 32,
  },
  scoreSubtitle: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  scoreValue: { fontSize: 56, fontWeight: "300", letterSpacing: -2, lineHeight: 60 },

  scoreBreakdown: { gap: 16 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: 15, fontWeight: "500" },
  breakdownValue: { fontSize: 16, fontWeight: "700" },

  scoreList: { gap: 16 },
  thingsToKnowTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start" },
  scoreItem: { fontSize: 15, fontWeight: "500", flex: 1, lineHeight: 22 },
  scoreItemNeutral: { fontSize: 15, fontWeight: "500", flex: 1, lineHeight: 22 },

  matchCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  matchBadgeTextDetail: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  matchList: { gap: 12 },
  bodyText: { fontSize: 16, lineHeight: 26, fontWeight: "400" },
  bodyTextLarge: { fontSize: 18, lineHeight: 28, fontWeight: "400", textAlign: "center" },

  matchRow: { flexDirection: "row", alignItems: "center" },
  matchText: { fontSize: 16, fontWeight: "500", textTransform: "capitalize" },

  ingredientsList: {
    marginTop: 8,
  },
  ingredientRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ingredientMain: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  ingredientName: { fontSize: 17, fontWeight: "700", flex: 1, marginRight: 16 },
  ingredientAmount: { fontSize: 17, fontWeight: "700" },
  ingredientForm: { fontSize: 14, marginBottom: 8, fontWeight: "500" },
  ingredientDesc: { fontSize: 14, lineHeight: 22 },

  allergyNotice: {
    flexDirection: "row",
    padding: 20,
    borderRadius: BorderRadii.xl,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginTop: 24,
  },
  allergyNoticeText: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  allergyNoticeSub: {
    fontSize: 14,
    lineHeight: 20,
  },

  specList: {
    marginTop: 8,
  },
  specRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  specText: { fontSize: 16, fontWeight: "500" },

  safetyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  bottomCTAWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomCTAContainer: {
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  ctaRow: {
    flexDirection: "row",
    gap: 16,
  },
  premiumIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumPrimaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumPrimaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
