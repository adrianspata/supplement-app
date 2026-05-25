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
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { AssistantMessage, generateAssistantResponse, AssistantContextType } from "../lib/assistant";

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
      content: "Hi! I'm Elexir's AI Assistant. I can explain why products are recommended, break down your Elexir Scores, and analyze your stack coverage. How can I help you today?"
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
    "What does this ingredient do?",
    "Why is Gut Health low coverage?",
    "What does my stack support?",
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Ask Elexir</Text>
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
        >
          {messages.map(msg => (
            <View 
              key={msg.id} 
              style={[
                styles.messageBubble, 
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble
              ]}
            >
              <Text style={[
                styles.messageText, 
                msg.role === 'user' ? styles.userText : styles.assistantText
              ]}>
                {msg.content}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
              <ActivityIndicator size="small" color="#8E8E93" />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsContent}
          >
            {SUGGESTED_CHIPS.map(chip => (
              <Pressable 
                key={chip} 
                style={styles.chip}
                onPress={() => handleSend(chip)}
                disabled={loading}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything..."
              placeholderTextColor="#8E8E93"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend(input)}
              returnKeyType="send"
              editable={!loading}
            />
            <Pressable 
              style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}
              onPress={() => handleSend(input)}
              disabled={!input.trim() || loading}
            >
              <Text style={styles.sendBtnIcon}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EBEAE4",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, color: "#1C1C1E", fontWeight: "600" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1C1C1E" },
  placeholder: { width: 40, height: 40 },
  keyboardView: { flex: 1 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 32 },
  messageBubble: {
    maxWidth: "85%",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#1C1C1E",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    borderBottomLeftRadius: 4,
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: "#FFFFFF",
  },
  assistantText: {
    color: "#1C1C1E",
  },
  inputArea: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  chipsScroll: {
    paddingVertical: 12,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  chipText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 12,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1C1C1E",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnIcon: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
});
