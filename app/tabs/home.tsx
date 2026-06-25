import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { RecommendedProduct, DailyCheckIn } from "../../lib/types";
import { getRecommendedProducts } from "../../lib/products";
import { getUserStack } from "../../lib/stack";
import { getGoalAlignment, AlignmentResult } from "../../lib/alignment";
import { generateCoachState, CoachState } from "../../lib/coach";
import { useAuth } from "../../lib/auth-context";
import { getTodayCheckIn } from "../../lib/checkins";
import { getAdherenceData } from "../../lib/adherence";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, getContentContainerStyle } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];
  const { userPreferences } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [coachState, setCoachState] = useState<CoachState | null>(null);
  const [alignment, setAlignment] = useState<AlignmentResult | null>(null);
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn | null>(null);

  const goals = userPreferences?.primary_goals || [];

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
      if (userId) {
        fetchDashboardData();
      }
    }, [userId])
  );

  const fetchDashboardData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const userGoals = Array.from(new Set([
        ...(userPreferences?.primary_goals || []),
        ...(userPreferences?.health_concerns || [])
      ]));

      const [recRes, stackRes, checkinRes, adhRes] = await Promise.all([
        getRecommendedProducts(
          userId, 
          userPreferences?.primary_goals || [], 
          userPreferences?.health_concerns || [], 
          userPreferences?.current_supplements || userPreferences?.existing_supplements || [], 
          userPreferences?.diet_type
        ),
        getUserStack(userId),
        getTodayCheckIn(userId),
        getAdherenceData(userId),
      ]);

      setRecommendedProducts(recRes.slice(0, 3));
      setTodayCheckIn(checkinRes);

      const activeStackData = stackRes || [];
      const alignData = getGoalAlignment(userGoals, activeStackData);
      setAlignment(alignData);
      
      const cs = generateCoachState(adhRes, alignData, activeStackData);
      setCoachState(cs);
    } catch (e) {
      console.warn("Error fetching dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const getTodayDateString = () => {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return "U";
  };

  const getStressEnergyStatus = () => {
    if (!todayCheckIn) return "No data yet";
    const energy = todayCheckIn.energy_score || 0;
    const stress = todayCheckIn.stress_score || 0;
    
    if (stress >= 4) return "High Stress";
    if (energy <= 2) return "Low Energy";
    return "Balanced";
  };

  const getSleepStatus = () => {
    if (!todayCheckIn?.sleep_score) return "No data yet";
    const score = todayCheckIn.sleep_score;
    if (score >= 4) return "Good";
    if (score === 3) return "Fair";
    return "Low";
  };

  const getGapsStatus = () => {
    if (!alignment || !alignment.underrepresentedGoals) return "No data yet";
    const gapCount = alignment.underrepresentedGoals.length;
    return gapCount > 0 ? `${gapCount} possible gap${gapCount > 1 ? 's' : ''}` : "No gaps found";
  };

  const getGapsInsight = () => {
    if (!alignment || !alignment.underrepresentedGoals) return "Build stack to check gaps";
    const gaps = alignment.underrepresentedGoals;
    if (gaps.length === 0) return "All goals supported";
    
    const formattedGaps = gaps.map(g => g.charAt(0).toUpperCase() + g.slice(1));
    if (formattedGaps.length <= 2) {
      return formattedGaps.join(", ");
    }
    return `${formattedGaps.slice(0, 2).join(", ")} +${formattedGaps.length - 2} more`;
  };

  const renderCoachSection = () => {
    const hasPlan = coachState?.hasProtocol;
    const activeCoachInsight = coachState?.priorities[0];
    const score = hasPlan ? coachState.protocolScore : 0;

    return (
      <View style={styles.heroWrapper}>
        <SoftCard style={styles.heroCard} variant="elevated">
          {hasPlan ? (
            <View style={styles.heroContentRow}>
              <View style={styles.heroLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="sparkles" size={14} color={themeColors.success} style={{ marginRight: 6 }} />
                  <Text style={[styles.heroSuperTitle, { color: themeColors.success }]}>Basis Coach</Text>
                </View>
                <Text style={[styles.heroMainTitle, { color: themeColors.text }]}>
                  {activeCoachInsight?.title || "Daily Plan Active"}
                </Text>
                <Text style={[styles.heroBodyText, { color: themeColors.textSecondary }]}>
                  {activeCoachInsight?.message || "Stay consistent with your daily items to reach your goals."}
                </Text>
              </View>

              <View style={styles.heroRight}>
                <View style={[styles.scoreRingBackground, { borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                  <Text style={[styles.scoreValue, { color: themeColors.text }]}>{score}</Text>
                  <Text style={[styles.scoreLabel, { color: themeColors.textSecondary }]}>Plan Score</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.heroContentRowEmpty}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="sparkles" size={14} color={themeColors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.heroSuperTitle, { color: themeColors.textSecondary }]}>Basis Coach</Text>
                </View>
                <Text style={[styles.heroMainTitle, { color: themeColors.text }]}>
                  Build your Daily Plan
                </Text>
                <Text style={[styles.heroBodyText, { color: themeColors.textSecondary, marginBottom: 12 }]}>
                  Create a simple routine for supplements, sleep, energy and recovery.
                </Text>
              </View>
            </View>
          )}

          <Pressable 
            style={[styles.heroActionBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} 
            onPress={() => {
              if (hasPlan) {
                router.push("/tabs/tracker");
              } else {
                router.push("/tabs/stack?openAddModal=true");
              }
            }}
          >
            <Ionicons name={hasPlan ? "stats-chart" : "add-circle-outline"} size={16} color={themeColors.text} style={{ marginRight: 8 }} />
            <Text style={[styles.heroActionText, { color: themeColors.text }]}>
              {hasPlan ? "Open Today's Plan" : "Build Plan"}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} style={{ marginLeft: 'auto' }} />
          </Pressable>
        </SoftCard>
      </View>
    );
  };

  if (loading && !coachState) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  return (
    <PageContainer scrollable contentContainerStyle={getContentContainerStyle()}>
      {/* Header with Bevel structure */}
      <View style={styles.headerSection}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.dateTitle, { color: themeColors.text }]}>
              Today, {getTodayDateString()}
            </Text>
            <Text style={[styles.subDateText, { color: themeColors.textSecondary }]}>
              Daily Health Overview
            </Text>
          </View>
          <View style={styles.headerRightActions}>
            <Pressable 
              style={[styles.headerActionButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
              onPress={() => router.push("/product-search")}
            >
              <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} />
            </Pressable>
            <Pressable 
              style={[styles.avatarButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
              onPress={() => router.push("/tabs/profile")}
            >
              <Text style={[styles.avatarInitials, { color: themeColors.text }]}>{getUserInitials()}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Daily Plan / Coach Card */}
      {renderCoachSection()}

      {/* Bevel Health Status Grid */}
      <View style={styles.gridContainer}>
        {/* Row 1 */}
        <View style={styles.gridRow}>
          {/* Card A: Stress & Energy */}
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => router.push("/tabs/tracker")}
          >
            <SoftCard style={styles.gridCard} variant="elevated">
              <View style={styles.cardHeader}>
                <Ionicons name="flash-outline" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>Stress & Energy</Text>
              </View>
              <Text style={[styles.cardMainValue, { color: themeColors.text }]} numberOfLines={1}>
                {getStressEnergyStatus()}
              </Text>
              <Text style={[styles.cardInsight, { color: themeColors.textMuted }]}>
                {todayCheckIn ? "Based on today's check-in" : "Start tracking energy"}
              </Text>
            </SoftCard>
          </Pressable>

          {/* Card B: Sleep */}
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => router.push("/tabs/tracker")}
          >
            <SoftCard style={styles.gridCard} variant="elevated">
              <View style={styles.cardHeader}>
                <Ionicons name="moon-outline" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>Sleep</Text>
              </View>
              <Text style={[styles.cardMainValue, { color: themeColors.text }]} numberOfLines={1}>
                {getSleepStatus()}
              </Text>
              <Text style={[styles.cardInsight, { color: themeColors.textMuted }]}>
                {todayCheckIn?.sleep_score ? `Sleep score ${todayCheckIn.sleep_score}/5` : "Start tracking sleep"}
              </Text>
            </SoftCard>
          </Pressable>
        </View>

        {/* Row 2 */}
        <View style={styles.gridRow}>
          {/* Card C: Supplement Gaps */}
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => router.push("/tabs/profile")}
          >
            <SoftCard style={styles.gridCard} variant="elevated">
              <View style={styles.cardHeader}>
                <Ionicons name="alert-circle-outline" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>Supplement Gaps</Text>
              </View>
              <Text style={[styles.cardMainValue, { color: themeColors.text }]} numberOfLines={1}>
                {getGapsStatus()}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.cardInsight, { color: themeColors.textMuted, flex: 1 }]} numberOfLines={1}>
                  {getGapsInsight()}
                </Text>
                <Text style={[styles.viewGapsLink, { color: themeColors.textSecondary }]}>View</Text>
              </View>
            </SoftCard>
          </Pressable>

          {/* Card D: Recommendations */}
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => router.push("/tabs/tracker")}
          >
            <SoftCard style={styles.gridCard} variant="elevated">
              <View style={styles.cardHeader}>
                <Ionicons name="sparkles-outline" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>Recommendations</Text>
              </View>
              <View style={styles.recListMini}>
                <Text style={[styles.recListItem, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  ☀️ Sunlight: 10m morning
                </Text>
                <Text style={[styles.recListItem, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  💧 Hydrate: 500ml water
                </Text>
                <Text style={[styles.recListItem, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  💊 Vitamin D: With fats
                </Text>
              </View>
            </SoftCard>
          </Pressable>
        </View>
      </View>

      {/* Product Search Bar */}
      <View style={styles.searchBlockContainer}>
        <Pressable 
          style={[styles.searchBlock, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
          onPress={() => router.push("/product-search")}
        >
          <Ionicons name="search-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
          <Text style={[styles.searchBlockPlaceholder, { color: themeColors.textSecondary }]}>
            Search products, brands or ingredients
          </Text>
        </Pressable>
      </View>

      {/* Recommended for You section */}
      <View style={styles.recSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
          Recommended for you
        </Text>

        {goals.length === 0 ? (
          <SoftCard style={styles.emptyRecCard} variant="elevated">
            <Text style={[styles.emptyRecText, { color: themeColors.textSecondary }]}>
              Complete your profile to get recommendations.
            </Text>
          </SoftCard>
        ) : recommendedProducts.length === 0 ? (
          <SoftCard style={styles.emptyRecCard} variant="elevated">
            <Text style={[styles.emptyRecText, { color: themeColors.textSecondary }]}>
              Complete your profile to get recommendations.
            </Text>
          </SoftCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {recommendedProducts.map((rec) => (
              <Pressable 
                key={rec.product.id} 
                style={[styles.recProductCard, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.borderMuted }]}
                onPress={() => router.push(`/product/${rec.product.id}`)}
              >
                <View style={[styles.recIconWrapper, { backgroundColor: themeColors.background }]}>
                  <Ionicons name="flask-outline" size={18} color={themeColors.text} />
                </View>
                <Text style={[styles.recProductName, { color: themeColors.text }]} numberOfLines={1}>
                  {rec.product.name}
                </Text>
                <Text style={[styles.recProductBrand, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {rec.product.brand || "Synergy support"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: 140 },
  headerSection: {
    paddingTop: Spacing.xl,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subDateText: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '800',
  },
  heroWrapper: {
    marginBottom: 16,
  },
  heroCard: {
    padding: 20,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: BorderRadii.xl,
    elevation: 0,
    shadowOpacity: 0.02,
  },
  heroContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroContentRowEmpty: {
    marginBottom: 4,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  heroSuperTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 4,
    lineHeight: 24,
  },
  heroBodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingBackground: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: -2,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadii.md,
    borderWidth: 1,
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Grid
  gridContainer: {
    gap: 8,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCard: {
    flex: 1,
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 16,
    borderRadius: BorderRadii.lg,
    minHeight: 115,
    justifyContent: 'space-between',
    elevation: 0,
    shadowOpacity: 0.02,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardMainValue: {
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 6,
    letterSpacing: -0.2,
  },
  cardInsight: {
    fontSize: 11,
    fontWeight: '500',
  },
  viewGapsLink: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
    textDecorationLine: 'underline',
  },
  recListMini: {
    marginTop: 4,
    gap: 2,
  },
  recListItem: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Search Block
  searchBlockContainer: {
    marginBottom: 20,
  },
  searchBlock: {
    height: 52,
    borderRadius: BorderRadii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  searchBlockPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Recommended preview
  recSection: {
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 12,
    marginLeft: 2,
  },
  emptyRecCard: {
    marginHorizontal: 0,
    padding: 20,
    borderRadius: BorderRadii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
    shadowOpacity: 0.01,
  },
  emptyRecText: {
    fontSize: 13,
    fontWeight: '500',
  },
  horizontalScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  recProductCard: {
    width: 140,
    padding: 14,
    borderRadius: BorderRadii.lg,
    borderWidth: 1,
  },
  recIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  recProductName: {
    fontSize: 13,
    fontWeight: '700',
  },
  recProductBrand: {
    fontSize: 11,
    marginTop: 2,
  },
});
