// app/(tabs)/settings.tsx
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { NAS_BASE_URL, useAuth } from "../auth-context";
import { ThemeModeContext } from "../theme-context";
import { Header, ScreenContainer } from "./_components";

export default function SettingsScreen() {
  const [wifiOnly, setWifiOnly] = useState(true);
  const [backupOnOpen, setBackupOnOpen] = useState(true);
  const [retryingTags, setRetryingTags] = useState(false);

  const auth = useAuth();
  const themeMode = useContext(ThemeModeContext);
  const router = useRouter();
  const { colors } = useTheme();

  const isDark = themeMode?.mode === "dark";

  const handleLogout = () => {
    auth?.logout?.();
    router.replace("/login");
  };

  const handleRetryAiTagging = async () => {
    try {
      setRetryingTags(true);

      const response = await fetch(`${NAS_BASE_URL}/media/retry-tagging`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({
          retryErrors: true,
          retryUntagged: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to retry AI tagging.");
      }

      Alert.alert(
        "AI tagging started",
        data?.message || "Retry started for failed and untagged items.",
      );
    } catch (error: any) {
      Alert.alert(
        "Retry failed",
        error?.message || "Something went wrong while retrying AI tagging.",
      );
    } finally {
      setRetryingTags(false);
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Settings"
        subtitle="Account, server & backup preferences"
      />

      {/* Appearance */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Appearance
        </Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingsLabel}>Dark mode</Text>
            <Text style={styles.settingsHint}>
              Switch between light and dark theme.
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) =>
              themeMode?.setMode(value ? "dark" : "light")
            }
          />
        </View>
      </View>

      {/* Server */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>Server</Text>

        <Text style={styles.settingsLabel}>Server URL</Text>
        <Text style={styles.settingsValue}>{NAS_BASE_URL}</Text>

        <View style={styles.pillStatus}>
          <Text style={styles.pillDot}>●</Text>
          <Text style={styles.pillText}>Connected</Text>
        </View>
      </View>

      {/* Backup */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>Backup</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingsLabel}>Backup on app open</Text>
            <Text style={styles.settingsHint}>
              Scan for new media each time you open the app.
            </Text>
          </View>
          <Switch value={backupOnOpen} onValueChange={setBackupOnOpen} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingsLabel}>Wi-Fi only</Text>
            <Text style={styles.settingsHint}>
              Avoid using mobile data for uploads.
            </Text>
          </View>
          <Switch value={wifiOnly} onValueChange={setWifiOnly} />
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.settingsLabel}>AI tagging</Text>
        <Text style={styles.settingsHint}>
          Retry failed tags and queue media that was not tagged yet.
        </Text>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            retryingTags && styles.buttonDisabled,
          ]}
          onPress={handleRetryAiTagging}
          disabled={retryingTags}
        >
          {retryingTags ? (
            <View style={styles.buttonContentRow}>
              <ActivityIndicator size="small" color="#f97316" />
              <Text style={styles.secondaryButtonText}>
                Retrying AI tagging...
              </Text>
            </View>
          ) : (
            <Text style={styles.secondaryButtonText}>
              Retry failed / untagged AI tagging
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Account */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>

        <Text style={styles.settingsLabel}>Logged in as</Text>
        <Text style={styles.settingsValue}>
          {auth?.user?.email || "Signed in"}
        </Text>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleLogout}>
          <Text style={styles.secondaryButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  settingsLabel: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  settingsValue: {
    fontSize: 13,
    color: "#e5e7eb",
    marginTop: 4,
  },
  settingsHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#1f2933",
    marginTop: 14,
    marginBottom: 4,
  },
  secondaryButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#f97316",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillStatus: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(22,163,74,0.15)",
    marginTop: 8,
  },
  pillDot: {
    color: "#16a34a",
    fontSize: 11,
    marginRight: 4,
  },
  pillText: {
    color: "#16a34a",
    fontSize: 11,
  },
});
