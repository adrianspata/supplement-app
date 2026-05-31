import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { getRemindersEnabled, setRemindersEnabled, syncNotifications } from "../lib/notifications";
import { PageContainer } from "../src/components/ui/PageContainer";
import { SoftCard } from "../src/components/ui/SoftCard";
import { PremiumButton } from "../src/components/ui/PremiumButton";
import { Colors, Spacing, BorderRadii } from "../src/constants/theme";
import { useColorScheme } from "../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [remindersEnabled, setRemindersState] = useState(false);

  useEffect(() => {
    fetchProfile();
    loadReminderState();
  }, []);

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
        userError,
      } = await supabase.auth.getUser() as any;

      if (userError || !user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
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

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      Alert.alert("Error signing out", error.message);
    }
  }

  const displayName = profile?.full_name || profile?.email || "—";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile?.email?.[0] ?? "?").toUpperCase();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="small" color={themeColors.text} />
      </View>
    );
  }

  return (
    <PageContainer scrollable contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back-outline" size={24} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Identity Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Profile Card */}
      <SoftCard style={styles.profileCard}>
        <View style={[styles.avatarContainer, { backgroundColor: themeColors.backgroundSelected }]}>
          <Text style={[styles.avatarText, { color: themeColors.text }]}>{initials}</Text>
        </View>
        <Text style={[styles.displayName, { color: themeColors.text }]}>{displayName}</Text>
        {profile?.full_name && profile.email ? (
          <Text style={[styles.emailText, { color: themeColors.textSecondary }]}>{profile.email}</Text>
        ) : null}
      </SoftCard>

      {/* Settings Options */}
      <View style={styles.settingsSection}>
        <Text style={[styles.settingsTitle, { color: themeColors.textMuted }]}>Preferences & System</Text>
        
        <SoftCard style={{ padding: 0, overflow: "hidden" }}>
          <Pressable style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Profile Details</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
          </Pressable>

          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Reminders</Text>
            </View>
            <Switch 
              value={remindersEnabled} 
              onValueChange={toggleReminders} 
              trackColor={{ false: themeColors.backgroundElement, true: themeColors.text }}
              thumbColor={themeColors.background}
            />
          </View>

          <Pressable style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: themeColors.borderMuted }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-outline" size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>Privacy & Trust</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
          </Pressable>

          <Pressable 
            style={styles.settingRow}
            onPress={() => router.push("/admin/ingest")}
          >
            <View style={styles.rowLeft}>
              <Ionicons name="cloud-upload-outline" size={18} color={themeColors.text} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>[Admin] Ingestion Console</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
          </Pressable>
        </SoftCard>
      </View>

      {/* Logout Action */}
      <View style={styles.footerAction}>
        <PremiumButton 
          title="Sign Out" 
          onPress={handleSignOut}
          variant="secondary"
          style={{ width: "100%" }}
        />
      </View>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 60 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  profileCard: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 26, fontWeight: "700" },
  displayName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.2 },
  emailText: { fontSize: 14, marginTop: 4 },
  
  settingsSection: {
    marginHorizontal: 24,
    marginTop: 12,
  },
  settingsTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingLabel: { fontSize: 16, fontWeight: "500" },
  footerAction: {
    paddingHorizontal: 24,
    marginTop: 40,
  },
});
