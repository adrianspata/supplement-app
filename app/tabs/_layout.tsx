import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { 
  Pressable, 
  View, 
  Text, 
  StyleSheet, 
  Alert,
  Platform,
  useWindowDimensions,
  Animated
} from "react-native";
import { GlassSurface } from "../../src/components/ui/GlassSurface";
import { useState, useRef, useEffect } from "react";
import { Colors, Shadows, BorderRadii } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const CustomTabBar = ({ 
  state, 
  navigation, 
  plusMenuVisible, 
  setPlusMenuVisible, 
  handleActionPress, 
  themeColors, 
  isDark, 
  insets,
  isCompact 
}: any) => {
  const targetTabs = ['home', 'tracker', 'stack', 'profile'];
  const routesToShow = state.routes.filter((r: any) => targetTabs.includes(r.name));
  
  const currentVisibleIndex = routesToShow.findIndex((r: any) => r.name === state.routes[state.index]?.name);
  const activeIndex = currentVisibleIndex !== -1 ? currentVisibleIndex : 0;

  const animatedIndex = useRef(new Animated.Value(activeIndex)).current;
  const plusAnim = useRef(new Animated.Value(plusMenuVisible ? 1 : 0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    if (currentVisibleIndex !== -1) {
      Animated.spring(animatedIndex, {
        toValue: currentVisibleIndex,
        useNativeDriver: true,
        friction: 8,
        tension: 65
      }).start();
    }
  }, [currentVisibleIndex]);

  useEffect(() => {
    Animated.spring(plusAnim, {
      toValue: plusMenuVisible ? 1 : 0,
      useNativeDriver: true,
      friction: 10,
      tension: 70
    }).start();
  }, [plusMenuVisible]);

  const plusMenuTranslateY = plusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });
  
  const plusRotation = plusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  const getIconName = (routeName: string, isFocused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'home': return isFocused ? 'home' : 'home-outline';
      case 'tracker': return isFocused ? 'pulse' : 'pulse-outline';
      case 'stack': return isFocused ? 'layers' : 'layers-outline';
      case 'profile': return isFocused ? 'person' : 'person-outline';
      default: return 'help-circle-outline';
    }
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case 'home': return 'Home';
      case 'tracker': return 'Tracker';
      case 'stack': return 'Stack';
      case 'profile': return 'Profile';
      default: return routeName;
    }
  };

  const renderActionItem = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void) => {
    return (
      <Pressable 
        style={({ pressed }) => [
          styles.gridItem, 
          { width: isCompact ? '48%' : '23%' },
          pressed && { opacity: 0.6 }
        ]} 
        onPress={async () => {
          try {
            if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (e) {
            // Ignore if native haptics module is not linked
          }
          onPress();
        }}
      >
        <View style={[
          styles.iconContainer, 
          { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' 
          }
        ]}>
          <Ionicons name={icon} size={22} color={themeColors.text} />
        </View>
        <Text style={[styles.gridLabel, { color: themeColors.text }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.fullScreenOverlayContainer} pointerEvents="box-none">
      {/* Background Dim Overlay */}
      <Animated.View 
        style={[
          styles.dimOverlay, 
          { 
            backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
            opacity: plusAnim
          }
        ]}
        pointerEvents={plusMenuVisible ? "auto" : "none"}
      >
        <Pressable 
          style={{ flex: 1 }}
          onPress={async () => {
            try {
              if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
              // Ignore if native haptics module is not linked
            }
            setPlusMenuVisible(false);
          }}
        />
      </Animated.View>

      {/* Action Panel */}
      <Animated.View 
        style={[
          styles.actionPanelWrapper, 
          { 
            bottom: insets.bottom + 16 + 64 + 16,
            opacity: plusAnim,
            transform: [{ translateY: plusMenuTranslateY }]
          }
        ]}
        pointerEvents={plusMenuVisible ? "box-none" : "none"}
      >
        <GlassSurface
          intensity={isDark ? 80 : 95}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.actionPanel,
            {
              backgroundColor: isDark ? 'rgba(28, 28, 30, 0.75)' : 'rgba(255, 255, 255, 0.85)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            }
          ]}
        >
          <View style={styles.gridContainer}>
            {renderActionItem("Search", "search-outline", () => handleActionPress("/product-search"))}
            {renderActionItem("Scan", "barcode-outline", () => handleActionPress("/tabs/scanner"))}
            {renderActionItem("Add", "add-circle-outline", () => handleActionPress("/tabs/stack?openAddModal=true"))}
            {renderActionItem("Check-in", "checkmark-circle-outline", () => handleActionPress("/tabs/tracker"))}
            {renderActionItem("Food", "nutrition-outline", () => handleActionPress("/tabs/tracker?openMetric=food"))}
            {renderActionItem("Sleep", "moon-outline", () => handleActionPress("/tabs/tracker?openMetric=sleep"))}
            {renderActionItem("Stress", "pulse-outline", () => handleActionPress("/tabs/tracker?openMetric=stress"))}
            {renderActionItem("Ask", "chatbubble-ellipses-outline", () => handleActionPress("/assistant", true))}
          </View>
        </GlassSurface>
      </Animated.View>

      {/* Custom Tab Bar Inner Row */}
      <View 
        style={[
          styles.tabBarInnerRow, 
          { position: 'absolute', bottom: insets.bottom + 16, left: 16, right: 16 }
        ]}
        pointerEvents="box-none"
      >
        {/* Main Floating Pill Wrapper for Shadow */}
        <View style={[styles.pillShadowWrapper, { shadowColor: isDark ? '#000' : '#888' }]}>
          <GlassSurface
            intensity={isDark ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.tabBarPill,
              {
                backgroundColor: isDark ? 'rgba(28, 28, 30, 0.65)' : 'rgba(255, 255, 255, 0.75)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              }
            ]}
          >
            <View 
              style={styles.tabItemsContainer}
              onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / routesToShow.length)}
            >
              {tabWidth > 0 && (
                <Animated.View style={[
                  styles.activeCapsule,
                  {
                    width: tabWidth,
                    transform: [{
                      translateX: animatedIndex.interpolate({
                        inputRange: routesToShow.map((_, i) => i),
                        outputRange: routesToShow.map((_, i) => i * tabWidth)
                      })
                    }]
                  }
                ]}>
                  <View style={[
                    styles.activeCapsuleInner,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }
                  ]} />
                </Animated.View>
              )}
              
              {routesToShow.map((route: any, index: number) => {
                const isFocused = activeIndex === index;
                const scale = animatedIndex.interpolate({
                  inputRange: routesToShow.map((_, i) => i),
                  outputRange: routesToShow.map((_, i) => i === index ? 1.05 : 0.95),
                  extrapolate: 'clamp'
                });
                const opacity = animatedIndex.interpolate({
                  inputRange: routesToShow.map((_, i) => i),
                  outputRange: routesToShow.map((_, i) => i === index ? 1 : 0.5),
                  extrapolate: 'clamp'
                });

                return (
                  <Pressable
                    key={route.key}
                    onPress={async () => {
                      try {
                        if (!isFocused && Platform.OS !== 'web') {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      } catch (e) {
                        // Ignore if native haptics module is not linked
                      }
                      const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                      });
                      if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                      }
                    }}
                    style={styles.tabItem}
                  >
                    <Animated.View style={{ alignItems: 'center', transform: [{ scale }], opacity }}>
                      <Ionicons
                        name={getIconName(route.name, isFocused)}
                        size={22}
                        color={isFocused ? themeColors.primary : themeColors.text}
                      />
                      <Text
                        style={[
                          styles.tabLabel,
                          { color: isFocused ? themeColors.primary : themeColors.text }
                        ]}
                      >
                        {getLabel(route.name)}
                      </Text>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          </GlassSurface>
        </View>

        {/* Floating Circular Plus Button Wrapper for Shadow */}
        <View style={[styles.plusButtonShadowWrapper, { shadowColor: isDark ? '#000' : '#888' }]}>
          <GlassSurface
            intensity={isDark ? 60 : 80}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.plusButton,
              {
                backgroundColor: isDark ? 'rgba(28, 28, 30, 0.65)' : 'rgba(255, 255, 255, 0.75)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
              }
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.plusButtonPressable,
                pressed && { opacity: 0.7 }
              ]}
              onPress={async () => {
                try {
                  if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {}
                setPlusMenuVisible(!plusMenuVisible);
              }}
            >
              <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
                <Ionicons name="add" size={28} color={themeColors.text} />
              </Animated.View>
            </Pressable>
          </GlassSurface>
        </View>
      </View>
    </View>
  );
};

export default function TabsLayout() {
  const router = useRouter();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme];

  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const isCompact = screenWidth < 400;

  const handleActionPress = (route: string, isAssistant = false) => {
    setPlusMenuVisible(false);
    
    setTimeout(() => {
      if (isAssistant) {
        try {
          router.push("/assistant");
        } catch (e) {
          Alert.alert("Ask Basis", "Ask Basis is coming soon.");
        }
      } else {
        try {
          router.push(route as any);
        } catch (e) {
          console.warn("Navigation failed:", e);
        }
      }
    }, 250);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (
          <CustomTabBar 
            {...props} 
            plusMenuVisible={plusMenuVisible}
            setPlusMenuVisible={setPlusMenuVisible}
            handleActionPress={handleActionPress}
            themeColors={themeColors}
            isDark={isDark}
            insets={insets}
            isCompact={isCompact}
          />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' }
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="tracker" />
        <Tabs.Screen name="stack" />
        <Tabs.Screen name="profile" />
        {/* Hidden screens */}
        <Tabs.Screen name="scanner" options={{ href: null }} />
        <Tabs.Screen name="pantry" options={{ href: null }} />
        <Tabs.Screen name="planner" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionPanelWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  actionPanel: {
    borderRadius: BorderRadii.xl,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridItem: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabBarInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillShadowWrapper: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  tabBarPill: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 6,
  },
  tabItemsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  activeCapsule: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    zIndex: 1,
  },
  activeCapsuleInner: {
    flex: 1,
    borderRadius: 24,
    marginHorizontal: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  plusButtonShadowWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginLeft: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  plusButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  plusButtonPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});