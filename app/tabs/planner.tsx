import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { getUserStack, removeFromStack } from "../../lib/stack";
import { UserStackItem } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch } from "../../lib/matching";
import { supabase } from "../../lib/supabase";
import { formatProductName, formatBrandName, formatGoalLabel, shouldDisplayField, getProductImageFallback } from "../../lib/productDisplay";
import { ProductRow } from "../../src/components/ProductRow";

export default function StackScreen() {
  const router = useRouter();
  const { userPreferences } = useAuth();
  const [stackItems, setStackItems] = useState<UserStackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) setUserId(data.user.id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchStack();
    }, [userId])
  );

  const fetchStack = async () => {
    if (!userId) return;
    setLoading(true);
    const res = await getUserStack(userId);
    setStackItems(res);
    setLoading(false);
  };

  const handleRemove = (item: UserStackItem) => {
    Alert.alert(
      "Remove from Stack",
      `Remove from your ${item.timing.replace("_", " ")} routine?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", style: "destructive", 
          onPress: async () => {
            try {
              if (userId) {
                await removeFromStack(userId, item.product_id, item.timing);
                setStackItems(prev => prev.filter(i => i.id !== item.id));
              }
            } catch (e) {
              console.error(e);
              Alert.alert("Error", "Could not remove.");
            }
          } 
        }
      ]
    );
  };

  const renderProductRow = (item: UserStackItem) => {
    const product = item.product;
    if (!product) return null;

    const productGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : (product.inferred_goals || []);
    const match = calculateMatch(userPreferences?.primary_goals, userPreferences?.health_concerns, productGoals);

    const removeButton = (
      <Pressable style={styles.removeButton} onPress={() => handleRemove(item)} hitSlop={12}>
        <Text style={styles.removeButtonText}>✕</Text>
      </Pressable>
    );

    return (
      <ProductRow
        key={item.id}
        product={product}
        match={match}
        goals={productGoals}
        onPress={() => router.push(`/product/${item.product_id}`)}
        rightAccessory={removeButton}
      />
    );
  };

  const morningItems = stackItems.filter(i => i.timing === 'morning');
  const afternoonItems = stackItems.filter(i => i.timing === 'afternoon');
  const eveningItems = stackItems.filter(i => i.timing === 'evening');
  const asNeededItems = stackItems.filter(i => i.timing === 'as_needed');

  const trackedGoals = Array.from(new Set([
    ...(userPreferences?.primary_goals || []),
    ...(userPreferences?.health_concerns || [])
  ]));

  const stackGoals = new Set<string>();
  stackItems.forEach(item => {
    item.product?.product_goals?.forEach(g => stackGoals.add(g.goal));
    item.product?.inferred_goals?.forEach(g => stackGoals.add(g));
  });

  const supportedGoals = trackedGoals.filter(g => stackGoals.has(g));
  const lessCoverageGoals = trackedGoals.filter(g => !stackGoals.has(g));

  const renderInsights = () => {
    if (stackItems.length === 0 || trackedGoals.length === 0) return null;

    return (
      <View style={styles.insightsContainer}>
        {supportedGoals.length > 0 && (
          <View style={[styles.insightGroup, lessCoverageGoals.length === 0 && { marginBottom: 0 }]}>
            <Text style={styles.insightLabel}>Your Stack Supports</Text>
            <View style={styles.chipRow}>
              {supportedGoals.map(g => (
                <View key={g} style={styles.chipSupported}>
                  <Text style={styles.chipSupportedText}>✓ {formatGoalLabel(g)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {lessCoverageGoals.length > 0 && (
          <View style={[styles.insightGroup, { marginBottom: 0 }]}>
            <Text style={styles.insightLabel}>Less Coverage</Text>
            <View style={styles.chipRow}>
              {lessCoverageGoals.map(g => (
                <View key={g} style={styles.chipLacking}>
                  <Text style={styles.chipLackingText}>• {formatGoalLabel(g)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderTimingSection = (title: string, emoji: string, items: UserStackItem[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.sectionContainer} key={title}>
        <Text style={styles.sectionTitle}>{emoji} {title} <Text style={styles.sectionCount}>({items.length})</Text></Text>
        <View style={styles.verticalListContainer}>
          {items.map(renderProductRow)}
        </View>
      </View>
    );
  };

  if (loading && stackItems.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>My Daily Stack</Text>
          <Text style={styles.screenSubtitle}>
            {stackItems.length} {stackItems.length === 1 ? "supplement" : "supplements"} scheduled
          </Text>
        </View>

        {stackItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>Your stack is empty</Text>
            <Text style={styles.emptySubtitle}>
              Find products in the Cabinet or Search, and tap "Add to Stack" to organize your daily routine.
            </Text>
          </View>
        ) : (
          <>
            <Pressable 
              style={styles.askButton} 
              onPress={() => router.push("/assistant?type=stack")}
            >
              <View style={styles.askButtonIcon}>
                <Text style={{ fontSize: 16 }}>✨</Text>
              </View>
              <View>
                <Text style={styles.askButtonTitle}>Ask Elexir</Text>
                <Text style={styles.askButtonSubtitle}>Understand your stack coverage</Text>
              </View>
              <Text style={styles.askChevron}>›</Text>
            </Pressable>

            {renderInsights()}
            {renderTimingSection("Morning", "☀️", morningItems)}
            {renderTimingSection("Afternoon", "🌤️", afternoonItems)}
            {renderTimingSection("Evening", "🌙", eveningItems)}
            {renderTimingSection("As Needed", "⭐", asNeededItems)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FAF9F6" },
  scrollContent: { paddingBottom: 100 },
  screenHeader: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 24 },
  screenTitle: { fontSize: 34, fontWeight: "800", color: "#1C1C1E", letterSpacing: -1 },
  screenSubtitle: { fontSize: 15, color: "#8E8E93", marginTop: 2 },
  
  sectionContainer: { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#8E8E93", marginLeft: 24, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 },
  sectionCount: { color: "#8E8E93", fontWeight: "600" },
  verticalListContainer: { paddingHorizontal: 24, gap: 0 },
  
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: { fontSize: 12, fontWeight: "700", color: "#8E8E93" },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1C1C1E", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#8E8E93", textAlign: "center", lineHeight: 22 },

  insightsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  insightGroup: {
    marginBottom: 20,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipSupported: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  chipSupportedText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "700",
  },
  chipLacking: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  chipLackingText: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "600",
  },
  askButton: {
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
});
