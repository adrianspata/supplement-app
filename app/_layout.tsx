import { Slot, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth-context";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Inner component that reads context and handles routing ───────────────────

function RootGuard() {
  const { session, onboardingCompleted, initialized } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait until navigation is ready AND our async data is resolved
    if (!initialized || !navigationState?.key) return;

    const inAuthGroup = segments[0] === "auth";
    const isOnboarding = segments[0] === "onboarding";
    const inTabs = segments[0] === "tabs";

    if (!session) {
      // Not logged in → auth screens only
      if (!inAuthGroup) {
        router.replace("/auth/signup");
      }
      return;
    }

    // Logged in but onboarding status not yet loaded — do nothing (show loading)
    if (onboardingCompleted === null) return;

    if (onboardingCompleted) {
      // Onboarding done → redirect away from auth/onboarding/index into tabs
      if (inAuthGroup || isOnboarding || (!inTabs && segments.length === 0)) {
        router.replace("/tabs/pantry");
      }
    } else {
      // Onboarding not done → force to onboarding
      if (!isOnboarding) {
        router.replace("/onboarding");
      }
    }
  }, [session, initialized, onboardingCompleted, segments, navigationState?.key]);

  // Show a blank loading screen while resolving auth/onboarding state.
  // This prevents any flash of the wrong screen.
  if (!initialized || (session && onboardingCompleted === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FAF9F6", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#1C1C1E" />
      </View>
    );
  }

  return <Slot />;
}

// ─── Root layout wraps everything in AuthProvider ─────────────────────────────

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
    </AuthProvider>
  );
}
