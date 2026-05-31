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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { AssistantMessage, generateAssistantResponse, AssistantContextType } from "../lib/assistant";
import { PageContainer } from "../src/components/ui/PageContainer";
import { SoftCard } from "../src/components/ui/SoftCard";
import { Colors, BorderRadii, Spacing, Shadows, Typography } from "../src/constants/theme";
import { useColorScheme } from "../src/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

export default function AssistantScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  
  const type = (params.type as AssistantContextType) || 'general';
  const productId = params.productId as string | undefined;

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi. I'm your Clinical Assistant.\nI can explain recommendations, break down your scores, and analyze your stack coverage. How can I help you today?"
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
    "Why is my score 87?",
    "Ingredient breakdown",
    "Missing areas in my stack?",
  ];

  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  const themeColors = Colors[colorScheme];

  return (
    <PageContainer scrollable={false}>
      {/* Premium Minimal Header */}
      <View style={styles.header}>
        <Pressable 
          style={[styles.iconButton, { backgroundColor: themeColors.backgroundElement }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-down" size={20} color={themeColors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="sparkles" size={14} color={themeColors.text} />
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Intelligence Layer</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                  <Text style={[styles.userQueryText, { color: themeColors.text }]}>
                    {msg.content}
                  </Text>
                </View>
              );
            }

            if (isFirst) {
              return (
                <View key={msg.id} style={styles.heroContainer}>
                  <View style={[styles.heroIconCircle, { backgroundColor: themeColors.backgroundSelected }]}>
                    <Ionicons name="sparkles" size={32} color={themeColors.text} />
                  </View>
                  <Text style={[styles.heroText, { color: themeColors.text }]}>{msg.content}</Text>
                </View>
              );
            }

            return (
              <SoftCard key={msg.id} style={[styles.aiResponseCard, { backgroundColor: themeColors.background }]}>
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={14} color={themeColors.text} />
                  <Text style={[styles.aiTitle, { color: themeColors.text }]}>Elexir AI</Text>
                </View>
                <Text style={[styles.aiResponseText, { color: themeColors.text }]}>
                  {msg.content}
                </Text>
              </SoftCard>
            );
          })}
          
          {loading && (
            <View style={styles.loadingContainer}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={14} color={themeColors.text} />
                <Text style={[styles.aiTitle, { color: themeColors.text }]}>Thinking</Text>
              </View>
              <ActivityIndicator size="small" color={themeColors.text} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
            </View>
          )}
        </ScrollView>

        {/* Floating Input Area */}
        <View style={styles.bottomArea}>
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
                    backgroundColor: themeColors.background,
                    borderColor: themeColors.borderMuted,
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
                backgroundColor: themeColors.background, 
                borderColor: themeColors.borderMuted,
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
                <Ionicons name="arrow-up" size={18} color={themeColors.background} />
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: { 
    fontSize: 14, 
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  placeholder: { width: 40, height: 40 },
  keyboardView: { flex: 1 },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
  
  heroContainer: {
    alignItems: "center",
    paddingVertical: 60,
    marginBottom: 20,
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  heroText: {
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 34,
    textAlign: "center",
    letterSpacing: -0.3,
  },

  userQueryContainer: {
    alignSelf: "flex-end",
    marginBottom: 32,
    marginTop: 16,
    maxWidth: "90%",
  },
  userQueryText: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 30,
    letterSpacing: -0.4,
    textAlign: "right",
  },

  aiResponseCard: {
    marginBottom: 32,
    padding: 24,
    borderRadius: BorderRadii.xl,
    borderWidth: 0,
    ...Shadows.premium,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  aiResponseText: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "400",
  },

  loadingContainer: {
    padding: 24,
    marginBottom: 32,
  },

  bottomArea: {
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  chipsScroll: {
    marginBottom: 16,
  },
  chipsContent: {
    paddingHorizontal: 24,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputPillContainer: {
    paddingHorizontal: 24,
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
    fontSize: 16,
    fontWeight: "500",
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
