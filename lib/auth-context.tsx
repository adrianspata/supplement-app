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

  const fetchUserData = async (userId: string, userEmail?: string | null) => {
    try {
      // Upsert profile (safety net alongside DB trigger)
      await supabase.from("profiles").upsert(
        {
          id: userId,
          email: userEmail ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: false }
      );

      // Check user_preferences for onboarding status and goals
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setOnboardingCompleted(data.completed_onboarding ?? false);
        setUserPreferences(data as UserPreferences);
      } else {
        setOnboardingCompleted(false);
        setUserPreferences(null);
      }
    } catch (e) {
      console.error("fetchUserData error:", e);
      setOnboardingCompleted(false);
      setUserPreferences(null);
    }
  };

  const refreshUserData = async () => {
    if (session) {
      await fetchUserData(session.user.id, session.user.email);
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
          await fetchUserData(session.user.id, session.user.email);
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
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await fetchUserData(newSession.user.id, newSession.user.email);
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, onboardingCompleted, initialized, userPreferences, setOnboardingCompleted, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}
