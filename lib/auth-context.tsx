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

      if (!error && data) {
        finalOnboardingState = data.completed_onboarding ?? false;
        finalPreferences = data as UserPreferences;
      } else {
        finalOnboardingState = false;
        finalPreferences = null;
      }
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
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        if (session) {
          await fetchUserData(session.user.id, session.user.email, session.user.user_metadata);
        } else {
          // No session — nothing to load
          setOnboardingCompleted(null);
        }
      } catch (e) {
        console.error("Supabase init error:", e);
      } finally {
        setInitialized(true);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("[AuthContext] onAuthStateChange event:", event, "hasSession:", !!newSession);
      setSession(newSession);
      if (newSession) {
        await fetchUserData(newSession.user.id, newSession.user.email, newSession.user.user_metadata);
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, onboardingCompleted, initialized, userPreferences, displayName, setOnboardingCompleted, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}
