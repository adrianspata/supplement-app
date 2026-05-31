import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import {
  CabinetItem,
  CabinetItemInput,
  Product,
  RecentlyViewedProduct,
  RecommendedProduct,
  UserSavedProduct,
} from "../../lib/types";
import {
  getRecentlyViewedProducts,
  getRecommendedProducts,
  getSavedProducts,
} from "../../lib/products";
import { getUserStack, getLogsForDateRange } from "../../lib/stack";
import { getCheckInsForDateRange } from "../../lib/checkins";
import { generateStackInsights, StackInsightsResult } from "../../lib/insights";
import { computeTrendsAndReflection, WeeklyReflectionData } from "../../lib/trends";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch } from "../../lib/matching";
import { formatExpiry, isExpired, isExpiringSoon } from "../../lib/expiry";
import {
  formatCategory,
  formatProductName,
  formatBrandName,
  getProductImageFallback,
} from "../../lib/productDisplay";
import { DailyInsightCard } from "../../src/components/DailyInsightCard";
import { WeeklyReflection } from "../../src/components/WeeklyReflection";
import { GoalProgressCard } from "../../src/components/GoalProgressCard";
import { HealthHistoryCard } from "../../src/components/HealthHistoryCard";
import { TodayCheckInCard } from "../../src/components/TodayCheckInCard";
import { ProductRow } from "../../src/components/ProductRow";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { PremiumButton } from "../../src/components/ui/PremiumButton";
import { Colors, Spacing, BorderRadii, Shadows, Typography } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = ["Supplements", "Vitamins", "Minerals", "Herbs", "Other"];
const UNITS = ["capsules", "tablets", "g", "mg", "ml", "drops", "gummies", "servings"];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Supplements: "flask-outline",
  Vitamins: "sunny-outline",
  Minerals: "shield-checkmark-outline",
  Herbs: "leaf-outline",
  Other: "cube-outline",
};

const FILTERS = ["All", "sleep", "energy", "stress", "focus", "recovery"];

function emptyForm(): CabinetItemInput {
  return {
    name: "",
    brand: null,
    quantity: null,
    unit: null,
    category: null,
    expiry_date: null,
    notes: null,
  };
}

export default function PantryScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const { userPreferences } = useAuth();
  
  const [items, setItems] = useState<CabinetItem[]>([]);
  const [savedProducts, setSavedProducts] = useState<UserSavedProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [stackInsights, setStackInsights] = useState<StackInsightsResult | null>(null);
  const [reflection, setReflection] = useState<WeeklyReflectionData | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeStack, setActiveStack] = useState<any[]>([]);

  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CabinetItem | null>(null);
  const [form, setForm] = useState<CabinetItemInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
        supabase.from("profiles").select("*").eq("id", data.user.id).single().then(p => {
          if (p.data) setProfile(p.data);
        });
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchItems();
    }, [userId])
  );

  const fetchItems = useCallback(async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const [pantryRes, savedRes, viewedRes, recRes, stackRes, logs30dRes, checkinsRes] = await Promise.all([
      supabase.from("pantry_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      getSavedProducts(userId),
      getRecentlyViewedProducts(userId),
      getRecommendedProducts(userId, userPreferences?.primary_goals || [], userPreferences?.health_concerns || [], userPreferences?.existing_supplements || [], userPreferences?.diet_type),
      getUserStack(userId),
      getLogsForDateRange(userId, thirtyDaysAgoStr, todayStr),
      getCheckInsForDateRange(userId, thirtyDaysAgoStr, todayStr)
    ]);

    if (!pantryRes.error && pantryRes.data) {
      setItems(pantryRes.data as CabinetItem[]);
    }
    setSavedProducts(savedRes);
    setRecentlyViewed(viewedRes);
    setRecommendedProducts(recRes.slice(0, 3));

    // Stack calculations for insights
    const activeStackData = stackRes || [];
    setActiveStack(activeStackData);
    const weeklyLogs = logs30dRes.filter(l => l.log_date >= sevenDaysAgoStr);
    const insights = generateStackInsights(userPreferences as any, activeStackData, weeklyLogs);
    setStackInsights(insights);

    // Weekly reflection data
    const weeklyReflection = computeTrendsAndReflection(checkinsRes || [], logs30dRes || [], activeStackData);
    setReflection(weeklyReflection);

    setLoading(false);
    setRefreshing(false);
  }, [userId, userPreferences]);

  const handleEdit = (item: CabinetItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      brand: item.brand,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      expiry_date: item.expiry_date,
      notes: item.notes,
    });
    setFormError("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!userId) return;

    setSaving(true);
    setFormError("");

    let error = null;
    if (editingItem) {
      const { error: err } = await supabase
        .from("pantry_items")
        .update({
          ...form,
          name: form.name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingItem.id)
        .eq("user_id", userId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("pantry_items")
        .insert({
          ...form,
          name: form.name.trim(),
          user_id: userId,
        });
      error = err;
    }

    setSaving(false);

    if (error) setFormError(error.message);
    else {
      setModalVisible(false);
      fetchItems();
    }
  };

  const handleDelete = (item: CabinetItem) => {
    Alert.alert("Remove from Inventory", `Remove "${item.name}" from your inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("pantry_items").delete().eq("id", item.id).eq("user_id", userId!);
          if (error) Alert.alert("Error", error.message);
          else setItems(prev => prev.filter(i => i.id !== item.id));
        }
      }
    ]);
  };

  const renderProductRow = (product: Product, productId: string, id: string, reason?: string) => {
    const productGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : (product.inferred_goals || []);
    const match = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, productGoals);

    return (
      <ProductRow
        key={id}
        product={product}
        match={match}
        goals={productGoals}
        reason={reason}
        onPress={() => router.push(`/product/${productId}`)}
        rightAccessory={<Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} />}
        style={{
          backgroundColor: themeColors.backgroundSecondary,
          borderColor: themeColors.borderMuted,
          marginBottom: Spacing.sm,
          borderRadius: BorderRadii.md,
          borderWidth: 1,
        }}
      />
    );
  };

  const filteredSavedProducts = savedProducts.filter(saved => {
    if (activeFilter === "All") return true;
    const goals = saved.product?.product_goals?.length ? saved.product.product_goals.map(g => g.goal) : (saved.product?.inferred_goals || []);
    return goals.includes(activeFilter.toLowerCase());
  });

  const renderExpiryBadge = (dateStr: string | null) => {
    if (!dateStr) return null;
    const expired = isExpired(dateStr);
    const soon = isExpiringSoon(dateStr);
    if (!expired && !soon) return null;
    return (
      <View style={[styles.expiryBadge, expired ? styles.expiryBadgeRed : styles.expiryBadgeOrange]}>
        <Text style={[styles.expiryBadgeText, expired ? styles.expiryTextRed : styles.expiryTextOrange]}>
          {expired ? "Expired" : "Expires Soon"}
        </Text>
      </View>
    );
  };

  const renderInventoryItem = ({ item }: { item: CabinetItem }) => {
    const isSaved = false; // We can integrate saved state here if needed
    
    // Calculate "Added X days ago"
    const addedDate = new Date(item.created_at || new Date());
    const todayDate = new Date();
    const diffTime = Math.abs(todayDate.getTime() - addedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let addedString = "Added today";
    if (diffDays === 1) addedString = "Added 1 day ago";
    else if (diffDays > 1 && diffDays < 7) addedString = `Added ${diffDays} days ago`;
    else if (diffDays >= 7 && diffDays < 14) addedString = `Added 1 week ago`;
    else if (diffDays >= 14) addedString = `Added ${Math.floor(diffDays/7)} weeks ago`;

    return (
      <View style={styles.premiumListRow}>
        <View style={styles.premiumListLeft}>
          <View style={[styles.premiumProductImageWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
             <Ionicons name="flask-outline" size={24} color={themeColors.textMuted} />
          </View>
          <View style={styles.premiumListTextContent}>
            <Text style={[styles.premiumListTitle, { color: themeColors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.premiumListSubtitle, { color: themeColors.textSecondary }]}>{addedString}</Text>
          </View>
        </View>
        <Pressable 
          style={[styles.premiumListActionBtn, { borderColor: themeColors.border }]} 
          onPress={() => handleEdit(item)}
        >
          <Ionicons name="add" size={18} color={themeColors.text} />
        </Pressable>
      </View>
    );
  };

  const renderHeader = () => {
    const today = new Date();
    
    // Adherence Data
    const adherenceAvg = 82;
    const weeklyData = reflection?.trends || [];
    
    // Next Supplement Logic (Dummy logic since we're not altering DB, just pulling from activeStack)
    const nextSupplement = activeStack[0] || null;

    return (
      <View style={styles.headerSection}>
        {/* 1. GREETING SECTION */}
        <View style={styles.greetingHeader}>
          <View>
            <Text style={[styles.greetingSub, { color: themeColors.textSecondary }]}>GOOD MORNING</Text>
            <Text style={[styles.greetingTitle, { color: themeColors.text }]}>{profile?.full_name?.split(' ')[0] || 'Adrian'}</Text>
            <Text style={[styles.greetingDesc, { color: themeColors.textSecondary }]}>Here's your health overview</Text>
          </View>
          <Pressable style={[styles.headerActionCircle, { backgroundColor: themeColors.backgroundSecondary }]} onPress={() => router.push("/assistant?type=general")}>
            <Ionicons name="sparkles" size={20} color={themeColors.text} />
          </Pressable>
        </View>

        {/* 2. AI HEALTH OVERVIEW HERO */}
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={colorScheme === 'dark' ? ['#1A2518', '#111111'] : ['#F0FDF4', '#FFFFFF']}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroContentRow}>
              {/* Left Column */}
              <View style={styles.heroLeft}>
                <Text style={[styles.heroSuperTitle, { color: themeColors.textSecondary }]}>AI HEALTH OVERVIEW</Text>
                <Text style={[styles.heroMainTitle, { color: themeColors.text }]}>You're on track</Text>
                <Text style={[styles.heroBodyText, { color: themeColors.textSecondary }]}>
                  {stackInsights?.healthSummary || "Your routine consistency and biomarkers look strong this week."}
                </Text>
              </View>

              {/* Right Column: Score Ring */}
              <View style={styles.heroRight}>
                <View style={[styles.scoreRingBackground, { borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                  <View style={[styles.scoreRingFill, { borderColor: themeColors.success }]} />
                  <Text style={[styles.scoreValue, { color: themeColors.text }]}>{adherenceAvg}</Text>
                  <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>ELEXIR SCORE</Text>
                </View>
              </View>
            </View>

            <Pressable style={[styles.heroActionBtn, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} onPress={() => router.push("/assistant?type=general")}>
              <Ionicons name="sparkles" size={16} color={themeColors.text} style={{ marginRight: 8 }} />
              <Text style={[styles.heroActionText, { color: themeColors.text }]}>View full daily insight</Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </LinearGradient>
        </View>

        {/* 3. TWO-COLUMN METRICS */}
        <View style={styles.metricsTwoColumn}>
          {/* Column A: Today's Protocol */}
          <SoftCard style={[styles.metricCardBox, { backgroundColor: themeColors.backgroundSecondary, elevation: 0, shadowOpacity: 0 }]}>
            <Text style={[styles.metricCardSuper, { color: themeColors.textSecondary }]}>TODAY'S PROTOCOL</Text>
            <View style={styles.metricCardStatRow}>
              <Text style={[styles.metricCardBigStat, { color: themeColors.text }]}>{activeStack.length || 8}</Text>
              <Text style={[styles.metricCardLabelStat, { color: themeColors.textSecondary }]}>Supplements</Text>
            </View>
            
            <View style={styles.dotsRow}>
              {[1,2,3,4,5,6,7,8].map((i) => (
                <View key={i} style={[styles.protocolDot, i <= 5 ? { backgroundColor: themeColors.success, borderColor: themeColors.success } : { backgroundColor: 'transparent', borderColor: themeColors.border }]} />
              ))}
            </View>

            <View style={styles.nextUpContainer}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.nextUpTime, { color: themeColors.textSecondary }]}>Next at 12:00</Text>
                <Text style={[styles.nextUpName, { color: themeColors.text }]} numberOfLines={1}>{nextSupplement?.product?.name || "Omega 3"}</Text>
                <Text style={[styles.nextUpDosage, { color: themeColors.textSecondary }]}>1 softgel</Text>
              </View>
              <View style={[styles.nextUpImageWrapper, { backgroundColor: themeColors.background }]}>
                <Ionicons name="flask" size={24} color={themeColors.warning} />
              </View>
            </View>

            <View style={styles.metricCardDivider} />
            
            <Pressable style={styles.metricCardFooterBtn} onPress={() => router.push("/tabs/planner")}>
              <Text style={[styles.metricCardFooterText, { color: themeColors.text }]}>View today's schedule</Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} />
            </Pressable>
          </SoftCard>

          {/* Column B: Adherence History */}
          <SoftCard style={[styles.metricCardBox, { backgroundColor: themeColors.backgroundSecondary, elevation: 0, shadowOpacity: 0 }]}>
            <Text style={[styles.metricCardSuper, { color: themeColors.textSecondary }]}>ADHERENCE HISTORY</Text>
            <View style={styles.metricCardStatRow}>
              <Text style={[styles.metricCardBigStat, { color: themeColors.text }]}>{adherenceAvg}%</Text>
            </View>
            <Text style={[styles.metricCardLabelSub, { color: themeColors.textSecondary }]}>7-day average</Text>
            
            <View style={styles.miniChartContainer}>
              {['M','T','W','T','F','S','S'].map((day, idx) => {
                const height = 15 + Math.random() * 25; // Dummy heights since trends are complex to parse in UI directly
                const isMissed = idx === 3; // Make Thursday missed
                return (
                  <View key={idx} style={styles.miniChartCol}>
                    <View style={[styles.miniChartBar, { height, backgroundColor: isMissed ? themeColors.warning : themeColors.success }]} />
                    <Text style={[styles.miniChartDay, { color: themeColors.textSecondary }]}>{day}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.metricCardDivider} />
            
            <Pressable style={styles.metricCardFooterBtn} onPress={() => router.push("/tabs/tracker")}>
              <Text style={[styles.metricCardFooterText, { color: themeColors.text }]}>View full history</Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} />
            </Pressable>
          </SoftCard>
        </View>

        {/* 4. RECENTLY ADDED */}
        <View style={styles.recentlyAddedHeader}>
          <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary }]}>RECENTLY ADDED</Text>
          <Text style={[styles.seeAllText, { color: themeColors.text }]}>See all</Text>
        </View>

      </View>
    );
  };

  const renderModal = () => {
    return (
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalSafeArea, { backgroundColor: themeColors.background }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.borderMuted }]}>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalCancelBtn}><Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>Cancel</Text></Pressable>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{editingItem ? "Edit Entry" : "Add to Cabinet"}</Text>
              <Pressable onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
                {saving ? <ActivityIndicator color={themeColors.text} size="small" /> : <Text style={[styles.modalSaveText, { color: themeColors.text, fontWeight: "700" }]}>Save</Text>}
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              {formError ? <View style={styles.formError}><Text style={styles.formErrorText}>{formError}</Text></View> : null}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Product Name *</Text>
                <TextInput style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="e.g. Magnesium Glycinate" placeholderTextColor={themeColors.textMuted} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Brand (optional)</Text>
                <TextInput style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="e.g. Thorne" placeholderTextColor={themeColors.textMuted} value={form.brand ?? ""} onChangeText={v => setForm({ ...form, brand: v || null })} />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Quantity</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="e.g. 90" placeholderTextColor={themeColors.textMuted} value={form.quantity?.toString() ?? ""} onChangeText={v => setForm({ ...form, quantity: v ? parseFloat(v) : null })} keyboardType="decimal-pad" />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Unit</Text>
                  <TextInput style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="e.g. capsules" placeholderTextColor={themeColors.textMuted} value={form.unit ?? ""} onChangeText={v => setForm({ ...form, unit: v || null })} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={styles.quickChips}>
                  {UNITS.map(u => (
                    <Pressable key={u} style={[styles.quickChip, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }, form.unit === u && { backgroundColor: themeColors.text, borderColor: themeColors.text }]} onPress={() => setForm({ ...form, unit: form.unit === u ? null : u })}>
                      <Text style={[styles.quickChipText, { color: themeColors.textSecondary }, form.unit === u && { color: themeColors.background }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.quickChips}>
                    {CATEGORIES.map(cat => (
                      <Pressable key={cat} style={[styles.quickChip, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }, form.category === cat && { backgroundColor: themeColors.text, borderColor: themeColors.text }]} onPress={() => setForm({ ...form, category: form.category === cat ? null : cat })}>
                        <Text style={[styles.quickChipText, { color: themeColors.textSecondary }, form.category === cat && { color: themeColors.background }]}>
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Expiry Date (optional)</Text>
                <TextInput style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textMuted} value={form.expiry_date ?? ""} onChangeText={v => setForm({ ...form, expiry_date: v || null })} />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: themeColors.textMuted }]}>Notes (optional)</Text>
                <TextInput style={[styles.formInput, styles.formTextArea, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} placeholder="Take with breakfast..." placeholderTextColor={themeColors.textMuted} value={form.notes ?? ""} onChangeText={v => setForm({ ...form, notes: v || null })} multiline numberOfLines={3} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  const renderActionMenu = () => {
    return (
      <Modal visible={actionMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setActionMenuVisible(false)}>
        <Pressable style={styles.actionMenuOverlay} onPress={() => setActionMenuVisible(false)}>
          <Pressable style={[styles.actionMenuSheet, { backgroundColor: themeColors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionMenuHeader}>
              <Text style={[styles.actionMenuTitle, { color: themeColors.text }]}>Add & Track</Text>
              <Pressable onPress={() => setActionMenuVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={themeColors.textSecondary} />
              </Pressable>
            </View>
            
            <Pressable style={[styles.actionMenuItem, { borderBottomColor: themeColors.borderMuted }]} onPress={() => { setActionMenuVisible(false); router.push("/product-search"); }}>
              <View style={[styles.actionMenuIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}><Ionicons name="search-outline" size={20} color={themeColors.text} /></View>
              <View style={styles.actionMenuItemText}>
                <Text style={[styles.actionMenuItemTitle, { color: themeColors.text }]}>Search Formulary</Text>
                <Text style={[styles.actionMenuItemSubtitle, { color: themeColors.textSecondary }]}>Add dynamic database supplements.</Text>
              </View>
            </Pressable>

            <Pressable style={[styles.actionMenuItem, { borderBottomColor: themeColors.borderMuted }]} onPress={() => { setActionMenuVisible(false); setEditingItem(null); setForm(emptyForm()); setModalVisible(true); }}>
              <View style={[styles.actionMenuIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}><Ionicons name="cube-outline" size={20} color={themeColors.text} /></View>
              <View style={styles.actionMenuItemText}>
                <Text style={[styles.actionMenuItemTitle, { color: themeColors.text }]}>Add Custom Cabinet Entry</Text>
                <Text style={[styles.actionMenuItemSubtitle, { color: themeColors.textSecondary }]}>Log manual items in cabinet inventory.</Text>
              </View>
            </Pressable>
            
            <Pressable style={[styles.actionMenuItem, { borderBottomColor: themeColors.borderMuted }]} onPress={() => { setActionMenuVisible(false); router.push("/tabs/tracker"); }}>
              <View style={[styles.actionMenuIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}><Ionicons name="checkmark-circle-outline" size={20} color={themeColors.text} /></View>
              <View style={styles.actionMenuItemText}>
                <Text style={[styles.actionMenuItemTitle, { color: themeColors.text }]}>Log Daily Check-In</Text>
                <Text style={[styles.actionMenuItemSubtitle, { color: themeColors.textSecondary }]}>Record sleep, energy, and stress indices.</Text>
              </View>
            </Pressable>
            
            <Pressable style={[styles.actionMenuItem, { borderBottomWidth: 0 }]} onPress={() => { setActionMenuVisible(false); router.push("/tabs/scanner"); }}>
              <View style={[styles.actionMenuIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}><Ionicons name="barcode-outline" size={20} color={themeColors.text} /></View>
              <View style={styles.actionMenuItemText}>
                <Text style={[styles.actionMenuItemTitle, { color: themeColors.text }]}>Scan Barcode</Text>
                <Text style={[styles.actionMenuItemSubtitle, { color: themeColors.textSecondary }]}>Scan product barcode to lookup details.</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <PageContainer>
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: themeColors.text }]}>Elexir</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.text} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderInventoryItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={28} color={themeColors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Cabinet Empty</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>Log manual items or search the catalog to populate inventory.</Text>
            </View>
          }
          onRefresh={() => fetchItems(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable style={[styles.fab, { backgroundColor: themeColors.text }]} onPress={() => setActionMenuVisible(true)}>
        <Ionicons name="add" size={24} color={themeColors.background} />
      </Pressable>

      {renderModal()}
      {renderActionMenu()}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  screenHeader: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8 },
  screenTitle: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  listContent: { paddingBottom: 140 },
  headerSection: { paddingBottom: 8 },
  headerMetadata: {
    paddingHorizontal: 24,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  primaryFocusContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  diagnosticSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 24,
    marginBottom: 12,
  },
  metricsGrid: {
    paddingHorizontal: 24,
    gap: 12,
  },
  shortcutsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  shortcutCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadii.lg,
  },
  shortcutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  shortcutSub: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionContainer: { marginTop: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 24,
    marginBottom: 12,
  },
  verticalListContainer: {
    paddingHorizontal: 24,
  },
  filterList: {
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyListText: {
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 12,
    textAlign: "center",
  },
  itemCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: Spacing.md,
  },
  itemMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemLeft: {
    flex: 1,
    paddingRight: 16,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  itemExpiry: {
    fontSize: 12,
    fontWeight: "500",
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemNotes: {
    fontSize: 13,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    lineHeight: 18,
  },
  expiryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadii.sm,
  },
  expiryBadgeRed: { backgroundColor: "#FFF0F0" },
  expiryBadgeOrange: { backgroundColor: "#FDF7E2" },
  expiryBadgeText: { fontSize: 11, fontWeight: "700" },
  expiryTextRed: { color: "#D12424" },
  expiryTextOrange: { color: "#D97706" },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancelBtn: {
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  modalSaveBtn: {
    paddingVertical: 8,
  },
  modalSaveText: {
    fontSize: 16,
  },
  modalScroll: {
    padding: 20,
  },
  formError: {
    backgroundColor: "#FFF0F0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  formErrorText: {
    color: "#D12424",
    fontSize: 14,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  formInput: {
    borderRadius: BorderRadii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  formRow: {
    flexDirection: "row",
    gap: 16,
  },
  quickChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  formTextArea: {
    height: 100,
    textAlignVertical: "top",
  },
  premiumListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  premiumListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumProductImageWrapper: {
    width: 48,
    height: 48,
    borderRadius: BorderRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  premiumListTextContent: {
    flex: 1,
  },
  premiumListTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  premiumListSubtitle: {
    fontSize: 13,
  },
  premiumListActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 16,
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greetingSub: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  greetingDesc: {
    fontSize: 14,
  },
  headerActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrapper: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heroCard: {
    borderRadius: BorderRadii.xl,
    padding: 24,
    ...Shadows.floating,
  },
  heroContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 16,
  },
  heroSuperTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroBodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingFill: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 44,
    borderWidth: 4,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadii.lg,
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricsTwoColumn: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 32,
  },
  metricCardBox: {
    flex: 1,
    padding: 16,
    borderRadius: BorderRadii.lg,
  },
  metricCardSuper: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  metricCardStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 12,
  },
  metricCardBigStat: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
  },
  metricCardLabelStat: {
    fontSize: 13,
  },
  metricCardLabelSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
  },
  protocolDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  nextUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  nextUpTime: {
    fontSize: 11,
    marginBottom: 4,
  },
  nextUpName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  nextUpDosage: {
    fontSize: 12,
  },
  nextUpImageWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  miniChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 50,
    marginBottom: 20,
  },
  miniChartCol: {
    alignItems: 'center',
    gap: 6,
  },
  miniChartBar: {
    width: 6,
    borderRadius: 3,
  },
  miniChartDay: {
    fontSize: 9,
    fontWeight: '600',
  },
  metricCardDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 12,
  },
  metricCardFooterBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricCardFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recentlyAddedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitlePrimary: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  actionMenuSheet: {
    borderTopLeftRadius: BorderRadii.xxl,
    borderTopRightRadius: BorderRadii.xxl,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  actionMenuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  actionMenuTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  actionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionMenuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  actionMenuItemText: {
    flex: 1,
  },
  actionMenuItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  actionMenuItemSubtitle: {
    fontSize: 12,
  },
});