import { Slot, useRootNavigationState, useRouter, useSegments, usePathname, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth-context";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Inner component that reads context and handles routing ───────────────────

function RootGuard() {
  const { session, onboardingCompleted, initialized, userPreferences } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const pathname = usePathname();
  const params = useLocalSearchParams();

  useEffect(() => {
    const isNavigationReady = !!navigationState?.key;
    const inAuthGroup = segments[0] === "auth";
    const isOnboarding = segments[0] === "onboarding";
    const isWelcome = segments[0] === "welcome";
    const isProfileEdit = pathname === "/profile/edit-health-profile";

    const logGuard = (reason: string) => {
      console.log("[RootGuard]", {
        pathname,
        user: !!session?.user,
        initialized,
        onboardingCompleted,
        redirectReason: reason,
      });
    };

    // 1. If auth/profile/preferences are still loading: do not redirect yet.
    if (!initialized || !isNavigationReady) {
      logGuard("Waiting for initialization / navigation ready");
      return;
    }

    // 2. If user is not authenticated:
    if (!session) {
      if (!inAuthGroup && !isWelcome) {
        const redirectReason = "User not authenticated, redirecting to welcome screen";
        logGuard(redirectReason);
        router.replace("/welcome");
      } else {
        logGuard("User not authenticated, already on welcome or auth page");
      }
      return;
    }

    // 3. Logged in but onboarding status not yet loaded — do nothing (show loading)
    if (onboardingCompleted === null) {
      logGuard("Session exists but onboardingCompleted is null");
      return;
    }

    // 4. If user is authenticated and onboarding is complete:
    if (onboardingCompleted) {
      if (isProfileEdit) {
        logGuard("Staying on edit-health-profile page (onboarding is completed)");
        return;
      }

      const firstSegment = segments[0];
      const isValidAppRoute = firstSegment && ["tabs", "product-search", "product", "assistant", "profile"].includes(firstSegment);
      const isPublicOrRootRoute = inAuthGroup || isWelcome || !firstSegment || firstSegment === "onboarding";

      if (isPublicOrRootRoute) {
        const redirectReason = "Onboarding completed, on public/root/onboarding route. Redirecting to home.";
        logGuard(redirectReason);
        router.replace("/tabs/home");
      } else if (isValidAppRoute) {
        logGuard("Staying on current route. Reason: on a valid app route");
      } else {
        const redirectReason = "Onboarding completed, not on a valid app route. Redirecting to home.";
        logGuard(redirectReason);
        router.replace("/tabs/home");
      }
    } else {
      // 5. Onboarding not done → force to onboarding
      if (!isOnboarding) {
        const redirectReason = "Onboarding not completed. Redirecting to onboarding.";
        logGuard(redirectReason);
        router.replace("/onboarding");
      } else {
        logGuard("Staying on onboarding. Reason: onboarding not completed");
      }
    }
  }, [session, initialized, onboardingCompleted, segments, navigationState?.key, pathname, params]);

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
