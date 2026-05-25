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
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";
import { getRemindersEnabled, setRemindersEnabled, syncNotifications } from "../lib/notifications";

export default function ProfileScreen() {
  const router = useRouter();
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
    
    // Refresh state in case permissions were denied and it reverted
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
      } else {
        // Fallback: show at least the auth email
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
    // _layout.tsx onAuthStateChange will redirect to auth/signup
  }

  const displayName = profile?.full_name || profile?.email || "—";
  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (profile?.email?.[0] ?? "?").toUpperCase();

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1C1C1E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Avatar + Name card */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {profile?.full_name && profile.email ? (
            <Text style={styles.emailText}>{profile.email}</Text>
          ) : null}
        </View>

        {/* Settings rows */}
        <View style={styles.settingsGroup}>
          <Text style={styles.settingsTitle}>Account Settings</Text>

          <Pressable style={styles.settingRow}>
            <Text style={styles.settingLabel}>Edit Profile</Text>
            <Text style={styles.settingArrow}>→</Text>
          </Pressable>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Enable Reminders</Text>
            <Switch 
              value={remindersEnabled} 
              onValueChange={toggleReminders} 
              trackColor={{ false: "#EBEAE4", true: "#34C759" }}
            />
          </View>

          <Pressable style={styles.settingRow}>
            <Text style={styles.settingLabel}>Privacy & Security</Text>
            <Text style={styles.settingArrow}>→</Text>
          </Pressable>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && { opacity: 0.8 },
            signingOut && { opacity: 0.5 },
          ]}
        >
          {signingOut ? (
            <ActivityIndicator color="#FF3B30" />
          ) : (
            <Text style={styles.signOutText}>Log Out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    borderRadius: 20,
    backgroundColor: "#EBEAE4",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: { fontSize: 20, color: "#1C1C1E" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  backBtnPlaceholder: { width: 40, height: 40 },
  content: { flex: 1, paddingHorizontal: 24 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#FFF" },
  displayName: { fontSize: 18, fontWeight: "700", color: "#1C1C1E" },
  emailText: { fontSize: 14, color: "#636366", marginTop: 4 },
  settingsGroup: { marginBottom: 40 },
  settingsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  settingLabel: { fontSize: 17, fontWeight: "500", color: "#1C1C1E" },
  settingArrow: { fontSize: 17, color: "#8E8E93" },
  signOutBtn: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FF3B30",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    marginBottom: 40,
  },
  signOutText: { color: "#FF3B30", fontSize: 17, fontWeight: "700" },
});
