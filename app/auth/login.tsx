import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from "react-native";
import { supabase } from "../../lib/supabase";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    async function handleLogin() {
        if (!email || !password) {
            setErrorMsg("Please enter both email and password");
            return;
        }

        setErrorMsg("");
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            setErrorMsg(error.message);
            return;
        }
        
        // RootLayout will handle the redirect based on session & onboarding status
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </Pressable>

                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Log in to continue your journey.</Text>

                    <View style={styles.form}>
                        {errorMsg ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorBoxText}>{errorMsg}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                placeholder="name@example.com"
                                placeholderTextColor="#8E8E93"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setErrorMsg(''); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                placeholder="Enter your password"
                                placeholderTextColor="#8E8E93"
                                value={password}
                                onChangeText={(text) => { setPassword(text); setErrorMsg(''); }}
                                secureTextEntry
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Pressable
                            onPress={handleLogin}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.primaryButton, 
                                pressed && { opacity: 0.9 },
                                loading && { opacity: 0.7 }
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Log in</Text>
                            )}
                        </Pressable>

                        <Pressable 
                            onPress={() => router.push("/auth/signup")}
                            style={styles.secondaryButton}
                        >
                            <Text style={styles.secondaryText}>
                                Don't have an account? <Text style={styles.secondaryTextBold}>Sign up</Text>
                            </Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EBEAE4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    backIcon: {
        fontSize: 20,
        color: '#1C1C1E',
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: '#1C1C1E',
        letterSpacing: -1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 17,
        color: '#636366',
        marginBottom: 40,
    },
    form: {
        gap: 20,
        marginBottom: 40,
    },
    errorBox: {
        backgroundColor: '#FFEBEA',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    errorBoxText: {
        color: '#FF3B30',
        fontSize: 15,
        fontWeight: '500',
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1C1C1E',
    },
    input: {
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        padding: 16,
        borderRadius: 16,
        fontSize: 17,
        color: '#1C1C1E',
    },
    footer: {
        marginTop: 'auto',
        gap: 16,
    },
    primaryButton: {
        backgroundColor: '#1C1C1E',
        borderRadius: 100,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryText: {
        color: '#636366',
        fontSize: 15,
    },
    secondaryTextBold: {
        color: '#1C1C1E',
        fontWeight: '700',
    },
});