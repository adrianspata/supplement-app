import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { getRemindersEnabled, setRemindersEnabled, syncNotifications } from "../../lib/notifications";
import { getUserStack } from "../../lib/stack";
import { getGoalAlignment } from "../../lib/alignment";
import { generateCoachState } from "../../lib/coach";
import { getAdherenceData } from "../../lib/adherence";
import { getLocalDateString } from "../../lib/adherence";
import { useAuth } from "../../lib/auth-context";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, getContentContainerStyle } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

// Designated administrator email allowlist
const ADMIN_EMAILS = [
  "adrian@basis.com", 
  "adrian@basis.app", 
  "admin@basis.app", 
  "admin@basis.com"
];

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];
  const { userPreferences, onboardingCompleted } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [remindersEnabled, setRemindersState] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  // Today's Health Signals scores
  const [sleepVal, setSleepVal] = useState<number>(0);
  const [stressVal, setStressVal] = useState<number>(0);
  const [energyVal, setEnergyVal] = useState<number>(0);
  
  // Local check-in signals
  const [localCheckIn, setLocalCheckIn] = useState<any>({});
  const [alignment, setAlignment] = useState<any>(null);
  const [planScore, setPlanScore] = useState(0);

  const goals = Array.from(new Set([
    ...(userPreferences?.primary_goals || []),
    ...(userPreferences?.health_concerns || [])
  ]));

  const hasPreferencesData = onboardingCompleted && userPreferences;

  useEffect(() => {
    fetchProfile();
    loadReminderState();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        loadHealthData(profile.id);
      }
    }, [profile?.id, userPreferences])
  );

  async function loadReminderState() {
    const enabled = await getRemindersEnabled();
    setRemindersState(enabled);
  }

  async function toggleReminders(value: boolean) {
    setRemindersState(value);
    await setRemindersEnabled(value);
    
    if (profile?.id) {
      await syncNotifications(profile.id);
    }
    
    const check = await getRemindersEnabled();
    setRemindersState(check);
  }

  async function fetchProfile() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
        loadHealthData(user.id);
      } else {
        setProfile({
          id: user.id,
          email: user.email ?? null,
          full_name: null,
          avatar_url: null,
          created_at: "",
          updated_at: "",
        });
      }
    } catch (e) {
      console.error("fetchProfile error:", e);
    } finally {
      setLoading(false);
    }
  }

  const loadHealthData = async (userId: string) => {
    try {
      const todayStr = getLocalDateString(0);
      
      const [checkInDb, stackRes, adhRes] = await Promise.all([
        supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('checkin_date', todayStr).maybeSingle(),
        getUserStack(userId),
        getAdherenceData(userId)
      ]);

      const activeStackData = stackRes || [];
      setActiveCount(activeStackData.length);

      // Load DB Check-ins (Sleep, Energy, Stress)
      if (checkInDb.data) {
        setSleepVal(checkInDb.data.sleep_score || 0);
        setStressVal(checkInDb.data.stress_score || 0);
        setEnergyVal(checkInDb.data.energy_score || 0);
      } else {
        setSleepVal(0);
        setStressVal(0);
        setEnergyVal(0);
      }

      // Load Local Check-ins
      const localKey = `@basis_checkin_${userId}_${todayStr}`;
      const savedLocal = await AsyncStorage.getItem(localKey);
      if (savedLocal) {
        setLocalCheckIn(JSON.parse(savedLocal));
      } else {
        setLocalCheckIn({});
      }

      // Load alignment gaps
      const alignData = getGoalAlignment(goals, activeStackData);
      setAlignment(alignData);

      // Plan Score Ring
      const cs = generateCoachState(adhRes, alignData, activeStackData);
      setPlanScore(cs?.hasProtocol ? cs.protocolScore : 0);

    } catch (e) {
      console.warn("Error loading profile health details", e);
    }
  };

  const scrollToSettings = () => {
    Alert.alert(
      "System & Preferences",
      "Scroll to the bottom of the Profile page to configure notifications, edit your health profile, manage data sources, or sign out.",
      [{ text: "OK" }]
    );
  };

  const showComingSoon = (feature: string) => {
    Alert.alert(
      "Coming Soon",
      `${feature} options will be configurable in a future update.`,
      [{ text: "OK" }]
    );
  };

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
          setLoading(true);
          const { error } = await supabase.auth.signOut();
          setLoading(false);
          if (error) Alert.alert("Error signing out", error.message);
        }
      }
    ]);
  }

  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getEnergyStatus = () => {
    if (energyVal === 5 || energyVal === 4) return "High";
    if (energyVal === 3) return "Moderate";
    if (energyVal === 2 || energyVal === 1) return "Low";
    return "No data yet";
  };

  const getEnergyInsight = () => {
    if (energyVal === 0) return "Start tracking daily energy";
    if (energyVal <= 2) return "Consider logging sleep and food";
    return "Good energy level";
  };

  const getGapsStatus = () => {
    if (!alignment || !alignment.underrepresentedGoals) return "No data yet";
    const gapCount = alignment.underrepresentedGoals.length;
    return gapCount > 0 ? `${gapCount} possible gap${gapCount > 1 ? 's' : ''}` : "No gaps found";
  };

  const getTodayRecommendationText = () => {
    if (goals.includes('sleep') && sleepVal === 0) {
      return "Consider reviewing magnesium timing if sleep is a focus.";
    }
    if (sleepVal === 0 || energyVal === 0) {
      return "Log sleep and energy today to improve tomorrow's recommendations.";
    }
    if (activeCount === 0) {
      return "Add timing to your stack to make your Daily Plan more useful.";
    }
    return "Review your Daily Plan to keep your stack aligned with your goals.";
  };

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || "Adrian";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile?.email?.[0] ?? "B").toUpperCase();

  const isAdmin = profile?.email ? ADMIN_EMAILS.includes(profile.email.toLowerCase()) : false;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  return (
    <PageContainer scrollable contentContainerStyle={getContentContainerStyle()}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.screenTitle, { color: themeColors.text }]}>Profile</Text>
            <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>Your health overview</Text>
          </View>
          <Pressable 
            style={[styles.settingsBtn, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
            onPress={scrollToSettings}
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
      </View>
        {/* 1. Health Profile Summary Card */}
        <View style={styles.sectionContainer}>
          {!hasPreferencesData ? (
            <SoftCard style={styles.emptySummaryCard} variant="elevated">
              <Ionicons name="sparkles-outline" size={24} color={themeColors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptySummaryTitle, { color: themeColors.text }]}>Complete your health profile</Text>
              <Text style={[styles.emptySummaryText, { color: themeColors.textSecondary }]}>
                Answer a few questions to improve your recommendations.
              </Text>
              <Pressable 
                style={[styles.emptySummaryBtn, { backgroundColor: themeColors.text }]}
                onPress={() => router.push("/onboarding")}
              >
                <Text style={[styles.emptySummaryBtnText, { color: themeColors.background }]}>Complete profile</Text>
              </Pressable>
            </SoftCard>
          ) : (
            <SoftCard style={styles.summaryCard} variant="elevated">
              <View style={styles.summaryHeader}>
                <View style={[styles.avatarWrapper, { backgroundColor: themeColors.background }]}>
                  <Text style={[styles.avatarText, { color: themeColors.text }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.displayNameText, { color: themeColors.text }]}>{displayName}</Text>
                  <Text style={[styles.emailText, { color: themeColors.textSecondary }]} numberOfLines={1}>{profile?.email}</Text>
                </View>
                <View style={styles.scoreContainer}>
                  <Text style={[styles.scoreNumber, { color: themeColors.text }]}>{planScore}</Text>
                  <Text style={[styles.scoreLabelText, { color: themeColors.textSecondary }]}>Plan Score</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={{ gap: Spacing.sm }}>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Age Range</Text>
                  <Text style={[styles.metaValue, { color: themeColors.text }]}>
                    {userPreferences?.age_range || "Not specified"}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Supplement Knowledge</Text>
                  <Text style={[styles.metaValue, { color: themeColors.text }]}>
                    {userPreferences?.supplement_knowledge_level ? capitalize(userPreferences.supplement_knowledge_level) : "Not specified"}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={[styles.focusLabel, { color: themeColors.textSecondary }]}>Focus Areas & Goals</Text>
              <View style={styles.chipRow}>
                {goals.map((g) => (
                  <View key={g} style={[styles.chip, { backgroundColor: themeColors.background }]}>
                    <Text style={[styles.chipText, { color: themeColors.text }]}>{capitalize(g.replace('_', ' '))}</Text>
                  </View>
                ))}
              </View>
            </SoftCard>
          )}
        </View>

        {/* 2. Health Signals */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Health Signals</Text>
          
          <SoftCard style={styles.signalsListCard} variant="elevated">
            {/* Sleep Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="moon-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Sleep</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {sleepVal > 0 ? "Logged today" : "Log sleep in Tracker"}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: sleepVal > 0 ? themeColors.text : themeColors.textMuted }]}>
                {sleepVal > 0 ? `Score ${sleepVal}/5` : "No data yet"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Stress Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="pulse-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Stress</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {stressVal > 0 ? "Moderate stress today" : "Breathing check-in needed"}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: stressVal > 0 ? themeColors.text : themeColors.textMuted }]}>
                {stressVal > 0 ? `${stressVal}/5` : "No data yet"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Energy Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="flash-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Energy</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {getEnergyInsight()}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: energyVal > 0 ? themeColors.text : themeColors.textMuted }]}>
                {getEnergyStatus()}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Training Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="barbell-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Training</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {localCheckIn.training ? (localCheckIn.training === 'none' ? 'Rest day logged' : 'Active workout logged') : "No workout logged"}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: localCheckIn.training ? themeColors.text : themeColors.textMuted }]}>
                {localCheckIn.training ? capitalize(localCheckIn.training === 'none' ? 'rest' : localCheckIn.training) : "No data yet"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Nutrition Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="nutrition-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Nutrition</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {localCheckIn.food ? "Meals logged today" : "Track meals in Tracker"}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: localCheckIn.food ? themeColors.text : themeColors.textMuted }]}>
                {localCheckIn.food ? capitalize(localCheckIn.food) : "No data yet"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Skin Card */}
            <Pressable style={styles.signalRow} onPress={() => router.push("/tabs/tracker")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="sparkles-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Skin</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  {localCheckIn.skin ? "Skin status logged" : "Log skin status in Tracker"}
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: localCheckIn.skin ? themeColors.text : themeColors.textMuted }]}>
                {localCheckIn.skin ? capitalize(localCheckIn.skin) : "No data yet"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Supplement Needs */}
            <Pressable style={[styles.signalRow, { borderBottomWidth: 0 }]} onPress={() => router.push("/tabs/stack")}>
              <View style={[styles.iconBox, { backgroundColor: themeColors.background }]}>
                <Ionicons name="alert-circle-outline" size={16} color={themeColors.text} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.signalLabel, { color: themeColors.text }]}>Supplement Needs</Text>
                <Text style={[styles.signalInsight, { color: themeColors.textSecondary }]}>
                  Based on goals and current stack
                </Text>
              </View>
              <Text style={[styles.signalValue, { color: alignment && alignment.underrepresentedGoals.length > 0 ? themeColors.text : themeColors.textMuted }]}>
                {getGapsStatus()}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
            </Pressable>
          </SoftCard>
        </View>

        {/* 3. Supplement Overview */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Supplement Overview</Text>
          <Pressable 
            onPress={() => {
              if (activeCount === 0) router.push("/tabs/stack");
              else router.push("/tabs/tracker");
            }}
          >
            <SoftCard style={styles.overviewCard} variant="elevated">
              <View style={styles.overviewRow}>
                <Text style={[styles.overviewLabel, { color: themeColors.text }]}>Active supplements</Text>
                <Text style={[styles.overviewValue, { color: themeColors.textSecondary }]}>{activeCount}</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={[styles.overviewLabel, { color: themeColors.text }]}>Possible gaps</Text>
                <Text style={[styles.overviewValue, { color: themeColors.textSecondary }]}>
                  {alignment?.underrepresentedGoals.length || 0}
                </Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewActionRow}>
                <Ionicons 
                  name={activeCount === 0 ? "add-circle-outline" : "stats-chart-outline"} 
                  size={16} 
                  color={themeColors.text} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.overviewActionText, { color: themeColors.text }]}>
                  Next: {activeCount === 0 ? "Build Daily Plan" : "Review your Daily Plan"}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 'auto' }} />
              </View>
            </SoftCard>
          </Pressable>
        </View>

        {/* 4. Today's Recommendation */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Today's Recommendation</Text>
          <SoftCard style={styles.recommendationCard} variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="sparkles-outline" size={16} color={themeColors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.recTitle, { color: themeColors.text }]}>Today's suggestion</Text>
            </View>
            <Text style={[styles.recText, { color: themeColors.textSecondary }]}>
              {getTodayRecommendationText()}
            </Text>
          </SoftCard>
        </View>

        {/* 5. Settings & Console Links */}
        <View style={[styles.sectionContainer, { marginBottom: 30 }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>System & Preferences</Text>
          
          <SoftCard style={{ padding: 0, overflow: "hidden", borderRadius: BorderRadii.xl }} variant="elevated">
            <Pressable 
              style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}
              onPress={() => router.push("/profile/edit-health-profile")}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="person-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: themeColors.text }]}>Edit health profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </Pressable>

            <Pressable 
              style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}
              onPress={() => showComingSoon("Health goals")}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="trophy-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: themeColors.text }]}>Health goals</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </Pressable>

            <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}>
              <View style={styles.rowLeft}>
                <Ionicons name="notifications-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: themeColors.text }]}>Notifications</Text>
              </View>
              <Switch 
                value={remindersEnabled} 
                onValueChange={toggleReminders} 
                trackColor={{ false: themeColors.backgroundSelected, true: themeColors.text }}
                thumbColor={themeColors.background}
              />
            </View>

            <Pressable 
              style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}
              onPress={() => Alert.alert("Data Sources", "Basis integrations for Apple Health, Google Fit, and WHOOP are coming in a future version.")}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="cloud-upload-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: themeColors.text }]}>Data sources</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </Pressable>

            {isAdmin && (
              <Pressable 
                style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}
                onPress={() => router.push("/admin/ingest")}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name="cloud-upload" size={18} color={themeColors.text} style={{ marginRight: 12 }} />
                  <Text style={[styles.settingLabel, { color: themeColors.text, fontWeight: '700' }]}>[Admin] Ingestion Console</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
              </Pressable>
            )}

            <Pressable 
              style={styles.settingRow}
              onPress={handleSignOut}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="log-out-outline" size={18} color={themeColors.error} style={{ marginRight: 12 }} />
                <Text style={[styles.settingLabel, { color: themeColors.error }]}>Sign out</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
            </Pressable>
          </SoftCard>
        </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerContainer: { paddingTop: Spacing.xl, paddingBottom: 8 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 140,
  },
  sectionContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  emptySummaryCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadii.xl,
  },
  emptySummaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySummaryText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  emptySummaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadii.md,
  },
  emptySummaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  displayNameText: {
    fontSize: 18,
    fontWeight: '800',
  },
  emailText: {
    fontSize: 12,
    marginTop: 1,
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabelText: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  focusLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  signalsListCard: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: BorderRadii.xl,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  signalInsight: {
    fontSize: 11,
    marginTop: 2,
  },
  signalValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  overviewCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
    gap: 12,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  overviewValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  overviewDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginVertical: 4,
  },
  overviewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  recommendationCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recText: {
    fontSize: 13,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingLabel: { fontSize: 14, fontWeight: "600" },
});
