// app/login.tsx
import React, { useState } from "react";
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
import { useAuth } from "./auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, authLoading } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }

      // After successful auth, let index.tsx redirect based on auth state.
      router.replace("/"); // goes to index -> redirects to (tabs)
    } catch (e: any) {
      setError(e?.message || "Authentication failed. Please try again.");
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
          <Text style={styles.cardTitle}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Text>

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
            style={[styles.button, authLoading && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={authLoading}
          >
            <Text style={styles.buttonText}>
              {authLoading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </Text>
          </TouchableOpacity>

          {/* Toggle login/register */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() =>
              setMode((prev) => (prev === "login" ? "register" : "login"))
            }
          >
            <Text style={styles.switchModeText}>
              {mode === "login"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Accounts are stored on your NAS backend. Each login gets its own
            private folder for photo backups.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Server: your Ubuntu NAS ({/* you can inject IP here later */})
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
  switchModeButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 13,
    color: "#9ca3af",
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
