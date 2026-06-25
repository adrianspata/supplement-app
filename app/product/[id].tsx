import { Ionicons } from "@expo/vector-icons";
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
  View,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch, generateWhyItMatches } from "../../lib/matching";
import { formatBrandName, formatCategory, formatGoalLabel, formatIngredientName, formatProductName, formatQualityAttribute, getProductImageFallback, shouldDisplayField } from "../../lib/productDisplay";
import { getProductById, getSavedProducts, getSimilarProducts, markProductAsViewed, saveProduct, unsaveProduct } from "../../lib/products";
import { calculateElexirScore } from "../../lib/scoring";
import { addProductToStack, getUserStack } from "../../lib/stack";
import { supabase } from "../../lib/supabase";
import { Product, StackTiming, UserSavedProduct } from "../../lib/types";
import { ProductCompareRow } from "../../src/components/ProductCompareRow";
import { PremiumButton } from "../../src/components/ui/PremiumButton";
import { SurfaceCard } from "../../src/components/ui/SurfaceCard";
import { ScoreBreakdownCard } from "../../src/components/ScoreBreakdownCard";
import { ProductProsConsCard } from "../../src/components/ProductProsConsCard";
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
  const [stackModalVisible, setStackModalVisible] = useState(false);
  const [stackTiming, setStackTiming] = useState<StackTiming>('morning');
  const [stackDosage, setStackDosage] = useState("");
  const [stackFrequency, setStackFrequency] = useState("Daily");
  const [isSavingStack, setIsSavingStack] = useState(false);

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

  const handleSaveStack = async () => {
    if (!userId || !product) return;
    setIsSavingStack(true);
    try {
      await addProductToStack(userId, product.id, stackTiming, stackDosage || null, stackFrequency || 'Daily', null);
      setInStack(true);
      setStackModalVisible(false);
      Alert.alert("Added to Stack", `This product has been added to your ${stackTiming.replace("_", " ")} routine.`);
    } catch (error: any) {
      if (error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('duplicate key')) {
        Alert.alert("Already in Stack", `This product is already in your ${stackTiming.replace("_", " ")} routine.`);
        setStackModalVisible(false);
      } else {
        console.error("Error adding to stack:", error);
        Alert.alert("Error", "Could not add to stack.");
      }
    } finally {
      setIsSavingStack(false);
    }
  };

  const promptStack = () => {
    if (!userId) {
      Alert.alert("Please sign in", "You must be signed in to build a stack.");
      return;
    }
    if (userPreferences?.reminder_time && ['morning', 'afternoon', 'evening'].includes(userPreferences.reminder_time)) {
      setStackTiming(userPreferences.reminder_time as StackTiming);
    }
    setStackModalVisible(true);
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

  let ingredients = product.product_ingredients || [];
  
  if (ingredients.length === 0 && (product.raw_data?.supplement_facts?.active_ingredients || product.supplement_facts?.active_ingredients)) {
    const rawIngs = product.raw_data?.supplement_facts?.active_ingredients || product.supplement_facts?.active_ingredients;
    if (Array.isArray(rawIngs)) {
      ingredients = rawIngs.map((ing: any, idx: number) => ({
        id: `raw-${idx}`,
        product_id: product.id,
        ingredient_id: `raw-ing-${idx}`,
        amount: ing.amount,
        unit: ing.unit || "",
        form: ing.form || null,
        created_at: new Date().toISOString(),
        ingredient: {
          id: `raw-ing-${idx}`,
          name: ing.name,
          created_at: new Date().toISOString(),
        }
      })) as any[];
    }
  }

  const productGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : (product.inferred_goals || []);
  const attributes = product.product_quality_attributes?.map(a => a.attribute) || [];

  const addAttr = (attr: string) => { if (!attributes.includes(attr)) attributes.push(attr); };
  if (product.vegan) addAttr("vegan");
  if (product.gluten_free) addAttr("gluten_free");
  if (product.dairy_free) addAttr("dairy_free");

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
              {formatBrandName(product.brands?.name || product.brand) || "Basis Curated"}
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
            {product.raw_data?.short_summary || introText}
          </Text>
        </View>

        {/* Clinical Quality Index (CQI) */}
        <View style={styles.section}>
          <ScoreBreakdownCard scoreResult={elexir} />
          <ProductProsConsCard pros={elexir.pros} cons={elexir.thingsToKnow} />
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
          <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 16 }]}>SUGGESTED PLAN</Text>
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
                {inStack ? "Active in Stack" : "Add to Plan"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={stackModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStackModalVisible(false)}
      >
        <View style={[styles.modalSafeArea, { backgroundColor: themeColors.background, flex: 1 }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.borderMuted }]}>
              <Pressable onPress={() => setStackModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add to Plan</Text>
              <Pressable onPress={handleSaveStack} disabled={isSavingStack} style={styles.modalSaveBtn}>
                {isSavingStack ? (
                  <ActivityIndicator color={themeColors.text} size="small" />
                ) : (
                  <Text style={[styles.modalSaveText, { color: themeColors.text, fontWeight: "700" }]}>Save</Text>
                )}
              </Pressable>
            </View>
            
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Timing *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={styles.quickChips}>
                    {(['morning', 'afternoon', 'evening', 'as_needed'] as StackTiming[]).map(t => (
                      <Pressable 
                        key={t} 
                        style={[
                          styles.quickChip, 
                          { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border },
                          stackTiming === t && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                        ]}
                        onPress={() => setStackTiming(t)}
                      >
                        <Text 
                          style={[
                            styles.quickChipText, 
                            { color: themeColors.textSecondary },
                            stackTiming === t && { color: themeColors.background }
                          ]}
                        >
                          {t.replace('_', ' ')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Dosage (Optional)</Text>
                <TextInput 
                  style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="e.g. 2 capsules"
                  placeholderTextColor={themeColors.textMuted}
                  value={stackDosage}
                  onChangeText={setStackDosage}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Frequency (Optional)</Text>
                <TextInput 
                  style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                  placeholder="e.g. Daily, Weekly"
                  placeholderTextColor={themeColors.textMuted}
                  value={stackFrequency}
                  onChangeText={setStackFrequency}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
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
  modalSafeArea: { paddingBottom: 24 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancelBtn: { width: 60 },
  modalCancelText: { fontSize: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalSaveBtn: { width: 60, alignItems: "flex-end" },
  modalSaveText: { fontSize: 16 },
  modalScroll: { padding: 24, paddingBottom: 100 },
  formGroup: { marginBottom: 24 },
  formLabel: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  formInput: {
    borderWidth: 1,
    borderRadius: BorderRadii.md,
    padding: 16,
    fontSize: 16,
  },
  quickChips: { flexDirection: "row", gap: 8 },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
});
