import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { AssistantMessage, generateAssistantResponse, AssistantContextType } from "../lib/assistant";
import { PageContainer } from "../src/components/ui/PageContainer";
import { Colors, BorderRadii, Spacing, Shadows, getContentContainerStyle } from "../src/constants/theme";
import { useColorScheme } from "../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AssistantScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const type = (params.type as AssistantContextType) || 'general';
  const productId = params.productId as string | undefined;

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ask about your supplements, Daily Plan, scores, recommendations or stack coverage."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new message
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });
    return () => {
      showSubscription.remove();
    };
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim() || !session?.user.id) return;

    const userMsg: AssistantMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Simulate slight network delay for premium feel
      await new Promise(resolve => setTimeout(resolve, 600));

      const responseText = await generateAssistantResponse(text, {
        userId: session.user.id,
        type,
        productId
      });

      const assistantMsg: AssistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Assistant error:", error);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED_CHIPS = [
    "Why was this recommended?",
    "How can I improve my Plan Score?",
    "Review my stack",
    "Explain this ingredient",
    "What should I take today?",
  ];

  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  return (
    <PageContainer scrollable={false} contentContainerStyle={getContentContainerStyle(false)}>
      {/* Premium Minimal Header */}
      <View style={styles.header}>
        <Pressable 
          style={[styles.iconButton, { backgroundColor: themeColors.backgroundElement }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-down" size={20} color={themeColors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Basis Assistant</Text>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>Your supplement and health guide</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea} 
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isFirst = index === 0;

            if (msg.role === 'user') {
              return (
                <View key={msg.id} style={styles.userQueryContainer}>
                  <View style={[styles.userBubble, { backgroundColor: themeColors.backgroundSelected }]}>
                    <Text style={[styles.userMessageText, { color: themeColors.text }]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              );
            }

            if (isFirst) {
              return (
                <View 
                  key={msg.id} 
                  style={[
                    styles.introCard, 
                    { 
                      backgroundColor: themeColors.backgroundSecondary, 
                      borderColor: themeColors.borderMuted,
                      ...Shadows.low 
                    }
                  ]}
                >
                  <View style={styles.introHeader}>
                    <View style={[styles.introIconCircle, { backgroundColor: themeColors.backgroundSelected }]}>
                      <Ionicons name="sparkles" size={16} color={themeColors.text} />
                    </View>
                    <Text style={[styles.introTitle, { color: themeColors.text }]}>Basis Assistant</Text>
                  </View>
                  <Text style={[styles.introBody, { color: themeColors.textSecondary }]}>
                    {msg.content}
                  </Text>
                </View>
              );
            }

            return (
              <View 
                key={msg.id} 
                style={[
                  styles.aiResponseCard, 
                  { 
                    backgroundColor: themeColors.backgroundSecondary, 
                    borderColor: themeColors.borderMuted,
                    ...Shadows.low 
                  }
                ]}
              >
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={14} color={themeColors.textSecondary} />
                  <Text style={[styles.aiTitle, { color: themeColors.textSecondary }]}>Basis Assistant</Text>
                </View>
                <Text style={[styles.aiResponseText, { color: themeColors.text }]}>
                  {msg.content}
                </Text>
              </View>
            );
          })}
          
          {loading && (
            <View style={styles.loadingContainer}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={14} color={themeColors.textSecondary} />
                <Text style={[styles.aiTitle, { color: themeColors.textSecondary }]}>Thinking</Text>
              </View>
              <ActivityIndicator size="small" color={themeColors.textSecondary} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            </View>
          )}
        </ScrollView>

        {/* Floating Input Area */}
        <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {SUGGESTED_CHIPS.map(chip => (
              <Pressable 
                key={chip} 
                style={[
                  styles.chip, 
                  { 
                    backgroundColor: themeColors.backgroundSecondary,
                    borderColor: themeColors.border,
                    ...Shadows.low
                  }
                ]}
                onPress={() => handleSend(chip)}
                disabled={loading}
              >
                <Text style={[styles.chipText, { color: themeColors.textSecondary }]}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputPillContainer}>
            <View style={[
              styles.inputPill, 
              { 
                backgroundColor: themeColors.backgroundSecondary, 
                borderColor: themeColors.border,
                shadowColor: '#000',
              }
            ]}>
              <TextInput
                style={[styles.textInput, { color: themeColors.text }]}
                placeholder="Ask anything..."
                placeholderTextColor={themeColors.textMuted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => handleSend(input)}
                returnKeyType="send"
                editable={!loading}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 150);
                }}
              />
              <Pressable 
                style={[
                  styles.sendBtn, 
                  { backgroundColor: themeColors.text }, 
                  (!input.trim() || loading) && { opacity: 0.2 }
                ]}
                onPress={() => handleSend(input)}
                disabled={!input.trim() || loading}
              >
                <Ionicons name="arrow-up" size={18} color={themeColors.backgroundSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: { 
    fontSize: 16, 
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  placeholder: { width: 40, height: 40 },
  keyboardView: { flex: 1 },
  chatArea: { flex: 1 },
  chatContent: { paddingBottom: 40, paddingTop: 20 },
  
  introCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
    marginBottom: 24,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  introIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  introBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  userQueryContainer: {
    alignSelf: "flex-end",
    marginBottom: 24,
    marginTop: 8,
    maxWidth: "85%",
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadii.xl,
    borderBottomRightRadius: BorderRadii.sm,
  },
  userMessageText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "400",
  },

  aiResponseCard: {
    marginBottom: 24,
    padding: 20,
    borderRadius: BorderRadii.xl,
    borderWidth: 1,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  aiTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  aiResponseText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "400",
  },

  loadingContainer: {
    padding: 20,
    marginBottom: 24,
  },

  bottomArea: {
    paddingTop: 12,
  },
  chipsScroll: {
    marginBottom: 12,
  },
  chipsContent: {
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputPillContainer: {
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    paddingLeft: 20,
    paddingRight: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "400",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
});
