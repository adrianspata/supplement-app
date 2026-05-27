import React from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AuthProviderType = "apple" | "google" | "email";

interface AuthButtonProps {
  provider: AuthProviderType;
  onPress: () => void;
  loading?: boolean;
}

const PROVIDER_CONFIG = {
  apple: {
    title: "Continue with Apple",
    iconName: "logo-apple" as const,
    backgroundColor: "#1C1C1E",
    textColor: "#FFFFFF",
    borderColor: "#1C1C1E",
  },
  google: {
    title: "Continue with Google",
    iconName: "logo-google" as const,
    backgroundColor: "#FFFFFF",
    textColor: "#1C1C1E",
    borderColor: "rgba(0,0,0,0.1)",
  },
  email: {
    title: "Continue with email",
    iconName: "mail-outline" as const,
    backgroundColor: "#FFFFFF",
    textColor: "#1C1C1E",
    borderColor: "rgba(0,0,0,0.1)",
  },
};

export function AuthButton({ provider, onPress, loading = false }: AuthButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          borderWidth: provider === "apple" ? 0 : 1,
        },
        pressed && { opacity: 0.8 },
        loading && { opacity: 0.7 },
      ]}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator color={config.textColor} />
        ) : (
          <>
            <Ionicons
              name={config.iconName}
              size={20}
              color={config.textColor}
              style={styles.icon}
            />
            <Text style={[styles.text, { color: config.textColor }]}>
              {config.title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 17,
    fontWeight: "600",
  },
});
