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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { getCabinetItems, deleteCabinetItem, updateCabinetItem, insertCabinetItem } from "../../lib/cabinet";
import { getSavedProducts, unsaveProduct, getRecentlyViewedProducts, getRecommendedProducts } from "../../lib/products";
import { CabinetItem, CabinetItemInput, UserSavedProduct, RecentlyViewedProduct, Product, RecommendedProduct } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch } from "../../lib/matching";
import { supabase } from "../../lib/supabase";
import { formatCategory, formatProductName, formatBrandName, formatGoalLabel, shouldDisplayField, getProductImageFallback } from "../../lib/productDisplay";
import { ProductRow } from "../../src/components/ProductRow";
import { DailyInsightCard } from "../../src/components/DailyInsightCard";
import { WeeklyReflection } from "../../src/components/WeeklyReflection";
import { generateStackInsights, StackInsightsResult } from "../../lib/insights";
import { getUserStack, getLogsForDateRange } from "../../lib/stack";

const CATEGORIES = ["Supplements", "Vitamins", "Minerals", "Protein", "Adaptogens", "Probiotics", "Sports Nutrition", "Functional Foods", "Food Products", "Drinks", "Other"];
const UNITS = ["capsules", "tablets", "softgels", "scoops", "g", "kg", "ml", "L", "pcs", "oz"];
const CATEGORY_EMOJI: Record<string, string> = { "Supplements": "💊", "Vitamins": "🌟", "Minerals": "🪨", "Protein": "💪", "Adaptogens": "🌿", "Probiotics": "🦠", "Sports Nutrition": "⚡️", "Functional Foods": "🥑", "Food Products": "🛒", "Drinks": "🧃", "Other": "📦" };

const emptyForm = (): CabinetItemInput => ({ name: "", brand: null, category: null, quantity: null, unit: null, expiry_date: null, notes: null });

function formatExpiry(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

const FILTERS = ["All", "Sleep", "Stress", "Recovery", "Energy", "Focus", "Immunity"];

export default function PantryScreen() {
  const router = useRouter();
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

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CabinetItem | null>(null);
  const [form, setForm] = useState<CabinetItemInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) setUserId(data.user.id);
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
    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    const [pantryRes, savedRes, viewedRes, recRes, stackRes, logsRes] = await Promise.all([
      supabase.from("pantry_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      getSavedProducts(userId),
      getRecentlyViewedProducts(userId),
      getRecommendedProducts(userId, userPreferences?.primary_goals || [], userPreferences?.health_concerns || [], userPreferences?.existing_supplements || [], userPreferences?.diet_type),
      getUserStack(userId),
      getLogsForDateRange(userId, sevenDaysAgoStr, todayStr)
    ]);

    if (pantryRes.error) Alert.alert("Error loading Health Cabinet", pantryRes.error.message);
    else setItems((pantryRes.data as CabinetItem[]) || []);

    setSavedProducts(savedRes);
    setRecentlyViewed(viewedRes);
    setRecommendedProducts(recRes);
    
    if (stackRes) {
      setStackInsights(generateStackInsights(userPreferences as any, stackRes, logsRes || []));
    }

    setLoading(false);
    setRefreshing(false);
  }, [userId, userPreferences]);

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm());
    setFormError("");
    setModalVisible(true);
  };

  const openEdit = (item: CabinetItem) => {
    setEditingItem(item);
    setForm({
      name: item.name, brand: item.brand, category: item.category, 
      quantity: item.quantity, unit: item.unit, expiry_date: item.expiry_date, notes: item.notes,
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

    const payload = {
      ...form,
      name: form.name.trim(),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingItem) {
      ({ error } = await supabase.from("pantry_items").update(payload).eq("id", editingItem.id).eq("user_id", userId));
    } else {
      ({ error } = await supabase.from("pantry_items").insert({ ...payload, user_id: userId }));
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
        rightAccessory={<Text style={styles.chevron}>›</Text>}
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
          {expired ? "Expired" : "Expiring soon"}
        </Text>
      </View>
    );
  };

  const renderInventoryItem = ({ item }: { item: CabinetItem }) => (
    <Pressable style={({ pressed }) => [styles.itemCard, pressed && { opacity: 0.85 }]} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
      <View style={styles.itemMain}>
        <View style={styles.itemLeft}>
          <View style={styles.categoryRow}>
            {item.category ? (
              <>
                <Text style={styles.categoryEmoji}>{CATEGORY_EMOJI[item.category] ?? '📦'}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.brand ? <Text style={styles.itemBrand}>{item.brand}</Text> : null}
          {item.quantity !== null || item.unit ? (
            <Text style={styles.itemQty}>{[item.quantity?.toString(), item.unit].filter(Boolean).join(" ")}</Text>
          ) : null}
          {item.expiry_date ? <Text style={styles.itemExpiry}>Expires: {formatExpiry(item.expiry_date)}</Text> : null}
        </View>
        <View style={styles.itemRight}>
          {renderExpiryBadge(item.expiry_date)}
          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)} hitSlop={12}><Text style={styles.deleteBtnText}>✕</Text></Pressable>
        </View>
      </View>
      {item.notes ? <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text> : null}
    </Pressable>
  );

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <DailyInsightCard insights={stackInsights} />
      <WeeklyReflection insights={stackInsights} />

      <Pressable style={styles.searchButton} onPress={() => router.push("/product-search")}>
        <Text style={styles.searchButtonIcon}>🔍</Text>
        <Text style={styles.searchButtonText}>Search & Add Products</Text>
      </Pressable>

      <Pressable 
        style={styles.askButton} 
        onPress={() => router.push("/assistant?type=general")}
      >
        <View style={styles.askButtonIcon}>
          <Text style={{ fontSize: 16 }}>✨</Text>
        </View>
        <View>
          <Text style={styles.askButtonTitle}>Ask Elexir</Text>
          <Text style={styles.askButtonSubtitle}>Understand your recommendations</Text>
        </View>
        <Text style={styles.askChevron}>›</Text>
      </Pressable>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Saved Products</Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {FILTERS.map(f => (
            <Pressable key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} onPress={() => setActiveFilter(f)}>
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.verticalListContainer}>
          {filteredSavedProducts.length > 0 ? (
            filteredSavedProducts.map(saved => saved.product && renderProductRow(saved.product, saved.product_id, saved.id))
          ) : (
            <Text style={styles.emptyListText}>No saved products match this filter.</Text>
          )}
        </View>
      </View>

      {recommendedProducts.length > 0 && (
        <View style={[styles.sectionContainer, { marginTop: 24 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recommended for your goals</Text>
          </View>
          <View style={styles.verticalListContainer}>
            {recommendedProducts.map(rec => renderProductRow(rec.product, rec.product.id, `rec-${rec.product.id}`, rec.reason))}
          </View>
        </View>
      )}

      {recentlyViewed.length > 0 && (
        <View style={[styles.sectionContainer, { marginTop: 24 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recently Viewed</Text>
            {recentlyViewed.length >= 5 && <Text style={styles.viewAllText}>View All</Text>}
          </View>
          <View style={styles.verticalListContainer}>
            {recentlyViewed.slice(0, 5).map(viewed => viewed.product && renderProductRow(viewed.product, viewed.product_id, viewed.id))}
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginLeft: 20, marginTop: 32, marginBottom: 12 }]}>
        Manual Inventory
      </Text>
    </View>
  );

  const renderModal = () => (
    <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalVisible(false)} style={styles.modalCancelBtn}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
            <Text style={styles.modalTitle}>{editingItem ? "Edit Product" : "Add to Cabinet"}</Text>
            <Pressable onPress={handleSave} disabled={saving} style={styles.modalSaveBtn}>
              {saving ? <ActivityIndicator color="#1C1C1E" size="small" /> : <Text style={styles.modalSaveText}>Save</Text>}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {formError ? <View style={styles.formError}><Text style={styles.formErrorText}>{formError}</Text></View> : null}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput style={styles.formInput} placeholder="e.g. Magnesium Glycinate" placeholderTextColor="#8E8E93" value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand <Text style={styles.formLabelOptional}>(optional)</Text></Text>
              <TextInput style={styles.formInput} placeholder="e.g. Thorne, NOW Foods" placeholderTextColor="#8E8E93" value={form.brand ?? ""} onChangeText={v => setForm({ ...form, brand: v || null })} />
            </View>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Quantity</Text>
                <TextInput style={styles.formInput} placeholder="e.g. 90" placeholderTextColor="#8E8E93" value={form.quantity?.toString() ?? ""} onChangeText={v => setForm({ ...form, quantity: v ? parseFloat(v) : null })} keyboardType="decimal-pad" />
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>Unit</Text>
                <TextInput style={styles.formInput} placeholder="e.g. capsules" placeholderTextColor="#8E8E93" value={form.unit ?? ""} onChangeText={v => setForm({ ...form, unit: v || null })} />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={styles.quickChips}>
                {UNITS.map(u => (
                  <Pressable key={u} style={[styles.quickChip, form.unit === u && styles.quickChipActive]} onPress={() => setForm({ ...form, unit: form.unit === u ? null : u })}>
                    <Text style={[styles.quickChipText, form.unit === u && styles.quickChipTextActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.quickChips}>
                  {CATEGORIES.map(cat => (
                    <Pressable key={cat} style={[styles.quickChip, form.category === cat && styles.quickChipActive]} onPress={() => setForm({ ...form, category: form.category === cat ? null : cat })}>
                      <Text style={[styles.quickChipText, form.category === cat && styles.quickChipTextActive]}>{CATEGORY_EMOJI[cat]} {cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Expiry Date <Text style={styles.formLabelOptional}>(optional)</Text></Text>
              <TextInput style={styles.formInput} placeholder="YYYY-MM-DD" placeholderTextColor="#8E8E93" value={form.expiry_date ?? ""} onChangeText={v => setForm({ ...form, expiry_date: v || null })} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes <Text style={styles.formLabelOptional}>(optional)</Text></Text>
              <TextInput style={[styles.formInput, styles.formTextArea]} placeholder="e.g. Take with food..." placeholderTextColor="#8E8E93" value={form.notes ?? ""} onChangeText={v => setForm({ ...form, notes: v || null })} multiline numberOfLines={3} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>Health Cabinet</Text>
          <Text style={styles.screenSubtitle}>
            {savedProducts.length} {savedProducts.length === 1 ? "saved product" : "saved products"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C1C1E" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderInventoryItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.listContent, items.length === 0 && savedProducts.length === 0 && { flex: 1 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Manual Inventory Empty</Text>
              <Text style={styles.emptySubtitle}>Tap + to add custom items that aren't in the database.</Text>
            </View>
          }
          onRefresh={() => fetchItems(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {renderModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  screenHeader: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  screenTitle: { fontSize: 34, fontWeight: "800", color: "#1C1C1E", letterSpacing: -1 },
  screenSubtitle: { fontSize: 15, color: "#8E8E93", marginTop: 2 },

  listContent: { paddingBottom: 100 },
  headerSection: { paddingBottom: 8 },

  searchButton: {
    marginHorizontal: 24, marginBottom: 24, flexDirection: "row", alignItems: "center",
    backgroundColor: "#1C1C1E", padding: 16, borderRadius: 100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  searchButtonIcon: { fontSize: 18, marginRight: 10 },
  searchButtonText: { fontSize: 16, fontWeight: "700", color: "#FFF" },

  askButton: {
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  askButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FDF4E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  askButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  askButtonSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
  },
  askChevron: {
    marginLeft: "auto",
    fontSize: 24,
    color: "#C7C7CC",
  },

  sectionContainer: { marginBottom: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1 },
  viewAllText: { fontSize: 13, fontWeight: "600", color: "#007AFF" },

  filterList: { paddingHorizontal: 24, marginBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: "#EBEAE4" },
  filterChipActive: { backgroundColor: "#1C1C1E" },
  filterChipText: { fontSize: 14, fontWeight: "600", color: "#636366" },
  filterChipTextActive: { color: "#FFF" },

  verticalListContainer: { paddingHorizontal: 24, gap: 0 },
  emptyListText: { color: "#8E8E93", fontStyle: "italic", textAlign: "center", paddingVertical: 24 },

  chevron: { fontSize: 24, color: "#C7C7CC", fontWeight: "300" },

  itemCard: {
    backgroundColor: "#FFF", borderRadius: 16, padding: 16, marginBottom: 12, marginHorizontal: 24,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  itemMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemLeft: { flex: 1, marginRight: 12 },
  itemRight: { alignItems: "flex-end", gap: 8 },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  categoryEmoji: { fontSize: 11 },
  itemCategory: { fontSize: 11, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 },
  itemName: { fontSize: 16, fontWeight: "700", color: "#1C1C1E", marginBottom: 2 },
  itemBrand: { fontSize: 12, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 },
  itemQty: { fontSize: 14, color: "#636366" },
  itemExpiry: { fontSize: 13, color: "#8E8E93", marginTop: 4 },
  itemNotes: { fontSize: 13, color: "#636366", marginTop: 10, lineHeight: 18, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)", paddingTop: 10 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  deleteBtnText: { fontSize: 12, color: "#8E8E93", fontWeight: "700" },

  expiryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  expiryBadgeRed: { backgroundColor: "#FFEBEA" }, expiryBadgeOrange: { backgroundColor: "#FFF3E0" },
  expiryBadgeText: { fontSize: 11, fontWeight: "700" }, expiryTextRed: { color: "#FF3B30" }, expiryTextOrange: { color: "#FF9500" },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80, paddingHorizontal: 32, marginTop: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#8E8E93", textAlign: "center", lineHeight: 22 },

  fab: { position: "absolute", right: 24, bottom: 32, width: 60, height: 60, borderRadius: 30, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 8 },
  fabText: { fontSize: 28, color: "#FFF", lineHeight: 32 },

  modalSafeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)", backgroundColor: "#FAF9F6" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  modalCancelBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  modalCancelText: { fontSize: 17, color: "#636366" },
  modalSaveBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 44, alignItems: "center" },
  modalSaveText: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  modalScroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },
  formError: { backgroundColor: "#FFEBEA", padding: 14, borderRadius: 12, marginBottom: 20 },
  formErrorText: { color: "#FF3B30", fontSize: 14, fontWeight: "500" },
  formGroup: { marginBottom: 20 }, formRow: { flexDirection: "row", gap: 14 },
  formLabel: { fontSize: 14, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  formLabelOptional: { fontWeight: "400", color: "#8E8E93" },
  formInput: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", padding: 14, borderRadius: 14, fontSize: 16, color: "#1C1C1E" },
  formTextArea: { minHeight: 80, textAlignVertical: "top" },
  quickChips: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
  quickChipActive: { backgroundColor: "#1C1C1E", borderColor: "#1C1C1E" },
  quickChipText: { fontSize: 13, fontWeight: "500", color: "#1C1C1E" },
  quickChipTextActive: { color: "#FFF" },
});