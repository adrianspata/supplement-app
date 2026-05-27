import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Complete any pending auth sessions if redirected back from the browser
WebBrowser.maybeCompleteAuthSession();

/**
 * Initiates the Apple Sign-In flow using the native Expo Apple Authentication module on iOS.
 * TODO: Ensure Apple Provider is configured in Supabase (Services ID, Team ID, Key ID, Private Key).
 */
export async function signInWithApple() {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign-In is only natively supported on iOS in this flow.");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (credential.identityToken) {
      // Send the identity token to Supabase to establish a session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      // Supabase natively handles updating user metadata if scopes are provided,
      // but you could manually update the profile using credential.fullName if needed.
      return { data, error: null };
    } else {
      throw new Error("No identityToken returned from Apple Sign-In.");
    }
  } catch (error: any) {
    if (error.code === "ERR_REQUEST_CANCELED") {
      // User canceled the sign-in flow
      return { data: null, error: new Error("Sign-in canceled") };
    }
    return { data: null, error };
  }
}

/**
 * Initiates the Google Sign-In flow using Supabase OAuth and the web browser.
 * TODO: Ensure Google Provider is configured in Supabase (Client ID and Secret).
 */
export async function signInWithGoogle() {
  try {
    const redirectUri = Linking.createURL("/auth/callback");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      console.log("[AuthProvider] signInWithGoogle WebBrowser result type:", result.type);
      
      if (result.type === "success" && result.url) {
        console.log("[AuthProvider] signInWithGoogle callback URL prefix:", result.url.split('?')[0].split('#')[0]);
        
        // Parse the URL to handle both implicit (hash) and PKCE (query) flows
        let access_token, refresh_token, code;
        
        try {
          // Expo's createURL might return ?code= or #access_token=
          const queryPart = result.url.split('?')[1]?.split('#')[0];
          const hashPart = result.url.split('#')[1];

          if (queryPart) {
            const queryParams = new URLSearchParams(queryPart);
            code = queryParams.get('code');
          }
          if (hashPart) {
            const hashParams = new URLSearchParams(hashPart);
            access_token = hashParams.get('access_token');
            refresh_token = hashParams.get('refresh_token');
          }
        } catch (err) {
          console.error("[AuthProvider] URL parsing error:", err);
        }

        console.log("[AuthProvider] Extracted tokens from URL -> access_token:", !!access_token, "refresh_token:", !!refresh_token, "code:", !!code);

        if (code) {
           console.log("[AuthProvider] Exchanging code for session...");
           const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
           if (sessionError) {
             console.error("[AuthProvider] exchangeCodeForSession error:", sessionError);
             throw sessionError;
           }
        } else if (access_token && refresh_token) {
           console.log("[AuthProvider] Setting session manually...");
           const { error: sessionError } = await supabase.auth.setSession({
             access_token,
             refresh_token,
           });
           if (sessionError) {
             console.error("[AuthProvider] setSession error:", sessionError);
             throw sessionError;
           }
        }
        
        return { data: result, error: null };
      } else {
        return { data: null, error: new Error("Authentication flow was canceled or failed.") };
      }
    }

    return { data: null, error: new Error("No URL returned for Google Sign-In.") };
  } catch (error: any) {
    return { data: null, error };
  }
}
