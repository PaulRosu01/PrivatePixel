// app/(tabs)/library.tsx
import * as MediaLibrary from "expo-media-library";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Header, ScreenContainer } from "./_components";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type MediaType = "photo" | "video";

type MediaItem = {
  id: string;
  uri: string;
  createdAt: string;
  type: MediaType;
  source: "mock" | "device";
};

// -----------------------------------------------------------------------------
// Demo Data
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
// Grouping
// -----------------------------------------------------------------------------

type GroupKey = "Today" | "This week" | "Earlier";

type GroupedMedia = {
  group: GroupKey;
  items: MediaItem[];
};

function groupMedia(items: MediaItem[]): GroupedMedia[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<GroupKey, MediaItem[]> = {
    Today: [],
    "This week": [],
    Earlier: [],
  };

  for (const item of items) {
    const created = new Date(item.createdAt);

    if (created >= todayStart) buckets["Today"].push(item);
    else if (created >= weekAgo) buckets["This week"].push(item);
    else buckets["Earlier"].push(item);
  }

  const out: GroupedMedia[] = [];

  (["Today", "This week", "Earlier"] as GroupKey[]).forEach((k) => {
    if (buckets[k].length) out.push({ group: k, items: buckets[k] });
  });

  return out;
}

// -----------------------------------------------------------------------------
// Zoomable Image
// -----------------------------------------------------------------------------

const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      // Clamp between 1x and 4x
      scale.value = Math.min(Math.max(next, 1), 4);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinch}>
      <Animated.Image
        source={{ uri }}
        resizeMode="contain"
        style={[styles.viewerImage, animStyle]}
      />
    </GestureDetector>
  );
};


// -----------------------------------------------------------------------------
// Fullscreen Viewer
// -----------------------------------------------------------------------------

type ViewerProps = {
  images: { uri: string }[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
};

const FullscreenViewer: React.FC<ViewerProps> = ({
  images,
  imageIndex,
  visible,
  onRequestClose,
}) => {
  const listRef = useRef<FlatList<{ uri: string }>>(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(imageIndex);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(imageIndex);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: imageIndex,
        animated: false,
      });
    });
  }, [visible, imageIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = e.nativeEvent.layoutMeasurement.width;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / pageWidth);
    setCurrentIndex(idx);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.viewerBackdrop}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={{ flex: 1 }}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={[styles.viewerPage, { width, height }]}>
              <ZoomableImage uri={item.uri} />
            </View>
          )}
        />

        <View style={styles.viewerTopBar}>
          <TouchableOpacity
            onPress={onRequestClose}
            style={styles.viewerCloseButton}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </TouchableOpacity>

          <View style={styles.viewerCounter}>
            <Text style={styles.viewerCounterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------------
// Main Screen
// -----------------------------------------------------------------------------

export default function LibraryScreen() {
  const [media, setMedia] = useState(initialMedia);
  const [filter, setFilter] =
    useState<"all" | "photos" | "videos">("all");

  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanningDevice, setScanningDevice] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] =
    useState<{ uri: string }[]>([]);

  const filteredMedia = useMemo(() => {
    if (filter === "photos") return media.filter((m) => m.type === "photo");
    if (filter === "videos") return media.filter((m) => m.type === "video");
    return media;
  }, [media, filter]);

  const groups = useMemo(() => groupMedia(filteredMedia), [
    filteredMedia,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((res) => setTimeout(res, 700));

    const newItem: MediaItem = {
      id: String(Date.now()),
      uri:
        "https://picsum.photos/400?random=" +
        Math.floor(Math.random() * 5000),
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
      "Not supported",
      "Device scanning only works on iOS/Android"
    );
    return;
  }

  setScanningDevice(true);

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "We need access to your photo library.");
      return;
    }

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: [
        MediaLibrary.MediaType.photo,
        MediaLibrary.MediaType.video,
      ],
      first: 60,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    const items: MediaItem[] = await Promise.all(
      assets.assets.map(async (a): Promise<MediaItem> => {
        const info = await MediaLibrary.getAssetInfoAsync(a);

        const type: MediaType =
          a.mediaType === MediaLibrary.MediaType.video ? "video" : "photo";

        return {
          id: `device-${a.id}`,
          uri: info.localUri ?? a.uri,
          createdAt: new Date(
            a.creationTime ?? Date.now()
          ).toISOString(),
          type,
          source: "device",
        };
      })
    );

    setMedia((prev): MediaItem[] => {
      const ids = new Set(prev.map((m) => m.id));
      const uniqueNew = items.filter((i) => !ids.has(i.id));
      return [...prev, ...uniqueNew];
    });
  } catch (err) {
    console.error(err);
    Alert.alert("Error", "Error scanning device media.");
  } finally {
    setScanningDevice(false);
  }
}, []);


  const openViewer = (allItems: MediaItem[], index: number) => {
    const photos = allItems.filter((i) => i.type === "photo");
    const clicked = allItems[index];
    const start = photos.findIndex((p) => p.id === clicked.id);

    setViewerItems(photos.map((p) => ({ uri: p.uri })));
    setViewerIndex(start === -1 ? 0 : start);
    setViewerVisible(true);
  };

  return (
    <>
      <ScreenContainer>
        <Header title="Library" subtitle="Timeline of media" />

        {/* Controls */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter</Text>

          <View style={styles.segment}>
            {["all", "photos", "videos"].map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key as any)}
                style={[
                  styles.segmentItem,
                  filter === key && styles.segmentItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentItemText,
                    filter === key && styles.segmentItemTextActive,
                  ]}
                >
                  {key.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleSyncClick}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>
                {syncing ? "Syncing..." : "Sync (demo)"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleScanDevice}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>
                {scanningDevice ? "Scanning..." : "Scan device"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No media</Text>
            <Text style={styles.emptySubtitle}>
              Try another filter or sync device.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
          >
            {groups.map((group) => (
              <View key={group.group} style={styles.dateGroup}>
                <Text style={styles.dateGroupTitle}>{group.group}</Text>
                <FlatList
                  data={group.items}
                  key={group.group}
                  numColumns={3}
                  scrollEnabled={false}
                  keyExtractor={(i) => i.id}
                  columnWrapperStyle={styles.gridRow}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      activeOpacity={0.8}
                      onPress={() => openViewer(group.items, index)}
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

      {/* Fullscreen viewer */}
      <FullscreenViewer
        images={viewerItems}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
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
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 8,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 2,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: "#111827",
  },
  segmentItemText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  segmentItemTextActive: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38bdf8",
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateGroupTitle: {
    color: "#e5e7eb",
    fontSize: 14,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  videoBadgeIcon: {
    color: "white",
    fontSize: 11,
  },
  deviceBadge: {
    position: "absolute",
    left: 4,
    top: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  deviceBadgeText: {
    fontSize: 10,
    color: "#a5b4fc",
    fontWeight: "500",
  },
  emptyState: {
    marginTop: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },

  // Fullscreen
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "black",
  },
  viewerPage: {
    justifyContent: "center",
    alignItems: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerTopBar: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  viewerCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
  },
  viewerCloseText: {
    color: "white",
    fontSize: 13,
  },
  viewerCounter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
  },
  viewerCounterText: {
    color: "white",
    fontSize: 13,
  },
});
