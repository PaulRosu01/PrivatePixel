// app/login.tsx
import React, { useContext, useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { AuthContext } from "./auth-context";


import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const auth = useContext(AuthContext);
  const router = useRouter();

  // Email/password (optional, you can remove later if you only want Google)
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Google auth setup ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Replace these with your real client IDs from Google Cloud Console
    clientId: "252024811502-224ig6sb8ibbgmaeec70jp66j62j9lto.apps.googleusercontent.com"
});

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === "success") {
      const authResult = response.authentication;

      // Here you could call your ASP.NET backend with authResult?.accessToken
      // to create your own session / JWT.
      // For now we just treat it as logged in.
      auth?.login();
      router.replace("/(tabs)");
    }
  }, [response, auth, router]);

  const onLoginFake = async () => {
    // If you want to temporarily keep the fake email/password login
    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      auth?.login();
      router.replace("/(tabs)");
    } catch (e) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onGooglePress = async () => {
    setError(null);
    try {
      await promptAsync();
    } catch (e) {
      setError("Google sign-in failed. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>📸</Text>
          </View>
          <Text style={styles.title}>Immich Lite</Text>
          <Text style={styles.subtitle}>
            Self-hosted private photo backup
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>

          {/* OPTIONAL: Keep or remove this block if you want email/password */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            secureTextEntry
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onLoginFake}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Signing in..." : "Sign in (demo)"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[
              styles.googleButton,
              !request && { opacity: 0.6 },
            ]}
            onPress={onGooglePress}
            disabled={!request}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Google sign-in uses expo-auth-session. In production, you should send
            the Google token to your ASP.NET backend and create a local user/session.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Server: https://photos.my-home-server.local
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#020617",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  logoArea: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2933",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  input: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2933",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#e5e7eb",
    backgroundColor: "#020617",
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: "#f97373",
  },
  button: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#38bdf8",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#1f2933",
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 12,
    color: "#6b7280",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: "#020617",
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f97316",
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 14,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  hintText: {
    marginTop: 10,
    fontSize: 11,
    color: "#6b7280",
  },
  footer: {
    alignItems: "center",
    marginBottom: 8,
  },
  footerText: {
    fontSize: 11,
    color: "#6b7280",
  },
});
