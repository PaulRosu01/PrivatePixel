import * as MediaLibrary from "expo-media-library";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { NAS_BASE_URL, useAuth } from "../auth-context";
import { Header, ScreenContainer } from "./_components";

type ServerMediaItem = {
  id: string;
  createdAt?: string;
  width?: number;
  height?: number;
  originalName?: string;
  mimetype?: string;
  url?: string;
};

type DeviceMediaItem = {
  id: string;
  uri: string;
  createdAt: string;
  width?: number;
  height?: number;
  mediaType: "photo" | "video";
};

function buildDedupKey(input: {
  createdAt: string;
  width?: number;
  height?: number;
}) {
  const timePart = String(input.createdAt || "").slice(0, 19);
  const sizePart =
    input.width && input.height ? `${input.width}x${input.height}` : "";
  return `${timePart}|${sizePart}`;
}

export default function HomeScreen() {
  const { token, user } = useAuth();

  const [deviceItems, setDeviceItems] = useState<DeviceMediaItem[]>([]);
  const [serverItems, setServerItems] = useState<ServerMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const scanDeviceMedia = useCallback(async (): Promise<DeviceMediaItem[]> => {
    if (Platform.OS === "web") {
      return [];
    }

    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access first.");
      return [];
    }

    const pageSize = 1000;
    let after: string | undefined = undefined;
    let hasNextPage = true;
    const collected: DeviceMediaItem[] = [];

    while (hasNextPage) {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        first: pageSize,
        sortBy: [["creationTime", false]],
        after,
      });

      for (const asset of page.assets) {
        collected.push({
          id: asset.id,
          uri: asset.uri,
          createdAt: new Date(asset.creationTime).toISOString(),
          width: asset.width,
          height: asset.height,
          mediaType:
            asset.mediaType === MediaLibrary.MediaType.video
              ? "video"
              : "photo",
        });
      }

      hasNextPage = page.hasNextPage;
      after = page.endCursor ?? undefined;
    }

    return collected;
  }, []);

  const fetchServerMedia = useCallback(async (): Promise<ServerMediaItem[]> => {
    if (!token) return [];

    const res = await fetch(`${NAS_BASE_URL}/media`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, [token]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const devicePromise =
        Platform.OS === "web" ? Promise.resolve([]) : scanDeviceMedia();

      const [device, server] = await Promise.all([
        devicePromise,
        fetchServerMedia().catch((err) => {
          console.warn("Failed to fetch server media:", err);
          setServerOnline(false);
          return [];
        }),
      ]);

      setDeviceItems(device);
      setServerItems(server);
      setServerOnline(true);
      setLastRefreshAt(new Date().toISOString());
    } catch (err) {
      console.error(err);
      setServerOnline(false);
      Alert.alert("Error", "Failed to refresh backup information.");
    } finally {
      setLoading(false);
    }
  }, [fetchServerMedia, scanDeviceMedia]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const serverKeySet = useMemo(() => {
    return new Set(
      serverItems.map((item) =>
        buildDedupKey({
          createdAt: item.createdAt || "",
          width: item.width,
          height: item.height,
        }),
      ),
    );
  }, [serverItems]);

  const missingDeviceItems = useMemo(() => {
    return deviceItems.filter((item) => {
      const key = buildDedupKey(item);
      return !serverKeySet.has(key);
    });
  }, [deviceItems, serverKeySet]);

  const totalDeviceCount = deviceItems.length;
  const backedUpCount = Math.max(
    0,
    totalDeviceCount - missingDeviceItems.length,
  );
  const progress =
    totalDeviceCount > 0
      ? Math.round((backedUpCount / totalDeviceCount) * 100)
      : 0;

  const missingPhotos = missingDeviceItems.filter(
    (item) => item.mediaType === "photo",
  ).length;
  const missingVideos = missingDeviceItems.filter(
    (item) => item.mediaType === "video",
  ).length;

  const subtitle = useMemo(() => {
    if (loading) return "Checking your backup status...";
    if (lastRefreshAt) {
      return `Last checked: ${new Date(lastRefreshAt).toLocaleString()}`;
    }
    return "Backup overview";
  }, [lastRefreshAt, loading]);

  return (
    <ScreenContainer>
      <Header
        title="My Private Photos"
        subtitle={`Welcome back${user?.email ? `, ${user.email}` : ""}`}
      />

      <View style={s.card}>
        <Text style={s.cardTitle}>Backup status</Text>
        <Text style={s.cardSubtitle}>{subtitle}</Text>

        <View style={s.progressBar}>
          <View style={[s.progressBarFill, { width: `${progress}%` }]} />
        </View>

        <Text style={s.progressLabel}>
          {backedUpCount} of {totalDeviceCount} device items backed up
        </Text>

        <TouchableOpacity
          style={[s.secondaryButton, loading && s.disabledButton]}
          onPress={refreshAll}
          disabled={loading}
        >
          <Text style={s.secondaryButtonText}>
            {loading ? "Refreshing..." : "Refresh status"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Details</Text>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>New photos detected</Text>
          <Text style={s.statusValue}>{missingPhotos}</Text>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>New videos</Text>
          <Text style={s.statusValue}>{missingVideos}</Text>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>On device</Text>
          <Text style={s.statusValue}>{totalDeviceCount}</Text>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>On server</Text>
          <Text style={s.statusValue}>{serverItems.length}</Text>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Missing from server</Text>
          <Text style={s.statusValue}>{missingDeviceItems.length}</Text>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Server status</Text>
          <Text
            style={[
              s.statusValue,
              {
                color:
                  serverOnline === null
                    ? "#9ca3af"
                    : serverOnline
                      ? "#16a34a"
                      : "#ef4444",
              },
            ]}
          >
            {serverOnline === null
              ? "Checking"
              : serverOnline
                ? "Online"
                : "Offline"}
          </Text>
        </View>

        {Platform.OS === "web" && (
          <Text style={s.webNote}>
            Device scan is limited on web. For full backup flow, use the mobile
            app.
          </Text>
        )}
      </View>

      {loading && (
        <View style={s.loaderRow}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={s.loaderText}>Loading backup information...</Text>
        </View>
      )}
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
  secondaryButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryButtonText: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.65,
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
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  loaderText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  webNote: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 12,
  },
});
