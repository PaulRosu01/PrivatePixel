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
  width?: number;
  height?: number;
  exif?: Record<string, any>;
};

type AlbumId = "all" | "device" | "videos";

type AlbumInfo = {
  id: AlbumId;
  title: string;
  count: number;
  coverUri?: string;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

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
    width: 400,
    height: 400,
  },
  {
    id: "2",
    uri: "https://picsum.photos/400?random=12",
    createdAt: new Date().toISOString(),
    type: "photo",
    source: "mock",
    width: 400,
    height: 400,
  },
  {
    id: "3",
    uri: "https://picsum.photos/400?random=13",
    createdAt: daysAgo(1),
    type: "video",
    source: "mock",
    width: 1920,
    height: 1080,
  },
  {
    id: "4",
    uri: "https://picsum.photos/400?random=14",
    createdAt: daysAgo(2),
    type: "photo",
    source: "mock",
    width: 400,
    height: 400,
  },
  {
    id: "5",
    uri: "https://picsum.photos/400?random=15",
    createdAt: daysAgo(5),
    type: "video",
    source: "mock",
    width: 1280,
    height: 720,
  },
  {
    id: "6",
    uri: "https://picsum.photos/400?random=16",
    createdAt: daysAgo(12),
    type: "photo",
    source: "mock",
    width: 400,
    height: 400,
  },
];

// -----------------------------------------------------------------------------
// Grouping (Today / This week / Earlier)
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
// Zoomable Image (pinch only so FlatList can swipe)
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
// Fullscreen Viewer with metadata + swipe
// -----------------------------------------------------------------------------

type ViewerProps = {
  images: MediaItem[];
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
  const listRef = useRef<FlatList<MediaItem>>(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(imageIndex);

  useEffect(() => {
    if (!visible || !images.length) return;
    const clamped = Math.max(0, Math.min(imageIndex, images.length - 1));
    setCurrentIndex(clamped);

    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: clamped,
        animated: false,
      });
    });
  }, [visible, imageIndex, images.length]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = e.nativeEvent.layoutMeasurement.width;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / pageWidth);
    setCurrentIndex(idx);
  };

  if (!visible || images.length === 0) return null;

  const current = images[currentIndex] ?? images[0];

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
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.viewerPage, { width, height }]}>
              <ZoomableImage uri={item.uri} />
            </View>
          )}
        />

        {/* Top bar: Close + counter */}
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

        {/* Bottom metadata bar */}
        {current && (
          <View style={styles.viewerMetaBar}>
            <Text numberOfLines={1} style={styles.viewerMetaText}>
              {formatDateTime(current.createdAt)}
              {current.width && current.height
                ? ` · ${current.width}×${current.height}`
                : ""}
              {current.type === "video" ? " · Video" : " · Photo"}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// -----------------------------------------------------------------------------
// Main Screen
// -----------------------------------------------------------------------------

export default function LibraryScreen() {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [filter, setFilter] =
    useState<"all" | "photos" | "videos">("all");
  const [activeAlbumId, setActiveAlbumId] =
    useState<AlbumId | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanningDevice, setScanningDevice] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);

  // Smart albums derived from current media
  const albums = useMemo<AlbumInfo[]>(() => {
    const mk = (
      id: AlbumId,
      title: string,
      predicate: (m: MediaItem) => boolean
    ): AlbumInfo | null => {
      const items = media.filter(predicate);
      if (!items.length) return null;
      return {
        id,
        title,
        count: items.length,
        coverUri: items[0].uri,
      };
    };

    const res: AlbumInfo[] = [];
    const all = mk("all", "All media", () => true);
    if (all) res.push(all);

    const device = mk(
      "device",
      "From device",
      (m) => m.source === "device"
    );
    if (device) res.push(device);

    const videos = mk("videos", "Videos", (m) => m.type === "video");
    if (videos) res.push(videos);

    return res;
  }, [media]);

  // Apply album filter + type filter
  const mediaForTimeline = useMemo(() => {
    let base = media;

    if (activeAlbumId === "device") {
      base = base.filter((m) => m.source === "device");
    } else if (activeAlbumId === "videos") {
      base = base.filter((m) => m.type === "video");
    }

    if (filter === "photos") {
      base = base.filter((m) => m.type === "photo");
    } else if (filter === "videos") {
      base = base.filter((m) => m.type === "video");
    }

    return base;
  }, [media, filter, activeAlbumId]);

  const groups = useMemo(
    () => groupMedia(mediaForTimeline),
    [mediaForTimeline]
  );

  // Pull-to-refresh demo
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
      width: 400,
      height: 400,
    };

    setMedia((prev) => [newItem, ...prev]);
    setRefreshing(false);
  }, []);

  const handleSyncClick = useCallback(async () => {
    setSyncing(true);
    await handleRefresh();
    setSyncing(false);
  }, [handleRefresh]);

  // Device scan (Tier 1 point 3 foundation, with metadata)
  const handleScanDevice = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not supported",
        "Device scanning only works on iOS/Android."
      );
      return;
    }

    setScanningDevice(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need access to your photos."
        );
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
            a.mediaType === MediaLibrary.MediaType.video
              ? "video"
              : "photo";

          return {
            id: `device-${a.id}`,
            uri: info.localUri ?? a.uri,
            createdAt: new Date(
              a.creationTime ?? Date.now()
            ).toISOString(),
            type,
            source: "device",
            width: info.width ?? (a as any).width,
            height: info.height ?? (a as any).height,
            exif: info.exif ?? undefined,
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

  // Open fullscreen viewer (photos only)
  const openViewer = (allItems: MediaItem[], index: number) => {
    const photos = allItems.filter((i) => i.type === "photo");
    const clicked = allItems[index];
    let start = photos.findIndex((p) => p.id === clicked.id);
    if (start === -1) start = 0;

    setViewerItems(photos);
    setViewerIndex(start);
    setViewerVisible(true);
  };

  const onPressAlbum = (id: AlbumId) => {
    if (id === "all") setActiveAlbumId(null);
    else setActiveAlbumId(id);
  };

  return (
    <>
      <ScreenContainer>
        <Header title="Library" subtitle="Timeline of backed up media" />

        {/* Filters + actions */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Filter & sources</Text>
          </View>

          {/* Type filter (All / Photos / Videos) */}
          <View style={styles.segment}>
            {(["all", "photos", "videos"] as const).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
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

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleSyncClick}
              style={styles.actionButton}
              disabled={syncing}
            >
              <Text style={styles.actionButtonText}>
                {syncing ? "Syncing..." : "Sync (demo)"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleScanDevice}
              style={styles.actionButton}
              disabled={scanningDevice}
            >
              <Text style={styles.actionButtonText}>
                {scanningDevice ? "Scanning..." : "Scan device"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Smart albums */}
          {albums.length > 0 && (
            <View style={styles.albumsSection}>
              <Text style={styles.albumsTitle}>Albums (smart)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.albumsScrollContent}
              >
                {albums.map((album) => {
                  const isActive =
                    (activeAlbumId === null && album.id === "all") ||
                    activeAlbumId === album.id;
                  return (
                    <TouchableOpacity
                      key={album.id}
                      style={[
                        styles.albumCard,
                        isActive && styles.albumCardActive,
                      ]}
                      onPress={() => onPressAlbum(album.id)}
                      activeOpacity={0.8}
                    >
                      {album.coverUri && (
                        <Image
                          source={{ uri: album.coverUri }}
                          style={styles.albumCover}
                        />
                      )}
                      <Text style={styles.albumTitle}>{album.title}</Text>
                      <Text style={styles.albumCount}>
                        {album.count} item{album.count === 1 ? "" : "s"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Content */}
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No media</Text>
            <Text style={styles.emptySubtitle}>
              Try another filter, syncing, or scanning your device.
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
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  scrollEnabled={false}
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

  // Albums
  albumsSection: {
    marginTop: 14,
  },
  albumsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  albumsScrollContent: {
    paddingVertical: 2,
  },
  albumCard: {
    width: 120,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2933",
    overflow: "hidden",
  },
  albumCardActive: {
    borderColor: "#38bdf8",
  },
  albumCover: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#020617",
  },
  albumTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e5e7eb",
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  albumCount: {
    fontSize: 11,
    color: "#9ca3af",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },

  // Timeline
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

  // Fullscreen viewer
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
  viewerMetaBar: {
    position: "absolute",
    bottom: 30,
    left: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  viewerMetaText: {
    color: "white",
    fontSize: 12,
  },
});
