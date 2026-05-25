import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionSubtitle}>
            Elexir needs camera access to scan supplement barcodes and labels.
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [styles.allowBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.allowBtnText}>Allow Camera Access</Text>
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
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Scan frame overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
      </View>

      {/* Bottom info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Scan supplement barcode</Text>
        <Text style={styles.infoSubtitle}>
          Point your camera at a supplement label or barcode to add it to your Health Cabinet.
        </Text>
        {scanned && (
          <Pressable
            onPress={() => setScanned(false)}
            style={styles.scanAgainBtn}
          >
            <Text style={styles.scanAgainText}>Scan again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },

  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  permissionIcon: { fontSize: 56, marginBottom: 24 },
  permissionTitle: { fontSize: 24, fontWeight: "800", color: "#1C1C1E", marginBottom: 12, textAlign: "center" },
  permissionSubtitle: { fontSize: 15, color: "#636366", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  allowBtn: {
    backgroundColor: "#1C1C1E",
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  allowBtnText: { color: "#FFF", fontSize: 17, fontWeight: "700" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "transparent",
  },

  infoCard: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  infoTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E", textAlign: "center", marginBottom: 6 },
  infoSubtitle: { fontSize: 13, color: "#636366", textAlign: "center", lineHeight: 18 },
  scanAgainBtn: {
    marginTop: 14,
    backgroundColor: "#1C1C1E",
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: "center",
  },
  scanAgainText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});