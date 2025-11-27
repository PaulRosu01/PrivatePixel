// app/(tabs)/settings.tsx
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AuthContext } from "../auth-context";
import { ThemeModeContext } from "../theme-context";
import { Header, ScreenContainer } from "./_components";

export default function SettingsScreen() {
  const [wifiOnly, setWifiOnly] = useState(true);
  const [backupOnOpen, setBackupOnOpen] = useState(true);

  const auth = useContext(AuthContext);
  const themeMode = useContext(ThemeModeContext);
  const router = useRouter();
  const { colors } = useTheme();

  const handleLogout = () => {
    auth?.logout();
    router.replace("/login");
  };

  const isDark = themeMode?.mode === "dark";

  return (
    <ScreenContainer>
      <Header
        title="Settings"
        subtitle="Account & backup preferences"
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
        <Text style={styles.settingsValue}>
          https://photos.my-home-server.local
        </Text>
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
          <Switch
            value={backupOnOpen}
            onValueChange={setBackupOnOpen}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.settingsLabel}>Wi-Fi only</Text>
            <Text style={styles.settingsHint}>
              Avoid using mobile data for uploads.
            </Text>
          </View>
          <Switch
            value={wifiOnly}
            onValueChange={setWifiOnly}
          />
        </View>
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
        <Text style={styles.settingsValue}>alex@example.com</Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleLogout}
        >
          <Text style={styles.secondaryButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617", // overridden by useTheme
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
  secondaryButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#f97316",
    fontWeight: "600",
    fontSize: 14,
  },
  pillStatus: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(22,163,74,0.15)",
    marginTop: 4,
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