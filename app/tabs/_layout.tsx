import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { BlurView } from "expo-blur";
import { Colors, Shadows } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const router = useRouter();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerTitle: "",
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.textMuted,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: themeColors.borderMuted,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <View
            style={{ 
              flex: 1, 
              backgroundColor: colorScheme === 'dark' ? 'rgba(17, 17, 17, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              ...Shadows.premium 
            }}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        },
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/profile")}
            style={{ marginRight: 24, marginTop: 8 }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: themeColors.border,
                backgroundColor: themeColors.backgroundElement,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person-outline" size={18} color={themeColors.text} />
            </View>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="planner"
        options={{
          title: "Stack",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tracker"
        options={{
          title: "Tracker",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse-outline" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barcode-outline" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
    
    {/* Floating Center + Button */}
    {/* We'll use a standard translucent view for the frosted effect to avoid nesting issues */}
    <View style={{
      position: 'absolute',
      bottom: 24, // Keep it slightly above the bottom line for elevation
      left: '50%',
      marginLeft: -28, 
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
      ...Shadows.premium,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 10,
      zIndex: 100,
    }}>
      <Pressable 
        style={({ pressed }) => [{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.92 : 1 }],
        }]}
        onPress={() => router.push('/product-search')}
      >
        <Ionicons name="sparkles" size={24} color="#111111" />
      </Pressable>
    </View>
  </View>
);
}