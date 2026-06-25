import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Session } from "@supabase/supabase-js";

import { UserPreferences } from "./types";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AuthContextType = {
  session: Session | null;
  /** null = not yet loaded, true/false = known value */
  onboardingCompleted: boolean | null;
  initialized: boolean;
  userPreferences: UserPreferences | null;
  displayName: string | null;
  /** Call this after onboarding is saved to instantly update the guard state */
  setOnboardingCompleted: (value: boolean) => void;
  refreshUserData: () => Promise<void>;
};

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  session: null,
  onboardingCompleted: null,
  initialized: false,
  userPreferences: null,
  displayName: null,
  setOnboardingCompleted: () => {},
  refreshUserData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const fetchUserData = async (userId: string, userEmail?: string | null, userMetadata?: any) => {
    console.log("[AuthContext] fetchUserData started for user:", userId);
    let finalOnboardingState = false;
    let finalPreferences: UserPreferences | null = null;
    
    try {
      let extractedName = null;
      if (userMetadata) {
        extractedName = userMetadata.full_name || userMetadata.name || userMetadata.display_name || null;
      }
      setDisplayName(extractedName);

      // Upsert profile (safety net alongside DB trigger)
      try {
        const upsertPromise = supabase.from("profiles").upsert(
          {
            id: userId,
            email: userEmail ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
        const upsertTimeout = new Promise<{ error: Error }>((resolve) =>
          setTimeout(() => resolve({ error: new Error("Upsert timeout") }), 2000)
        );
        const { error: profileError } = await Promise.race([upsertPromise, upsertTimeout]);
        if (profileError) console.log("[AuthContext] Profile upsert error (ignored):", profileError);
      } catch (upsertError) {
        console.error("[AuthContext] Profile upsert threw an error:", upsertError);
      }

      // Query profiles for onboarding_completed status
      let profilesOnboardingCompleted = false;
      try {
        const { data: profileData, error: profileFetchError } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();

        if (!profileFetchError && profileData) {
          profilesOnboardingCompleted = profileData.onboarding_completed ?? false;
        }
      } catch (profileFetchErr) {
        console.error("[AuthContext] Profiles onboarding query error:", profileFetchErr);
      }

      console.log("[AuthContext] preferences query starting");
      
      const queryPromise = supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
        
      const queryTimeout = new Promise<{ data: null, error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("Preferences query timeout") }), 4000)
      );

      const { data, error } = await Promise.race([queryPromise, queryTimeout]);

      console.log("[AuthContext] preferences query resolved");
      console.log("[AuthContext] user_preferences fetch result:", { hasData: !!data, error });

      let preferencesCompleted = false;
      let hasGoals = false;

      if (!error && data) {
        preferencesCompleted = data.completed_onboarding ?? false;
        hasGoals = Array.isArray(data.primary_goals) && data.primary_goals.length > 0;
        finalPreferences = data as UserPreferences;
      } else {
        finalPreferences = null;
      }

      // Determine final onboarding state:
      if (profilesOnboardingCompleted || preferencesCompleted) {
        finalOnboardingState = true;
      } else if (hasGoals) {
        console.log("[AuthContext] Legacy recovery logic triggered: user has goals but completion flags are false. Treating as completed.");
        finalOnboardingState = true;

        // Sync both completion flags to true in the background
        Promise.all([
          supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId),
          supabase.from("user_preferences").update({ completed_onboarding: true }).eq("user_id", userId)
        ])
          .then(([profileRes, prefRes]) => {
            console.log("[AuthContext] Background sync of completion flags finished", {
              profileSyncError: profileRes.error,
              prefSyncError: prefRes.error
            });
          })
          .catch(err => {
            console.error("[AuthContext] Background sync of completion flags failed:", err);
          });
      } else {
        finalOnboardingState = false;
      }

      // Temporary debug log
      console.log("[AuthContext QA Log]", {
        userId,
        profilesOnboardingCompleted,
        preferencesCompleted,
        hasGoals,
        finalOnboardingState
      });

    } catch (e) {
      console.error("[AuthContext] fetchUserData error:", e);
      finalOnboardingState = false;
      finalPreferences = null;
    } finally {
      setOnboardingCompleted(finalOnboardingState);
      setUserPreferences(finalPreferences);
      console.log(`[AuthContext] fetchUserData finished -> onboardingCompleted: ${finalOnboardingState}`);
    }
  };

  const refreshUserData = async () => {
    if (session) {
      await fetchUserData(session.user.id, session.user.email, session.user.user_metadata);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let isFirstAuthEvent = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("[AuthContext] onAuthStateChange event:", event, "hasSession:", !!newSession);
      
      if (!isMounted) return;

      setSession(newSession);
      if (newSession) {
        await fetchUserData(newSession.user.id, newSession.user.email, newSession.user.user_metadata);
      } else {
        setOnboardingCompleted(null);
        setUserPreferences(null);
      }
      
      if (isFirstAuthEvent) {
        isFirstAuthEvent = false;
        setInitialized(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, onboardingCompleted, initialized, userPreferences, displayName, setOnboardingCompleted, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}
