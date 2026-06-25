import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// TODO: restrict this route to admin users only before production.

const ALLOWED_CATEGORIES = [
  "magnesium",
  "vitamin_d",
  "creatine",
  "probiotic",
  "omega_3",
  "protein",
  "adaptogen",
  "electrolytes",
  "multivitamin",
  "vitamin_c",
  "vitamin_b",
  "minerals",
  "amino_acids",
  "fiber",
  "sleep_support",
  "hydration",
  "greens",
  "collagen"
];

const ALLOWED_GOALS = [
  "sleep",
  "stress",
  "energy",
  "focus",
  "recovery",
  "gut_health",
  "immunity",
  "longevity",
  "hydration",
  "performance"
];

const ALLOWED_SUPPORT_STRENGTHS = ["low", "medium", "high"];
const ALLOWED_EVIDENCE_LEVELS = ["weak", "moderate", "strong"];
const ALLOWED_BEST_TIMES = ["morning", "afternoon", "evening", "anytime"];
const ALLOWED_VERIFIED_STATUSES = ["draft", "unverified", "verified"];

interface ActiveIngredient {
  name: string;
  amount: string;
  unit: string;
  form: string;
}

interface IngestProduct {
  name: string;
  brand: string;
  category: string;
  product_url: string;
  image_url: string;
  serving_size: string;
  servings_per_container: number | null;
  ingredients_text: string;
  supplement_facts: {
    active_ingredients: ActiveIngredient[];
  };
  claims: string[];
  vegan: boolean | null;
  gluten_free: boolean | null;
  dairy_free: boolean | null;
  short_summary: string;
  data_quality_score: number;
  verified_status: string;
  source: string;
}

interface IngestProductGoal {
  goal: string;
  support_strength: string;
  evidence_level: string;
  best_time: string;
  notes: string;
}

interface IngestJSON {
  product?: IngestProduct;
  product_goals?: IngestProductGoal[];
}

export default function IngestScreen() {
  const router = useRouter();
  
  // State
  const [jsonText, setJsonText] = useState("");
  const [parsedData, setParsedData] = useState<IngestJSON | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // JSON Parser and Validator
  const handleParse = () => {
    setValidationErrors([]);
    setDuplicateWarning(null);
    setSaveError(null);
    setSaveSuccessId(null);
    setParsedData(null);

    if (!jsonText.trim()) {
      setValidationErrors(["Please paste JSON content first."]);
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      setValidationErrors([`Invalid JSON syntax: ${e.message}`]);
      return;
    }

    const errors: string[] = [];

    // Check high level structure
    if (!parsed.product) {
      errors.push("Missing root 'product' object.");
    }
    if (!parsed.product_goals || !Array.isArray(parsed.product_goals)) {
      errors.push("Missing or invalid root 'product_goals' array.");
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const prod: IngestProduct = parsed.product;
    const goals: IngestProductGoal[] = parsed.product_goals;

    // Validate Product Required Fields
    if (!prod.name || typeof prod.name !== "string" || !prod.name.trim()) {
      errors.push("product.name is required and must be a non-empty string.");
    }
    if (!prod.brand || typeof prod.brand !== "string" || !prod.brand.trim()) {
      errors.push("product.brand is required and must be a non-empty string.");
    }
    if (!prod.product_url || typeof prod.product_url !== "string" || !prod.product_url.trim()) {
      errors.push("product.product_url is required and must be a non-empty string.");
    }

    // Validate Category
    if (!prod.category) {
      errors.push("product.category is missing.");
    } else if (!ALLOWED_CATEGORIES.includes(prod.category.toLowerCase())) {
      errors.push(`product.category "${prod.category}" is not in the canonical list.`);
    }

    // Validate Enums
    if (prod.verified_status && !ALLOWED_VERIFIED_STATUSES.includes(prod.verified_status.toLowerCase())) {
      errors.push(`product.verified_status "${prod.verified_status}" must be one of: ${ALLOWED_VERIFIED_STATUSES.join(", ")}`);
    }
    if (prod.source && prod.source !== "curated") {
      errors.push(`product.source "${prod.source}" must be "curated".`);
    }

    // Validate Product Goals
    goals.forEach((g, index) => {
      const prefix = `product_goals[${index}]`;
      if (!g.goal) {
        errors.push(`${prefix}.goal is missing.`);
      } else if (!ALLOWED_GOALS.includes(g.goal.toLowerCase())) {
        errors.push(`${prefix}.goal "${g.goal}" is not in the canonical list.`);
      }

      if (g.support_strength && !ALLOWED_SUPPORT_STRENGTHS.includes(g.support_strength.toLowerCase())) {
        errors.push(`${prefix}.support_strength "${g.support_strength}" must be one of: ${ALLOWED_SUPPORT_STRENGTHS.join(", ")}`);
      }

      if (g.evidence_level && !ALLOWED_EVIDENCE_LEVELS.includes(g.evidence_level.toLowerCase())) {
        errors.push(`${prefix}.evidence_level "${g.evidence_level}" must be one of: ${ALLOWED_EVIDENCE_LEVELS.join(", ")}`);
      }

      if (g.best_time && !ALLOWED_BEST_TIMES.includes(g.best_time.toLowerCase())) {
        errors.push(`${prefix}.best_time "${g.best_time}" must be one of: ${ALLOWED_BEST_TIMES.join(", ")}`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
    } else {
      setParsedData(parsed);
      // Asynchronous check for existing product URL to show warning early
      checkDuplicateUrl(prod.product_url);
    }
  };

  const checkDuplicateUrl = async (url: string) => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("product_url", url)
        .maybeSingle();

      if (!error && data) {
        setDuplicateWarning(`Product already exists: "${data.name}" (ID: ${data.id}) uses this product_url.`);
      }
    } catch (e) {
      console.warn("Failed to check duplicate URL", e);
    }
  };

  // Save to Supabase
  const handleSave = async () => {
    if (!parsedData || !parsedData.product) return;

    setLoading(true);
    setSaveError(null);
    setSaveSuccessId(null);

    const { product: prod, product_goals: goals } = parsedData;

    try {
      // 1. Double check duplicate product_url
      const { data: existingProduct, error: dupError } = await supabase
        .from("products")
        .select("id")
        .eq("product_url", prod.product_url)
        .maybeSingle();

      if (dupError) throw new Error(`Error checking duplicate URL: ${dupError.message}`);
      
      if (existingProduct) {
        setSaveError("Product already exists. Ingest blocked to prevent duplicates.");
        setLoading(false);
        return;
      }

      // 2. Get or Create Brand
      let brandId: string | null = null;
      const { data: brandData, error: brandFetchError } = await supabase
        .from("brands")
        .select("id")
        .ilike("name", prod.brand)
        .maybeSingle();

      if (brandFetchError) throw new Error(`Error fetching brand: ${brandFetchError.message}`);

      if (brandData) {
        brandId = brandData.id;
      } else {
        const { data: newBrand, error: newBrandError } = await supabase
          .from("brands")
          .insert({ name: prod.brand })
          .select("id")
          .single();

        if (newBrandError) throw new Error(`Error creating brand: ${newBrandError.message}`);
        brandId = newBrand.id;
      }

      // 3. Prepare raw_data
      const rawData = {
        short_summary: prod.short_summary,
        supplement_facts: prod.supplement_facts,
        claims: prod.claims,
        dietary_tags: {
          vegan: prod.vegan,
          gluten_free: prod.gluten_free,
          dairy_free: prod.dairy_free,
        },
        original_json: parsedData,
      };

      // 4. Insert Product
      const { data: insertedProduct, error: productInsertError } = await supabase
        .from("products")
        .insert({
          name: prod.name,
          brand: prod.brand,
          brand_id: brandId,
          category: prod.category.toLowerCase(),
          product_url: prod.product_url,
          image_url: prod.image_url || null,
          serving_size: prod.serving_size || null,
          servings_per_container: prod.servings_per_container || null,
          ingredients_text: prod.ingredients_text || null,
          vegan: prod.vegan ?? null,
          gluten_free: prod.gluten_free ?? null,
          dairy_free: prod.dairy_free ?? null,
          claims: prod.claims || [],
          data_quality_score: prod.data_quality_score || 0,
          verified_status: "draft", // Always default to draft for ingestion
          source: "curated", // Every product marked as curated
          raw_data: rawData,
        })
        .select("id")
        .single();

      if (productInsertError) throw new Error(`Product insert failed: ${productInsertError.message}`);
      const newProductId = insertedProduct.id;

      // 5. Insert associated goals
      if (goals && goals.length > 0) {
        const goalsToInsert = goals.map((g) => ({
          product_id: newProductId,
          goal: g.goal.toLowerCase(),
          support_strength: g.support_strength ? g.support_strength.toLowerCase() : null,
          evidence_level: g.evidence_level ? g.evidence_level.toLowerCase() : null,
          best_time: g.best_time ? g.best_time.toLowerCase() : null,
          notes: g.notes || null,
        }));

        const { error: goalsError } = await supabase
          .from("product_goals")
          .insert(goalsToInsert);

        if (goalsError) {
          throw new Error(`Product saved successfully (ID: ${newProductId}) but saving goals failed: ${goalsError.message}`);
        }
      }

      setSaveSuccessId(newProductId);
      // Reset parser state
      setParsedData(null);
      setJsonText("");
    } catch (e: any) {
      setSaveError(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Product Ingest</Text>
            <Text style={styles.headerSubtitle}>
              Paste AI-generated supplement JSON and save it to Elexir.
            </Text>
          </View>
        </View>

        {/* Input Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Supplement JSON</Text>
          <TextInput
            style={styles.jsonInput}
            multiline
            numberOfLines={15}
            placeholder="Paste JSON here..."
            placeholderTextColor="#8E8E93"
            value={jsonText}
            onChangeText={setJsonText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.button} onPress={handleParse}>
            <Text style={styles.buttonText}>Parse & Validate JSON</Text>
          </Pressable>
        </View>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>✗ Validation Failed</Text>
            {validationErrors.map((err, idx) => (
              <Text key={idx} style={styles.errorText}>
                • {err}
              </Text>
            ))}
          </View>
        )}

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <View style={[styles.card, styles.warningCard]}>
            <Text style={styles.warningTitle}>⚠ Duplicate Check</Text>
            <Text style={styles.warningText}>{duplicateWarning}</Text>
          </View>
        )}

        {/* Save Status - Success */}
        {saveSuccessId && (
          <View style={[styles.card, styles.successCard]}>
            <Text style={styles.successTitle}>✓ Product Saved Successfully!</Text>
            <Text style={styles.successText}>Inserted Product ID: {saveSuccessId}</Text>
          </View>
        )}

        {/* Save Status - Error */}
        {saveError && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>✗ Database Error</Text>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {/* Data Preview */}
        {parsedData && parsedData.product && (
          <View style={styles.previewContainer}>
            <Text style={styles.sectionHeader}>Ingest Preview</Text>

            {/* Product Metadata */}
            <View style={styles.card}>
              <Text style={styles.previewHeader}>Product Details</Text>
              
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Name:</Text>
                <Text style={styles.previewValue}>{parsedData.product.name}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Brand:</Text>
                <Text style={styles.previewValue}>{parsedData.product.brand}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Category:</Text>
                <Text style={styles.previewValue}>{parsedData.product.category}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Product URL:</Text>
                <Text style={styles.previewValue}>{parsedData.product.product_url}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Image URL:</Text>
                <Text style={styles.previewValue} numberOfLines={1}>
                  {parsedData.product.image_url || "None"}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Serving Size:</Text>
                <Text style={styles.previewValue}>{parsedData.product.serving_size || "None"}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Servings/Container:</Text>
                <Text style={styles.previewValue}>
                  {parsedData.product.servings_per_container ?? "None"}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Summary:</Text>
                <Text style={styles.previewValue}>{parsedData.product.short_summary}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Vegan/GF/DF:</Text>
                <Text style={styles.previewValue}>
                  Vegan: {parsedData.product.vegan === null ? "null" : String(parsedData.product.vegan)} |{" "}
                  GF: {parsedData.product.gluten_free === null ? "null" : String(parsedData.product.gluten_free)} |{" "}
                  DF: {parsedData.product.dairy_free === null ? "null" : String(parsedData.product.dairy_free)}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Claims:</Text>
                <Text style={styles.previewValue}>
                  {parsedData.product.claims?.join(", ") || "None"}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Ingredients Text:</Text>
                <Text style={styles.previewValue}>{parsedData.product.ingredients_text || "None"}</Text>
              </View>
            </View>

            {/* Active Ingredients facts */}
            {parsedData.product.supplement_facts?.active_ingredients?.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.previewHeader}>Supplement Facts (Ingredients)</Text>
                {parsedData.product.supplement_facts.active_ingredients.map((ing, idx) => (
                  <View key={idx} style={styles.ingredientRow}>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    <Text style={styles.ingredientAmount}>
                      {ing.amount} {ing.unit} {ing.form ? `(${ing.form})` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Goals details */}
            {parsedData.product_goals && parsedData.product_goals.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.previewHeader}>Product Goals</Text>
                {parsedData.product_goals.map((g, idx) => (
                  <View key={idx} style={styles.goalPreviewItem}>
                    <View style={styles.goalHeaderRow}>
                      <Text style={styles.goalName}>{g.goal}</Text>
                      <View style={styles.badgeRow}>
                        {g.support_strength && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Strength: {g.support_strength}</Text>
                          </View>
                        )}
                        {g.evidence_level && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Evidence: {g.evidence_level}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {g.best_time && (
                      <Text style={styles.goalSubtext}>Best Time: {g.best_time}</Text>
                    )}
                    {g.notes && <Text style={styles.goalNotes}>{g.notes}</Text>}
                  </View>
                ))}
              </View>
            )}

            {/* Action Bar */}
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && { opacity: 0.8 },
                (loading || !!duplicateWarning) && { backgroundColor: "#8E8E93" },
              ]}
              onPress={handleSave}
              disabled={loading || !!duplicateWarning}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {duplicateWarning ? "Cannot Save (Duplicate URL)" : "Save Product to Elexir"}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 16,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBEAE4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    marginTop: 4,
  },
  backBtnText: { fontSize: 20, color: "#1C1C1E" },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#1C1C1E" },
  headerSubtitle: { fontSize: 14, color: "#636366", marginTop: 4 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1C1C1E", marginBottom: 12 },
  jsonInput: {
    backgroundColor: "#FAF9F6",
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Courier",
    fontSize: 13,
    color: "#1C1C1E",
    minHeight: 250,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  errorCard: {
    backgroundColor: "#FFE5E5",
    borderColor: "#FFB2B2",
    borderWidth: 1,
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: "#D32F2F", marginBottom: 8 },
  errorText: { fontSize: 13, color: "#C62828", marginBottom: 4 },
  warningCard: {
    backgroundColor: "#FFF3CD",
    borderColor: "#FFEEBA",
    borderWidth: 1,
  },
  warningTitle: { fontSize: 15, fontWeight: "700", color: "#856404", marginBottom: 8 },
  warningText: { fontSize: 13, color: "#856404" },
  successCard: {
    backgroundColor: "#E8F5E9",
    borderColor: "#C8E6C9",
    borderWidth: 1,
  },
  successTitle: { fontSize: 15, fontWeight: "700", color: "#2E7D32", marginBottom: 8 },
  successText: { fontSize: 13, color: "#1B5E20" },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 8,
    marginBottom: 16,
  },
  previewContainer: { marginTop: 8 },
  previewHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    paddingBottom: 8,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  previewLabel: {
    width: 140,
    fontSize: 13,
    fontWeight: "600",
    color: "#636366",
  },
  previewValue: {
    flex: 1,
    fontSize: 13,
    color: "#1C1C1E",
  },
  ingredientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  ingredientName: { fontSize: 13, color: "#1C1C1E", fontWeight: "500" },
  ingredientAmount: { fontSize: 13, color: "#636366" },
  goalPreviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  goalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalName: { fontSize: 14, fontWeight: "600", color: "#1C1C1E", textTransform: "capitalize" },
  badgeRow: { flexDirection: "row" },
  badge: {
    backgroundColor: "#FAF9F6",
    borderColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  badgeText: { fontSize: 10, color: "#636366", textTransform: "capitalize" },
  goalSubtext: { fontSize: 12, color: "#636366", marginTop: 2, textTransform: "capitalize" },
  goalNotes: { fontSize: 12, color: "#1C1C1E", marginTop: 4, fontStyle: "italic" },
  saveButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  saveButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
