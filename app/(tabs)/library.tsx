// app/(tabs)/library.tsx
import * as MediaLibrary from "expo-media-library";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ImageViewing from "react-native-image-viewing";
import { Header, ScreenContainer } from "./_components";

type MediaType = "photo" | "video";

type MediaItem = {
  id: string;
  uri: string;
  createdAt: string; // ISO date
  type: MediaType;
  source: "mock" | "device";
};

// -----------------------------------------------------------------------------
// Demo data – later this can come from your backend
// -----------------------------------------------------------------------------

const initialMedia: MediaItem[] = [
  {
    id: "1",
    uri: "https://picsum.photos/400?random=11",
    createdAt: new Date().toISOString(),
    type: "photo",
    source: "mock",
  },
  {
    id: "2",
    uri: "https://picsum.photos/400?random=12",
    createdAt: new Date().toISOString(),
    type: "photo",
    source: "mock",
  },
  {
    id: "3",
    uri: "https://picsum.photos/400?random=13",
    createdAt: daysAgo(1),
    type: "video",
    source: "mock",
  },
  {
    id: "4",
    uri: "https://picsum.photos/400?random=14",
    createdAt: daysAgo(2),
    type: "photo",
    source: "mock",
  },
  {
    id: "5",
    uri: "https://picsum.photos/400?random=15",
    createdAt: daysAgo(5),
    type: "video",
    source: "mock",
  },
  {
    id: "6",
    uri: "https://picsum.photos/400?random=16",
    createdAt: daysAgo(12),
    type: "photo",
    source: "mock",
  },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// -----------------------------------------------------------------------------
// Grouping helpers
// -----------------------------------------------------------------------------

type GroupKey = "Today" | "This week" | "Earlier";

type GroupedMedia = {
  group: GroupKey;
  items: MediaItem[];
};

function groupMedia(items: MediaItem[]): GroupedMedia[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<GroupKey, MediaItem[]> = {
    Today: [],
    "This week": [],
    Earlier: [],
  };

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (created >= todayStart) {
      buckets["Today"].push(item);
    } else if (created >= weekAgo) {
      buckets["This week"].push(item);
    } else {
      buckets["Earlier"].push(item);
    }
  }

  const result: GroupedMedia[] = [];
  (["Today", "This week", "Earlier"] as GroupKey[]).forEach((key) => {
    if (buckets[key].length > 0) {
      result.push({ group: key, items: buckets[key] });
    }
  });
  return result;
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function LibraryScreen() {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [filter, setFilter] = useState<"all" | "photos" | "videos">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanningDevice, setScanningDevice] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<{ uri: string }[]>([]);

  // Apply filter
  const filteredMedia = useMemo(() => {
    if (filter === "photos") {
      return media.filter((m) => m.type === "photo");
    }
    if (filter === "videos") {
      return media.filter((m) => m.type === "video");
    }
    return media;
  }, [media, filter]);

  // Group by date buckets
  const groups = useMemo(() => groupMedia(filteredMedia), [filteredMedia]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // later: fetch from backend
    await new Promise((resolve) => setTimeout(resolve, 700));

    const newItem: MediaItem = {
      id: String(Date.now()),
      uri: "https://picsum.photos/400?random=" + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      type: Math.random() > 0.7 ? "video" : "photo",
      source: "mock",
    };
    setMedia((prev) => [newItem, ...prev]);
    setRefreshing(false);
  }, []);

  const handleSyncClick = useCallback(async () => {
    setSyncing(true);
    await handleRefresh();
    setSyncing(false);
  }, [handleRefresh]);

 const handleScanDevice = useCallback(async () => {
  if (Platform.OS === "web") {
    Alert.alert(
      "Not supported on web",
      "Device media scanning is only available on iOS/Android."
    );
    return;
  }

  setScanningDevice(true);
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "We need access to your photo library to scan for new media."
      );
      return;
    }

    const result = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 60,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    if (!result.assets.length) {
      Alert.alert("No media", "No photos or videos found on this device.");
      return;
    }

    // 🔥 IMPORTANT: resolve ph:// URIs to local file URIs
    const assetsWithInfo = await Promise.all(
      result.assets.map(async (asset) => {
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset);
          return {
            asset,
            uri: info.localUri ?? asset.uri, // prefer localUri if available
          };
        } catch {
          return { asset, uri: asset.uri };
        }
      })
    );

    const deviceItems: MediaItem[] = assetsWithInfo.map(({ asset, uri }) => ({
      id: `device-${asset.id}`,
      uri, // now file:// or normal http(s), not ph://
      createdAt: new Date(
        asset.creationTime ?? Date.now()
      ).toISOString(),
      type:
        asset.mediaType === MediaLibrary.MediaType.video
          ? "video"
          : "photo",
      source: "device",
    }));

    setMedia((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const item of deviceItems) {
        if (!existingIds.has(item.id)) {
          merged.push(item);
        }
      }
      return merged;
    });
  } catch (e) {
    console.error(e);
    Alert.alert(
      "Error",
      "Failed to scan device media. Please try again."
    );
  } finally {
    setScanningDevice(false);
  }
}, []);


  const openViewer = (allItemsInGroup: MediaItem[], itemIndex: number) => {
    // Only photos in viewer for now
    const photosOnly = allItemsInGroup.filter((m) => m.type === "photo");
    const clickedItem = allItemsInGroup[itemIndex];

    let startIndex = photosOnly.findIndex((p) => p.id === clickedItem.id);
    if (startIndex === -1) startIndex = 0;

    setViewerItems(photosOnly.map((m) => ({ uri: m.uri })));
    setViewerIndex(startIndex);
    setViewerVisible(true);
  };

  return (
    <>
      <ScreenContainer>
        <Header
          title="Library"
          subtitle="Timeline of backed up media"
        />

        <View style={[styles.card, { marginBottom: 8 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Filter & sources</Text>
          </View>

          <View style={styles.segment}>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                filter === "all" && styles.segmentItemActive,
              ]}
              onPress={() => setFilter("all")}
            >
              <Text
                style={[
                  styles.segmentItemText,
                  filter === "all" && styles.segmentItemTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentItem,
                filter === "photos" && styles.segmentItemActive,
              ]}
              onPress={() => setFilter("photos")}
            >
              <Text
                style={[
                  styles.segmentItemText,
                  filter === "photos" && styles.segmentItemTextActive,
                ]}
              >
                Photos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentItem,
                filter === "videos" && styles.segmentItemActive,
              ]}
              onPress={() => setFilter("videos")}
            >
              <Text
                style={[
                  styles.segmentItemText,
                  filter === "videos" && styles.segmentItemTextActive,
                ]}
              >
                Videos
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleSyncClick}
              style={[styles.actionButton, syncing && { opacity: 0.7 }]}
              disabled={syncing}
            >
              <Text style={styles.actionButtonText}>
                {syncing ? "Syncing..." : "Sync with server (demo)"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleScanDevice}
              style={[styles.actionButton, scanningDevice && { opacity: 0.7 }]}
              disabled={scanningDevice}
            >
              <Text style={styles.actionButtonText}>
                {scanningDevice ? "Scanning..." : "Scan device photos"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No media in this filter</Text>
            <Text style={styles.emptySubtitle}>
              Try selecting another filter, syncing with your server, or scanning
              your device.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#38bdf8"
              />
            }
          >
            {groups.map((group) => (
              <View key={group.group} style={styles.dateGroup}>
                <Text style={styles.dateGroupTitle}>{group.group}</Text>
                <FlatList
                  data={group.items}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.gridRow}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => openViewer(group.items, index)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.gridImage}
                      />
                      {item.type === "video" && (
                        <View style={styles.videoBadge}>
                          <Text style={styles.videoBadgeIcon}>▶</Text>
                        </View>
                      )}
                      {item.source === "device" && (
                        <View style={styles.deviceBadge}>
                          <Text style={styles.deviceBadgeText}>Device</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </ScreenContainer>

      {/* Fullscreen viewer with zoom & swipe */}
      <ImageViewing
        images={viewerItems}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        presentationStyle="overFullScreen"
        swipeToCloseEnabled={true}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#020617",
    borderRadius: 999,
    padding: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  segmentItem: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: "#111827",
  },
  segmentItemText: {
    fontSize: 11,
    color: "#9ca3af",
  },
  segmentItemTextActive: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38bdf8",
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "500",
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateGroupTitle: {
    fontSize: 14,
    color: "#e5e7eb",
    fontWeight: "600",
    marginBottom: 8,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 4,
    marginHorizontal: 1,
  },
  gridImage: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#020617",
  },
  videoBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoBadgeIcon: {
    color: "#f9fafb",
    fontSize: 11,
  },
  deviceBadge: {
    position: "absolute",
    left: 4,
    top: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deviceBadgeText: {
    fontSize: 10,
    color: "#a5b4fc",
    fontWeight: "500",
  },
  emptyState: {
    marginTop: 40,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
});
