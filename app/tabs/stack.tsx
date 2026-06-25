import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { CabinetItem, CabinetItemInput, UserSavedProduct, RecentlyViewedProduct } from "../../lib/types";
import { getSavedProducts, getRecentlyViewedProducts } from "../../lib/products";
import { getUserStack } from "../../lib/stack";
import { useAuth } from "../../lib/auth-context";
import { formatExpiry, isExpired, isExpiringSoon } from "../../lib/expiry";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, Shadows, Typography, getContentContainerStyle } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = ["Supplements", "Vitamins", "Minerals", "Herbs", "Other"];
const UNITS = ["capsules", "tablets", "g", "mg", "ml", "drops", "gummies", "servings"];

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

export default function StackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const { userPreferences } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [items, setItems] = useState<CabinetItem[]>([]);
  const [activeStack, setActiveStack] = useState<any[]>([]);
  const [savedProducts, setSavedProducts] = useState<UserSavedProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CabinetItem | null>(null);
  const [form, setForm] = useState<CabinetItemInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const canSave = !!form.name.trim() && !saving;

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchStackData();
      }
    }, [userId])
  );

  useEffect(() => {
    if (params.openAddModal === 'true' && userId) {
      setEditingItem(null);
      setForm(emptyForm());
      setFormError("");
      setModalVisible(true);
      router.setParams({ openAddModal: undefined });
    }
  }, [params.openAddModal, userId]);

  const fetchStackData = async (isRefresh = false) => {
    if (!userId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [cabinetRes, stackRes, savedRes, viewedRes] = await Promise.all([
        supabase.from("pantry_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        getUserStack(userId),
        getSavedProducts(userId),
        getRecentlyViewedProducts(userId),
      ]);

      if (!cabinetRes.error && cabinetRes.data) {
        setItems(cabinetRes.data as CabinetItem[]);
      }
      setActiveStack(stackRes || []);
      setSavedProducts(savedRes || []);
      setRecentlyViewed(viewedRes || []);
    } catch (e) {
      console.warn("Error fetching stack/cabinet data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

    if (error) {
      setFormError(error.message);
      Alert.alert("Save Error", error.message || "An error occurred while saving.");
    } else {
      setModalVisible(false);
      fetchStackData();
    }
  };

  const handleDelete = (item: CabinetItem) => {
    Alert.alert("Remove from Cabinet", `Remove "${item.name}" from your cabinet?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("pantry_items").delete().eq("id", item.id).eq("user_id", userId!);
          if (error) Alert.alert("Error", error.message);
          else setItems(prev => prev.filter(i => i.id !== item.id));
        }
      }
    ]);
  };

  const navigateToProductDetail = (productId: string | null | undefined, productName?: string | null) => {
    if (!productId) {
      Alert.alert("Product Details", `Details for "${productName || 'this supplement'}" are coming soon.`);
      return;
    }
    router.push(`/product/${productId}`);
  };

  const getCabinetItemSubtitle = (item: CabinetItem) => {
    if (item.brand) return item.brand;
    const addedDate = new Date(item.created_at || new Date());
    const todayDate = new Date();
    const diffTime = Math.abs(todayDate.getTime() - addedDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Added today";
    if (diffDays === 1) return "Added 1 day ago";
    if (diffDays < 7) return `Added ${diffDays} days ago`;
    return `Added ${Math.floor(diffDays/7)} weeks ago`;
  };

  return (
    <PageContainer scrollable contentContainerStyle={getContentContainerStyle()}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.screenTitle, { color: themeColors.text }]}>Stack</Text>
            <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>
              Your supplements and saved products
            </Text>
          </View>
          <Pressable 
            style={[styles.addButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
            onPress={() => { setEditingItem(null); setForm(emptyForm()); setFormError(""); setModalVisible(true); }}
          >
            <Ionicons name="add" size={24} color={themeColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Product Search Bar */}
      <View style={styles.searchContainer}>
        <Pressable 
          style={[styles.searchBar, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
          onPress={() => router.push("/product-search")}
        >
          <Ionicons name="search-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
          <Text style={[styles.searchPlaceholder, { color: themeColors.textSecondary }]}>
            Search products, brands or ingredients
          </Text>
        </Pressable>
      </View>

      {loading && activeStack.length === 0 && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.text} />
        </View>
      ) : (
        <View style={{ gap: 20 }}>
          {/* Section 1: Current Stack */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Current Stack</Text>
              {activeStack.length > 0 && (
                <Pressable onPress={() => router.push("/tabs/tracker")}>
                  <Text style={[styles.sectionLink, { color: themeColors.text }]}>View Schedule</Text>
                </Pressable>
              )}
            </View>

            {activeStack.length === 0 ? (
              <SoftCard style={styles.emptyCard} variant="elevated">
                <Text style={[styles.emptyCardTitle, { color: themeColors.text }]}>No products in your stack</Text>
                <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>
                  Search or scan a supplement to add it.
                </Text>
                <Pressable 
                  style={[styles.emptyCardBtn, { backgroundColor: themeColors.text }]}
                  onPress={() => router.push("/product-search")}
                >
                  <Text style={[styles.emptyCardBtnText, { color: themeColors.background }]}>Find products</Text>
                </Pressable>
              </SoftCard>
            ) : (
              <SoftCard style={styles.listCard} variant="elevated">
                {activeStack.map((item) => {
                  const hasTiming = !!item.timing;
                  const hasDosage = !!item.dosage;
                  const statusLabel = (!hasTiming && !hasDosage) ? "Incomplete" : !hasTiming ? "Missing timing" : !hasDosage ? "Needs review" : "Active";
                  const score = item.product?.data_quality_score;

                  return (
                    <Pressable
                      key={item.id}
                      style={styles.stackRow}
                      onPress={() => navigateToProductDetail(item.product_id, item.product?.name)}
                    >
                      <View style={[styles.productImageWrapper, { backgroundColor: themeColors.background }]}>
                        <Ionicons name="flask-outline" size={18} color={themeColors.text} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                        <Text style={[styles.productName, { color: themeColors.text }]} numberOfLines={1}>
                          {item.product?.name || "Unknown Formulation"}
                        </Text>
                        <Text style={[styles.productBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {item.product?.brand || "Supplement"}
                        </Text>
                        <View style={styles.rowMetadata}>
                          {item.dosage && (
                            <Text style={[styles.dosageText, { color: themeColors.textMuted }]} numberOfLines={1}>
                              {item.dosage} • {item.timing?.replace('_', ' ')}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[
                          styles.statusBadge, 
                          statusLabel === "Active" && { backgroundColor: themeColors.success + '15' },
                          statusLabel === "Missing timing" && { backgroundColor: themeColors.warning + '15' },
                          statusLabel === "Needs review" && { backgroundColor: themeColors.warning + '15' },
                          statusLabel === "Incomplete" && { backgroundColor: themeColors.error + '15' },
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            statusLabel === "Active" && { color: themeColors.success },
                            statusLabel === "Missing timing" && { color: themeColors.warning },
                            statusLabel === "Needs review" && { color: themeColors.warning },
                            statusLabel === "Incomplete" && { color: themeColors.error },
                          ]}>
                            {statusLabel}
                          </Text>
                        </View>
                        {score !== undefined && score !== null && (
                          <View style={[styles.scoreBadge, { backgroundColor: themeColors.background }]}>
                            <Text style={[styles.scoreBadgeText, { color: themeColors.textSecondary }]}>
                              Score {score}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </SoftCard>
            )}
          </View>

          {/* Section 2: Cabinet */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary, marginBottom: 12 }]}>Cabinet</Text>

            {items.length === 0 ? (
              <SoftCard style={styles.emptyCard} variant="elevated">
                <Text style={[styles.emptyCardTitle, { color: themeColors.text }]}>Your cabinet is empty</Text>
                <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>
                  Add products you own, even if they are not part of your daily plan.
                </Text>
                <Pressable 
                  style={[styles.emptyCardBtn, { backgroundColor: themeColors.text }]}
                  onPress={() => { setEditingItem(null); setForm(emptyForm()); setFormError(""); setModalVisible(true); }}
                >
                  <Text style={[styles.emptyCardBtnText, { color: themeColors.background }]}>Add Custom</Text>
                </Pressable>
              </SoftCard>
            ) : (
              <SoftCard style={styles.listCard} variant="elevated">
                {items.map((item) => {
                  const expired = item.expiry_date ? isExpired(item.expiry_date) : false;
                  const soon = item.expiry_date ? isExpiringSoon(item.expiry_date) : false;

                  return (
                    <View key={item.id} style={styles.cabinetRow}>
                      <View style={[styles.productImageWrapper, { backgroundColor: themeColors.background }]}>
                        <Ionicons name="cube-outline" size={18} color={themeColors.textSecondary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                        <Text style={[styles.productName, { color: themeColors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.productBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
                            {getCabinetItemSubtitle(item)}
                          </Text>
                          {item.quantity !== null && (
                            <Text style={{ color: themeColors.textMuted, fontSize: 11 }}>• {item.quantity} {item.unit || "items"}</Text>
                          )}
                        </View>
                        {item.expiry_date && (
                          <Text style={[styles.expiryText, expired ? { color: themeColors.error } : soon ? { color: themeColors.warning } : { color: themeColors.textSecondary }]}>
                            {expired ? "Expired" : soon ? "Expiring soon" : `Expires ${formatExpiry(item.expiry_date)}`}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable 
                          style={[styles.cabinetActionBtn, { borderColor: themeColors.border }]} 
                          onPress={() => handleEdit(item)}
                        >
                          <Ionicons name="create-outline" size={16} color={themeColors.text} />
                        </Pressable>
                        <Pressable 
                          style={[styles.cabinetActionBtn, { borderColor: themeColors.border }]} 
                          onPress={() => handleDelete(item)}
                        >
                          <Ionicons name="trash-outline" size={16} color={themeColors.error} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </SoftCard>
            )}
          </View>

          {/* Section 3: Saved Products */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary, marginBottom: 12 }]}>Saved products</Text>

            {savedProducts.length === 0 ? (
              <SoftCard style={styles.emptyCard} variant="elevated">
                <Text style={[styles.emptyCardTitle, { color: themeColors.text }]}>No saved products yet</Text>
                <Text style={[styles.emptyCardText, { color: themeColors.textSecondary }]}>
                  Save products to compare or review later.
                </Text>
              </SoftCard>
            ) : (
              <View style={styles.savedGrid}>
                {savedProducts.map((saved) => {
                  const score = saved.product?.data_quality_score;
                  return (
                    <Pressable
                      key={saved.id}
                      style={[styles.savedCard, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                      onPress={() => navigateToProductDetail(saved.product_id, saved.product?.name)}
                    >
                      <View style={[styles.savedImageContainer, { backgroundColor: themeColors.background }]}>
                        <Ionicons name="bookmark-outline" size={20} color={themeColors.textSecondary} />
                      </View>
                      <Text style={[styles.savedName, { color: themeColors.text }]} numberOfLines={2}>
                        {saved.product?.name}
                      </Text>
                      <Text style={[styles.savedBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        {saved.product?.brand || "Supplement"}
                      </Text>
                      {score !== undefined && score !== null && (
                        <View style={[styles.scoreBadge, { backgroundColor: themeColors.background, marginTop: 6, alignSelf: 'flex-start' }]}>
                          <Text style={[styles.scoreBadgeText, { color: themeColors.textSecondary }]}>
                            Score {score}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Section 4: Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <View style={[styles.sectionContainer, { marginBottom: 30 }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textSecondary, marginBottom: 12 }]}>Recently viewed</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {recentlyViewed.slice(0, 4).map((viewed) => (
                  <Pressable 
                    key={viewed.id} 
                    style={[styles.recentCard, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
                    onPress={() => navigateToProductDetail(viewed.product_id, viewed.product?.name)}
                  >
                    <View style={[styles.recentIconWrapper, { backgroundColor: themeColors.background }]}>
                      <Ionicons name="eye-outline" size={16} color={themeColors.textSecondary} />
                    </View>
                    <Text style={[styles.recentName, { color: themeColors.text }]} numberOfLines={2}>
                      {viewed.product?.name}
                    </Text>
                    <Text style={[styles.recentBrand, { color: themeColors.textMuted }]} numberOfLines={1}>
                      {viewed.product?.brand || "Basis Product"}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Add Custom Item Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalSafeArea, { backgroundColor: themeColors.background }]}>
          <View style={styles.modalContentWrapper}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: themeColors.borderMuted, paddingTop: insets.top + 12 }]}>
                <Pressable onPress={() => setModalVisible(false)} style={styles.modalCancelBtn} hitSlop={12}>
                  <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
                </Pressable>
                
                <Text style={[styles.modalTitleText, { color: themeColors.text }]}>
                  {editingItem ? "Edit Entry" : "Add to Cabinet"}
                </Text>
                
                <Pressable 
                  onPress={handleSave} 
                  disabled={!canSave} 
                  style={styles.modalSaveBtn} 
                  hitSlop={12}
                >
                  {saving ? (
                    <ActivityIndicator color={themeColors.text} size="small" />
                  ) : (
                    <Text style={[
                      styles.modalSaveText, 
                      { color: canSave ? themeColors.text : themeColors.textMuted }
                    ]}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>

              {/* Form Content */}
              <ScrollView 
                contentContainerStyle={[styles.modalScroll, { paddingBottom: insets.bottom + 40 }]} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {formError ? (
                  <View style={styles.formError}>
                    <Text style={styles.formErrorText}>{formError}</Text>
                  </View>
                ) : null}
                
                {/* Product name */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Product name *</Text>
                  <TextInput 
                    style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} 
                    placeholder="e.g. Magnesium Glycinate" 
                    placeholderTextColor={themeColors.textMuted} 
                    value={form.name} 
                    onChangeText={v => setForm({ ...form, name: v })} 
                  />
                </View>

                {/* Brand */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Brand optional</Text>
                  <TextInput 
                    style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} 
                    placeholder="e.g. Thorne" 
                    placeholderTextColor={themeColors.textMuted} 
                    value={form.brand ?? ""} 
                    onChangeText={v => setForm({ ...form, brand: v || null })} 
                  />
                </View>

                {/* Quantity + Unit in two-column row */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Quantity</Text>
                    <TextInput 
                      style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} 
                      placeholder="e.g. 90" 
                      placeholderTextColor={themeColors.textMuted} 
                      value={form.quantity?.toString() ?? ""} 
                      onChangeText={v => setForm({ ...form, quantity: v ? parseFloat(v) : null })} 
                      keyboardType="decimal-pad" 
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Unit</Text>
                    <TextInput 
                      style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} 
                      placeholder="e.g. capsules" 
                      placeholderTextColor={themeColors.textMuted} 
                      value={form.unit ?? ""} 
                      onChangeText={v => setForm({ ...form, unit: v || null })} 
                    />
                  </View>
                </View>

                {/* Unit chips */}
                <View style={[styles.formGroup, { marginTop: -8 }]}>
                  <View style={styles.chipsContainer}>
                    {UNITS.map(u => (
                      <Pressable 
                        key={u} 
                        style={[
                          styles.quickChip, 
                          { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }, 
                          form.unit === u && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                        ]} 
                        onPress={() => setForm({ ...form, unit: form.unit === u ? null : u })}
                      >
                        <Text style={[
                          styles.quickChipText, 
                          { color: themeColors.textSecondary }, 
                          form.unit === u && { color: themeColors.backgroundSecondary }
                        ]}>
                          {u}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Category chips */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Category</Text>
                  <View style={styles.chipsContainer}>
                    {CATEGORIES.map(cat => (
                      <Pressable 
                        key={cat} 
                        style={[
                          styles.quickChip, 
                          { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }, 
                          form.category === cat && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                        ]} 
                        onPress={() => setForm({ ...form, category: form.category === cat ? null : cat })}
                      >
                        <Text style={[
                          styles.quickChipText, 
                          { color: themeColors.textSecondary }, 
                          form.category === cat && { color: themeColors.backgroundSecondary }
                        ]}>
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Expiry date */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Expiry date optional</Text>
                  <TextInput 
                    style={[styles.formInput, { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }]} 
                    placeholder="YYYY-MM-DD" 
                    placeholderTextColor={themeColors.textMuted} 
                    value={form.expiry_date ?? ""} 
                    onChangeText={v => setForm({ ...form, expiry_date: v || null })} 
                  />
                </View>

                {/* Notes */}
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Notes optional</Text>
                  <TextInput 
                    style={[
                      styles.formInput, 
                      styles.formTextArea, 
                      { backgroundColor: themeColors.backgroundSecondary, color: themeColors.text, borderColor: themeColors.border }
                    ]} 
                    placeholder="Take with breakfast..." 
                    placeholderTextColor={themeColors.textMuted} 
                    value={form.notes ?? ""} 
                    onChangeText={v => setForm({ ...form, notes: v || null })} 
                    multiline 
                    numberOfLines={3} 
                  />
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 200 },
  scrollContent: { paddingBottom: 140 },
  headerContainer: { paddingTop: Spacing.xl, paddingBottom: 12 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchBar: {
    height: 52,
    borderWidth: 1,
    borderRadius: BorderRadii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchPlaceholder: {
    fontSize: 14,
    flex: 1,
  },
  sectionContainer: {
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadii.xl,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCardText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  emptyCardBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadii.md,
  },
  emptyCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listCard: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BorderRadii.xl,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cabinetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  productImageWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
  },
  productBrand: {
    fontSize: 12,
    marginTop: 2,
  },
  rowMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dosageText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expiryText: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  cabinetActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  savedCard: {
    width: '48%',
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 16,
    elevation: 2,
    justifyContent: 'space-between',
  },
  savedImageContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  savedName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  savedBrand: {
    fontSize: 11,
    marginTop: 2,
  },
  horizontalScroll: {
    gap: 8,
    paddingHorizontal: 4,
  },
  recentCard: {
    width: 140,
    padding: 12,
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
  },
  recentIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recentName: {
    fontSize: 12,
    fontWeight: '700',
    height: 34,
    lineHeight: 17,
  },
  recentBrand: {
    fontSize: 11,
    marginTop: 4,
  },

  // Modal styling
  modalSafeArea: { flex: 1 },
  modalContentWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  modalHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingHorizontal: 24, 
    paddingBottom: 16, 
    borderBottomWidth: 1,
  },
  modalCancelBtn: { 
    paddingVertical: 8,
  },
  modalCancelText: { 
    fontSize: 16,
    fontWeight: "500",
  },
  modalTitleText: { 
    fontSize: 18, 
    fontWeight: "700",
  },
  modalSaveBtn: { 
    paddingVertical: 8,
  },
  modalSaveText: { 
    fontSize: 16,
    fontWeight: "700",
  },
  modalScroll: { 
    paddingHorizontal: 24, 
    paddingTop: 24, 
  },
  formGroup: { 
    marginBottom: 24,
  },
  formLabel: { 
    fontSize: 14, 
    fontWeight: "500", 
    marginBottom: 8, 
  },
  formInput: { 
    height: 56, 
    borderRadius: 18, 
    borderWidth: 1, 
    paddingHorizontal: 18, 
    fontSize: 16, 
  },
  formRow: { 
    flexDirection: "row", 
    gap: 16,
  },
  formTextArea: { 
    height: 100, 
    paddingTop: 16, 
    textAlignVertical: "top",
  },
  formError: { 
    backgroundColor: "rgba(239, 68, 68, 0.1)", 
    padding: 12, 
    borderRadius: BorderRadii.md, 
    marginBottom: 24,
  },
  formErrorText: { 
    color: "#EF4444", 
    fontSize: 13, 
    fontWeight: "600",
  },
  chipsContainer: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8,
  },
  quickChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 100, 
    borderWidth: 1,
  },
  quickChipText: { 
    fontSize: 14, 
    fontWeight: "600",
  },
});
