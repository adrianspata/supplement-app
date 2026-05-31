import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useRef, useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View, Animated, Easing, Platform, UIManager, Linking } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../lib/supabase";
import { SurfaceCard } from "../../src/components/ui/SurfaceCard";
import { Colors, Spacing, BorderRadii, Typography, Shadows, Atmospheres, BlurLevels } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";

const isBlurViewSupported = typeof UIManager !== "undefined" && 
  typeof UIManager.getViewManagerConfig === "function" && 
  !!UIManager.getViewManagerConfig("ExpoBlurView");

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  // Restrained pulse animation for the targeting ring (Hero Surface)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (permission?.granted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.98,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [permission?.granted]);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: Colors.dark.background }} />;
  }

  const handleRequestPermission = async () => {
    if (permission.status === 'denied' && !permission.canAskAgain) {
      Alert.alert(
        "Permission Required",
        "Elexir requires camera access to scan physical supplement packaging and labels. Please enable it in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
    } else {
      await requestPermission();
    }
  };

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={styles.permissionContainer}>
          <View style={[styles.iconGlowWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="camera-outline" size={40} color={themeColors.text} />
          </View>
          <Text style={[styles.permissionTitle, { color: themeColors.text }]}>
            Hardware Access
          </Text>
          <Text style={[styles.permissionSubtitle, { color: themeColors.textSecondary }]}>
            Elexir requires camera access to scan physical supplement packaging and labels.
          </Text>
          <Pressable
            style={[styles.allowBtnCard, { backgroundColor: themeColors.text }]}
            onPress={handleRequestPermission}
          >
            <Text style={[styles.allowBtnText, { color: themeColors.background }]}>
              Enable Camera
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    const { data: product, error } = await supabase
      .from("supplements")
      .select("*")
      .eq("barcode", data)
      .maybeSingle();

    if (error) {
      Alert.alert("Error", error.message);
      setScanned(false);
      return;
    }

    if (!product) {
      Alert.alert(
        "Product not found",
        "Add this product manually to your Health Cabinet.",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return;
    const user = authData.user;

    const { error: insertError } = await supabase.from("user_supplements").insert({
      user_id: user.id,
      supplement_id: product.id,
      custom_name: product.name,
      capsules_total: 60,
      capsules_remaining: 60,
      daily_dose: 1,
      intake_time: "Morning",
    });

    if (insertError) {
      Alert.alert("Could not add product", insertError.message);
      setScanned(false);
      return;
    }

    Alert.alert(
      "Added to Cabinet ✓",
      `${product.name} has been added to your Health Cabinet.`,
      [{ text: "OK", onPress: () => setScanned(false) }]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View style={styles.maskContainer}>
        {/* Soft, rounded frame with grey corner markers */}
        <Animated.View style={[
          styles.scannerRing,
          { 
            backgroundColor: scanned ? 'rgba(48, 209, 88, 0.05)' : 'transparent',
            transform: [{ scale: pulseAnim }]
          }
        ]}>
          {/* Subtle green glow in center */}
          <LinearGradient
            colors={scanned ? ['rgba(48, 209, 88, 0.4)', 'transparent'] : ['rgba(48, 209, 88, 0.15)', 'transparent']}
            style={styles.centerGlow}
          />
          
          <View style={[styles.cornerMarker, styles.cornerTL, { borderColor: scanned ? themeColors.success : '#fff' }]} />
          <View style={[styles.cornerMarker, styles.cornerTR, { borderColor: scanned ? themeColors.success : '#fff' }]} />
          <View style={[styles.cornerMarker, styles.cornerBL, { borderColor: scanned ? themeColors.success : '#fff' }]} />
          <View style={[styles.cornerMarker, styles.cornerBR, { borderColor: scanned ? themeColors.success : '#fff' }]} />
        </Animated.View>

        <View style={styles.guidanceContainer}>
          <Text style={styles.guidanceTitle}>
            {scanned ? "Processing Product" : "Align barcode"}
          </Text>
          <Text style={styles.guidanceSubtitle}>
            {scanned 
              ? "Fetching formulation and syncing with your Elexir profile..."
              : "Point the camera at a supplement barcode\nto analyze its contents."
            }
          </Text>
        </View>

        <View style={styles.bottomControls}>
          <Pressable style={styles.sideControlBtn}>
            <Ionicons name="image-outline" size={24} color="#fff" />
          </Pressable>
          <Pressable style={styles.shutterBtn}>
            <View style={styles.shutterBtnInner} />
          </Pressable>
          <Pressable style={styles.sideControlBtn}>
            <Ionicons name="flashlight-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.topHeader, { top: insets.top + Spacing.sm }]}>
        <View style={styles.topHeaderRow}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          
          <View style={styles.statusBadge}>
            <View style={[styles.statusIndicator, { backgroundColor: scanned ? themeColors.success : '#30D158' }]} />
            <Text style={[styles.statusText, { color: 'white' }]}>
              {scanned ? "DETECTED" : "SCANNER ACTIVE"}
            </Text>
          </View>

          <Pressable style={styles.iconBtn}>
            <Ionicons name="person-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <View style={[styles.modePill, styles.modePillActive]}>
            <Ionicons name="barcode-outline" size={16} color="#000" />
            <Text style={styles.modeTextActive}>Barcode</Text>
          </View>
          <View style={styles.modePill}>
            <Ionicons name="camera-outline" size={16} color="#fff" />
            <Text style={styles.modeTextInactive}>Photo</Text>
          </View>
          <View style={styles.modePill}>
            <Ionicons name="images-outline" size={16} color="#fff" />
            <Text style={styles.modeTextInactive}>Shelf</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconGlowWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: "center",
  },
  permissionSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  allowBtnCard: {
    height: 56,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    width: "100%",
  },
  allowBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },

  maskContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
    paddingBottom: 40,
  },
  scannerRing: {
    width: 300,
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  centerGlow: {
    width: 200,
    height: 200,
    borderRadius: 100,
    position: "absolute",
  },
  cornerMarker: {
    position: "absolute",
    width: 40,
    height: 40,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 32,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 32,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 32,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 32,
  },

  guidanceContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  guidanceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  guidanceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },

  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 280,
  },
  sideControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterBtnInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#fff",
  },

  topHeader: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "center",
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 24,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  modeSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    padding: 4,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  modePillActive: {
    backgroundColor: "#fff",
  },
  modeTextActive: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginLeft: 6,
  },
  modeTextInactive: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 6,
  },
});