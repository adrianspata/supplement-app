import { View, ActivityIndicator } from "react-native";

export default function Index() {
  // Let the _layout.tsx handle the routing based on auth state
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#FAF9F6' }}>
      <ActivityIndicator size="large" color="#1C1C1E" />
    </View>
  );
}
