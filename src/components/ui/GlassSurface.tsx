import React from "react";
import { Platform, View, ViewProps, UIManager } from "react-native";
import { BlurView } from "expo-blur";

export type GlassSurfaceProps = ViewProps & {
  intensity?: number;
  tint?: "light" | "dark" | "default";
  children: React.ReactNode;
};

// Robust runtime detection of native BlurView view manager
const isBlurViewSupported = 
  Platform.OS === "ios" &&
  typeof UIManager !== "undefined" && 
  typeof UIManager.getViewManagerConfig === "function" && 
  !!UIManager.getViewManagerConfig("ExpoBlurView");

export function GlassSurface({
  children,
  style,
  intensity = 45,
  tint = "light",
  ...props
}: GlassSurfaceProps) {
  const fallbackStyle = [
    {
      backgroundColor:
        tint === "dark" ? "rgba(20,20,24,0.72)" : "rgba(255,255,255,0.82)",
      borderWidth: 1,
      borderColor:
        tint === "dark" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)",
      borderRadius: style && (style as any).borderRadius !== undefined ? (style as any).borderRadius : 0,
    },
    style,
  ];

  if (!isBlurViewSupported) {
    return (
      <View style={fallbackStyle} {...props}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style} {...props}>
      {children}
    </BlurView>
  );
}
