// app/(tabs)/index.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ScreenContainer, Header } from "./_components";

export default function HomeScreen() {
  const [progress, setProgress] = useState<number>(40);
  const backedUp = useMemo(
    () => Math.round((progress / 100) * 120),
    [progress]
  );

  const handlePress = () => {
    setProgress((p) => (p >= 100 ? 0 : Math.min(100, p + 10)));
  };

  return (
    <ScreenContainer>
      <Header title="My Private Photos" subtitle="Welcome back, Alex" />

      <View style={s.card}>
        <Text style={s.cardTitle}>Backup status</Text>
        <Text style={s.cardSubtitle}>Last backup: Today, 14:23</Text>

        <View style={s.progressBar}>
          <View style={[s.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={s.progressLabel}>
          {backedUp} of 120 items backed up
        </Text>

        <TouchableOpacity style={s.primaryButton} onPress={handlePress}>
          <Text style={s.primaryButtonText}>
            {progress >= 100 ? "Reset demo progress" : "Backup now (demo)"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Details</Text>
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>New photos detected</Text>
          <Text style={s.statusValue}>72</Text>
        </View>
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>New videos</Text>
          <Text style={s.statusValue}>5</Text>
        </View>
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Server status</Text>
          <Text style={[s.statusValue, { color: "#16a34a" }]}>Online</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Quick actions</Text>
        <View style={s.quickActionsRow}>
          <TouchableOpacity style={s.chip}>
            <Text style={s.chipEmoji}>📱</Text>
            <Text style={s.chipText}>Scan device</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.chip}>
            <Text style={s.chipEmoji}>☁️</Text>
            <Text style={s.chipText}>Recent uploads</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.chip}>
            <Text style={s.chipEmoji}>📍</Text>
            <Text style={s.chipText}>By location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
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
  cardSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    overflow: "hidden",
    marginVertical: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38bdf8",
  },
  progressLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#38bdf8",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 15,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  statusLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  statusValue: {
    fontSize: 13,
    color: "#e5e7eb",
    fontWeight: "500",
  },
});
