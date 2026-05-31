import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { getUserStack, removeFromStack } from "../../lib/stack";
import { getRecommendedProducts } from "../../lib/products";
import { UserStackItem, RecommendedProduct } from "../../lib/types";
import { useAuth } from "../../lib/auth-context";
import { calculateMatch } from "../../lib/matching";
import { supabase } from "../../lib/supabase";
import { formatProductName, formatGoalLabel } from "../../lib/productDisplay";
import { ProductRow } from "../../src/components/ProductRow";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SurfaceCard } from "../../src/components/ui/SurfaceCard";
import { PremiumButton } from "../../src/components/ui/PremiumButton";
import { Colors, Spacing, BorderRadii, Typography, Shadows } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

export default function StackScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  const { userPreferences } = useAuth();
  const [stackItems, setStackItems] = useState<UserStackItem[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
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

    if (res.length === 0) {
      const recRes = await getRecommendedProducts(
        userId,
        userPreferences?.primary_goals || [],
        userPreferences?.health_concerns || [],
        userPreferences?.existing_supplements || [],
        userPreferences?.diet_type
      );
      setRecommendedProducts(recRes);
    }

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

    return (
      <View key={item.id} style={styles.premiumListRow}>
        <View style={styles.premiumListLeft}>
          <View style={[styles.premiumProductImageWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
             <Ionicons name="flask-outline" size={24} color={themeColors.textMuted} />
          </View>
          <View style={styles.premiumListTextContent}>
            <Text style={[styles.premiumListTitle, { color: themeColors.text }]} numberOfLines={1}>{product.name}</Text>
            <Text style={[styles.premiumListSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {product.brand || product.category || "Supplement"}
            </Text>
          </View>
        </View>
        
        {/* Neutral Status Action State */}
        <Pressable 
          style={styles.neutralStatusActionBtn} 
          onPress={() => handleRemove(item)}
          hitSlop={12}
        >
          <View style={styles.neutralStatusDot} />
          <Ionicons name="close" size={14} color={themeColors.textSecondary} />
        </Pressable>
      </View>
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

  if (loading && stackItems.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  const renderEmptyState = () => {
    const primaryGoals = userPreferences?.primary_goals || [];
    const goalsToUse = primaryGoals.length > 0 ? primaryGoals : ["sleep", "energy", "stress"];
    
    // Kept fallback structure unchanged
    const fallbackSuggestions: Record<string, { title: string, reason: string }[]> = {
      sleep: [
        { title: "Magnesium", reason: "Supports relaxation and deep sleep" },
        { title: "Glycine", reason: "Calms the brain and lowers body temperature" },
        { title: "L-theanine", reason: "Promotes relaxation without drowsiness" }
      ],
      energy: [
        { title: "Vitamin D", reason: "Crucial for sustained daily energy" },
        { title: "B12", reason: "Essential for cellular energy production" },
        { title: "Creatine", reason: "Supports physical and mental endurance" }
      ],
      stress: [
        { title: "Magnesium", reason: "Helps regulate the nervous system" },
        { title: "Ashwagandha", reason: "Adaptogen that lowers cortisol levels" },
        { title: "L-theanine", reason: "Reduces anxiety and stress markers" }
      ],
      focus: [
        { title: "Omega-3", reason: "Essential for cognitive function and memory" },
        { title: "Creatine", reason: "Reduces mental fatigue during complex tasks" },
        { title: "L-theanine", reason: "Improves attention when paired with caffeine" }
      ],
      recovery: [
        { title: "Creatine", reason: "Accelerates muscle recovery post-workout" },
        { title: "Magnesium", reason: "Relieves muscle tension and cramps" },
        { title: "Protein", reason: "Provides building blocks for muscle repair" }
      ],
      "gut health": [
        { title: "Probiotics", reason: "Maintains a healthy gut microbiome" },
        { title: "Fiber", reason: "Feeds beneficial gut bacteria" },
        { title: "Digestive enzymes", reason: "Helps break down and absorb nutrients" }
      ]
    };

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.greetingTitle, { color: themeColors.text, textAlign: 'center', marginTop: 40 }]}>
          No Scheduled Items
        </Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}>
          Schedule supplements to organize your daily routines.
        </Text>

        <View style={styles.recommendationsContainer}>
          <Text style={[styles.sectionTitlePrimary, { color: themeColors.textSecondary, marginBottom: 16 }]}>
            CURATED RECOMMENDATIONS
          </Text>
          
          {recommendedProducts.length > 0 ? (
            recommendedProducts.map(rec => (
              <Pressable key={`rec-${rec.product.id}`} style={styles.premiumListRow} onPress={() => router.push(`/product/${rec.product.id}`)}>
                <View style={styles.premiumListLeft}>
                  <View style={[styles.premiumProductImageWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
                    <Ionicons name="flask-outline" size={24} color={themeColors.textMuted} />
                  </View>
                  <View style={styles.premiumListTextContent}>
                    <Text style={[styles.premiumListTitle, { color: themeColors.text }]} numberOfLines={1}>{rec.product.name}</Text>
                    <Text style={[styles.premiumListSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>{rec.reason || "Recommended"}</Text>
                  </View>
                </View>
                <View style={[styles.premiumListActionBtn, { borderColor: themeColors.border }]}>
                  <Ionicons name="add" size={18} color={themeColors.text} />
                </View>
              </Pressable>
            ))
          ) : (
            goalsToUse.slice(0, 2).map(goal => {
              const normalizedGoal = goal.toLowerCase();
              const matchKey = Object.keys(fallbackSuggestions).find(k => normalizedGoal.includes(k)) || "sleep";
              const suggestions = fallbackSuggestions[matchKey];
              
              return (
                <View key={goal} style={styles.goalGroup}>
                  <Text style={[styles.sectionTitlePrimary, { color: themeColors.textMuted, marginBottom: 8, marginTop: 16 }]}>
                    FOR {(formatGoalLabel(goal) || goal).toUpperCase()}
                  </Text>
                  {suggestions.map(s => (
                    <Pressable key={s.title} style={styles.premiumListRow} onPress={() => router.push(`/product-search?q=${encodeURIComponent(s.title)}`)}>
                      <View style={styles.premiumListLeft}>
                        <View style={[styles.premiumProductImageWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
                          <Ionicons name="search-outline" size={24} color={themeColors.textMuted} />
                        </View>
                        <View style={styles.premiumListTextContent}>
                          <Text style={[styles.premiumListTitle, { color: themeColors.text }]} numberOfLines={1}>{s.title}</Text>
                          <Text style={[styles.premiumListSubtitle, { color: themeColors.textSecondary }]} numberOfLines={1}>{s.reason}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              );
            })
          )}
          
          <Pressable style={styles.heroActionBtn} onPress={() => router.push("/product-search")}>
            <Text style={[styles.heroActionText, { color: themeColors.text }]}>Search Products</Text>
            <Ionicons name="arrow-forward" size={14} color={themeColors.textSecondary} style={{ marginLeft: 8 }} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderTimelineSection = (title: string, subtitle: string, items: UserStackItem[], icon: keyof typeof Ionicons.glyphMap) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.timelineSection}>
        <View style={styles.timelineSectionHeader}>
          <Ionicons name={icon} size={18} color={themeColors.text} style={{ marginRight: 12, marginTop: 2 }} />
          <View>
            <Text style={[styles.timelineSectionTitle, { color: themeColors.text }]}>{title}</Text>
            <Text style={[styles.timelineSectionSubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.timelineSectionContent}>
          {items.map(renderProductRow)}
        </View>
      </View>
    );
  };

  return (
    <PageContainer scrollable contentContainerStyle={styles.scrollContent}>
      {/* 1. GREETING SECTION (Aligned with Today screen) */}
      <View style={styles.greetingHeader}>
        <View>
          <Text style={[styles.greetingSub, { color: themeColors.textSecondary }]}>PROTOCOL</Text>
          <Text style={[styles.greetingTitle, { color: themeColors.text }]}>Today's Stack</Text>
          <Text style={[styles.greetingDesc, { color: themeColors.textSecondary }]}>Your active supplement routines</Text>
        </View>
        <Pressable style={[styles.headerActionCircle, { backgroundColor: themeColors.backgroundSecondary }]} onPress={() => router.push("/assistant?type=stack")}>
          <Ionicons name="sparkles" size={20} color={themeColors.text} />
        </Pressable>
      </View>

      {stackItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={styles.contentWrapper}>
          
          {/* 2. HERO CARD: Today's Protocol */}
          <View style={styles.heroWrapper}>
            <LinearGradient
              colors={colorScheme === 'dark' ? ['#1A2518', '#111111'] : ['#F0FDF4', '#FFFFFF']}
              style={styles.heroCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.heroContentRow}>
                <View style={styles.heroLeft}>
                  <Text style={[styles.heroSuperTitle, { color: themeColors.textSecondary }]}>DAILY COVERAGE</Text>
                  <Text style={[styles.heroMainTitle, { color: themeColors.text }]}>
                    {stackItems.length} Active {stackItems.length === 1 ? "Item" : "Items"}
                  </Text>
                  <Text style={[styles.heroBodyText, { color: themeColors.textSecondary }]}>
                    Supporting {supportedGoals.length} of your {trackedGoals.length} health goals.
                  </Text>
                </View>
              </View>

              <Pressable style={[styles.heroActionBtn, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]} onPress={() => router.push("/assistant?type=stack")}>
                <Ionicons name="sparkles" size={16} color={themeColors.text} style={{ marginRight: 8 }} />
                <Text style={[styles.heroActionText, { color: themeColors.text }]}>Analyze daily synergies</Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} style={{ marginLeft: 'auto' }} />
              </Pressable>
            </LinearGradient>
          </View>

          {/* 3. TIMELINE SECTIONS */}
          <View style={styles.timelineList}>
            {renderTimelineSection("Morning Routine", "Early day stack", morningItems, "sunny-outline")}
            {renderTimelineSection("Afternoon Routine", "Mid-day focus", afternoonItems, "partly-sunny-outline")}
            {renderTimelineSection("Evening Routine", "Night recovery", eveningItems, "moon-outline")}
            {renderTimelineSection("As Needed", "Symptom relief", asNeededItems, "pulse-outline")}
          </View>

        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: 140 },
  contentWrapper: {},

  // Premium List Rows
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
    paddingRight: 16,
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
  neutralStatusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.04)',
    gap: 8,
  },
  neutralStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
  },

  // Greeting Header
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 24,
    paddingTop: Spacing.xl,
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

  // Hero Card
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

  // Timelines
  timelineList: {
    paddingHorizontal: 24,
    gap: 32,
  },
  timelineSection: {
    gap: 16,
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  timelineSectionSubtitle: {
    fontSize: 13,
  },
  timelineSectionContent: {
    gap: 0,
  },

  // Empty State & Recommendations
  emptyContainer: { flex: 1, paddingHorizontal: 24 },
  emptySubtitle: { textAlign: "center", lineHeight: 20, marginBottom: 40, marginTop: 8 },
  recommendationsContainer: { width: "100%" },
  sectionTitlePrimary: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  goalGroup: { width: "100%", marginBottom: Spacing.lg },
});
