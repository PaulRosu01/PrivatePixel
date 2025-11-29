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
  TextInput,
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

type ManualAlbum = {
  id: string;
  title: string;
  createdAt: string;
  mediaIds: string[];
  coverMediaId?: string;
};

type AlbumInfo = {
  id: string;
  title: string;
  count: number;
  coverUri?: string;
  kind: "smart" | "manual";
};

type ActiveAlbum =
  | { kind: "smart"; id: AlbumId }
  | { kind: "manual"; id: string }
  | null;

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
            <Text numberOfLines={2} style={styles.viewerMetaText}>
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

  const [manualAlbums, setManualAlbums] = useState<ManualAlbum[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<ActiveAlbum>(null);
  const [albumEditMode, setAlbumEditMode] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanningDevice, setScanningDevice] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);

  // Rename modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState("");

  // NEW: selection for fake upload
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [uploading, setUploading] = useState(false);

  const clearSelection = () => {
    setSelectedIds(() => new Set());
  };

  const toggleSelectItem = (mediaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) next.delete(mediaId);
      else next.add(mediaId);
      return next;
    });
  };

  const handleToggleSelectMode = () => {
    if (selectMode) {
      setSelectMode(false);
      clearSelection();
    } else {
      // entering select mode -> disable album edit mode
      setAlbumEditMode(false);
      setSelectMode(true);
    }
  };

  const handleFakeUpload = useCallback(async () => {
    if (selectedIds.size === 0) {
      Alert.alert("Nothing selected", "Select some media to upload first.");
      return;
    }

    setUploading(true);
    try {
      const delayMs = 700 + selectedIds.size * 200;
      await new Promise((res) => setTimeout(res, delayMs));

      Alert.alert(
        "Upload complete (mock)",
        `${selectedIds.size} item${
          selectedIds.size === 1 ? "" : "s"
        } uploaded to the server (fake).`
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong during upload (mock).");
    } finally {
      setUploading(false);
      setSelectMode(false);
      clearSelection();
    }
  }, [selectedIds]);

  // Find currently active manual album (if any)
  const activeManualAlbum = useMemo(() => {
    if (!activeAlbum || activeAlbum.kind !== "manual") return null;
    return manualAlbums.find((a) => a.id === activeAlbum.id) ?? null;
  }, [activeAlbum, manualAlbums]);

  // Smart + manual albums (for UI)
  const albums = useMemo<AlbumInfo[]>(() => {
    const result: AlbumInfo[] = [];

    const makeSmart = (
      id: AlbumId,
      title: string,
      predicate: (m: MediaItem) => boolean
    ) => {
      const items = media.filter(predicate);
      if (!items.length) return;
      result.push({
        id,
        title,
        count: items.length,
        coverUri: items[0].uri,
        kind: "smart",
      });
    };

    makeSmart("all", "All media", () => true);
    makeSmart("device", "From device", (m) => m.source === "device");
    makeSmart("videos", "Videos", (m) => m.type === "video");

    // Manual albums
    manualAlbums.forEach((album) => {
      const coverMedia =
        media.find((m) => m.id === album.coverMediaId) ??
        media.find((m) => album.mediaIds.includes(m.id));
      const count = album.mediaIds.length;

      result.push({
        id: album.id,
        title: album.title,
        count,
        coverUri: coverMedia?.uri,
        kind: "manual",
      });
    });

    return result;
  }, [media, manualAlbums]);

  // Media for timeline: album filter (except when editing manual album) + type filter
  const mediaForTimeline = useMemo(() => {
    let base = media;

    if (!albumEditMode && activeAlbum) {
      if (activeAlbum.kind === "smart") {
        if (activeAlbum.id === "device") {
          base = base.filter((m) => m.source === "device");
        } else if (activeAlbum.id === "videos") {
          base = base.filter((m) => m.type === "video");
        }
        // "all" just means no extra filter
      } else if (activeAlbum.kind === "manual") {
        const album = manualAlbums.find((a) => a.id === activeAlbum.id);
        if (album) {
          base = base.filter((m) => album.mediaIds.includes(m.id));
        }
      }
    }

    if (filter === "photos") {
      base = base.filter((m) => m.type === "photo");
    } else if (filter === "videos") {
      base = base.filter((m) => m.type === "video");
    }

    return base;
  }, [media, filter, activeAlbum, albumEditMode, manualAlbums]);

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

  // Device scan
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

  // Create a new manual album and enter edit mode
  const handleCreateAlbum = () => {
    const index = manualAlbums.length + 1;
    const newAlbum: ManualAlbum = {
      id: `manual-${Date.now()}`,
      title: `Album ${index}`,
      createdAt: new Date().toISOString(),
      mediaIds: [],
    };

    setManualAlbums((prev) => [...prev, newAlbum]);
    setActiveAlbum({ kind: "manual", id: newAlbum.id });
    setAlbumEditMode(true);
    // creating album -> disable select mode and clear selection
    setSelectMode(false);
    clearSelection();
  };

  // Toggle album selection (smart or manual)
  const handlePressAlbum = (album: AlbumInfo) => {
    setAlbumEditMode(false);
    // switching albums -> reset select mode & selection
    setSelectMode(false);
    clearSelection();

    if (album.kind === "smart") {
      const smartId = album.id as AlbumId;
      if (smartId === "all") {
        setActiveAlbum(null);
      } else {
        setActiveAlbum({ kind: "smart", id: smartId });
      }
    } else {
      setActiveAlbum({ kind: "manual", id: album.id });
    }
  };

  // Toggle album edit mode; only valid for manual albums
  const toggleAlbumEditMode = () => {
    if (!activeManualAlbum) return;
    setAlbumEditMode((prev) => {
      const next = !prev;
      if (next) {
        // entering album edit mode -> disable select mode
        setSelectMode(false);
        clearSelection();
      }
      return next;
    });
  };

  // Toggle membership of a media item in active manual album
  const toggleItemInActiveManualAlbum = (mediaId: string) => {
    if (!activeManualAlbum) return;

    setManualAlbums((prev) =>
      prev.map((a) => {
        if (a.id !== activeManualAlbum.id) return a;
        const set = new Set(a.mediaIds);
        if (set.has(mediaId)) set.delete(mediaId);
        else set.add(mediaId);
        return { ...a, mediaIds: Array.from(set) };
      })
    );
  };

  // Set cover for active manual album (also ensures membership)
  const handleSetCoverForActiveAlbum = (mediaId: string) => {
    if (!activeManualAlbum) return;

    setManualAlbums((prev) =>
      prev.map((a) => {
        if (a.id !== activeManualAlbum.id) return a;
        const set = new Set(a.mediaIds);
        set.add(mediaId);
        return {
          ...a,
          mediaIds: Array.from(set),
          coverMediaId: mediaId,
        };
      })
    );
  };

  // Rename album (open modal)
  const handleStartRenameAlbum = () => {
    if (!activeManualAlbum) return;
    setRenameText(activeManualAlbum.title);
    setRenameModalVisible(true);
  };

  const handleConfirmRenameAlbum = () => {
    if (!activeManualAlbum) {
      setRenameModalVisible(false);
      return;
    }
    const trimmed = renameText.trim();
    if (!trimmed) {
      setRenameModalVisible(false);
      return;
    }
    setManualAlbums((prev) =>
      prev.map((a) =>
        a.id === activeManualAlbum.id ? { ...a, title: trimmed } : a
      )
    );
    setRenameModalVisible(false);
  };

  const handleDeleteAlbum = () => {
    if (!activeManualAlbum) return;

    Alert.alert(
      "Delete album",
      `Delete "${activeManualAlbum.title}"?\nPhotos will NOT be removed from your library.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setManualAlbums((prev) =>
              prev.filter((a) => a.id !== activeManualAlbum.id)
            );
            setActiveAlbum(null);
            setAlbumEditMode(false);
          },
        },
      ]
    );
  };

  // Open fullscreen viewer OR toggle album membership / upload selection
  const openItem = (allItems: MediaItem[], index: number) => {
    const item = allItems[index];

    if (albumEditMode && activeManualAlbum) {
      toggleItemInActiveManualAlbum(item.id);
      return;
    }

    if (selectMode) {
      toggleSelectItem(item.id);
      return;
    }

    // View photos only in fullscreen
    const photos = allItems.filter((i) => i.type === "photo");
    const clicked = allItems[index];
    let start = photos.findIndex((p) => p.id === clicked.id);
    if (start === -1) start = 0;

    setViewerItems(photos);
    setViewerIndex(start);
    setViewerVisible(true);
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

          {/* Type filter */}
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

          {/* Select for upload */}
          <View style={styles.selectRow}>
            <TouchableOpacity
              onPress={handleToggleSelectMode}
              style={[
                styles.selectToggleButton,
                selectMode && styles.selectToggleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.selectToggleButtonText,
                  selectMode && styles.selectToggleButtonTextActive,
                ]}
              >
                {selectMode ? "Cancel selection" : "Select for upload"}
              </Text>
            </TouchableOpacity>

            {selectMode && (
              <View style={styles.selectStatusRow}>
                <Text style={styles.selectStatusText}>
                  {selectedIds.size} selected
                </Text>
                <TouchableOpacity
                  onPress={handleFakeUpload}
                  disabled={uploading || selectedIds.size === 0}
                  style={[
                    styles.uploadButton,
                    (uploading || selectedIds.size === 0) &&
                      styles.uploadButtonDisabled,
                  ]}
                >
                  <Text style={styles.uploadButtonText}>
                    {uploading
                      ? "Uploading..."
                      : selectedIds.size === 0
                      ? "Upload"
                      : `Upload ${selectedIds.size}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Albums row */}
          {albums.length > 0 && (
            <View style={styles.albumsSection}>
              <View style={styles.albumsHeaderRow}>
                <Text style={styles.albumsTitle}>Albums</Text>
                <TouchableOpacity
                  style={styles.albumsNewButton}
                  onPress={handleCreateAlbum}
                >
                  <Text style={styles.albumsNewButtonText}>+ New album</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.albumsScrollContent}
              >
                {albums.map((album) => {
                  const isActive =
                    (activeAlbum?.kind === "smart" &&
                      album.kind === "smart" &&
                      activeAlbum.id === album.id) ||
                    (activeAlbum?.kind === "manual" &&
                      album.kind === "manual" &&
                      activeAlbum.id === album.id) ||
                    (!activeAlbum &&
                      album.kind === "smart" &&
                      album.id === "all");

                  return (
                    <TouchableOpacity
                      key={album.kind + "-" + album.id}
                      style={[
                        styles.albumCard,
                        isActive && styles.albumCardActive,
                      ]}
                      onPress={() => handlePressAlbum(album)}
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
                      {album.kind === "manual" && (
                        <Text style={styles.albumBadgeManual}>Manual</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Album edit bar */}
          {activeManualAlbum && (
            <View style={styles.albumEditRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.albumEditTitle}>
                  {albumEditMode
                    ? `Edit "${activeManualAlbum.title}"`
                    : `Album: ${activeManualAlbum.title}`}
                </Text>
                <Text style={styles.albumEditSubtitle}>
                  {albumEditMode
                    ? "Tap photos to add/remove. Long press a photo to set it as album cover."
                    : "Tap Edit to modify album contents."}
                </Text>
              </View>

              <View style={styles.albumEditButtonsColumn}>
                <TouchableOpacity
                  onPress={toggleAlbumEditMode}
                  style={[
                    styles.albumEditButton,
                    albumEditMode && styles.albumEditButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.albumEditButtonText,
                      albumEditMode && styles.albumEditButtonTextActive,
                    ]}
                  >
                    {albumEditMode ? "Done" : "Edit album"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.albumEditSecondaryRow}>
                  <TouchableOpacity
                    onPress={handleStartRenameAlbum}
                    style={styles.albumEditSecondaryButton}
                  >
                    <Text style={styles.albumEditSecondaryText}>Rename</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeleteAlbum}
                    style={styles.albumEditSecondaryButton}
                  >
                    <Text style={styles.albumEditSecondaryTextDestructive}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
                  renderItem={({ item, index }) => {
                    const isInActiveManualAlbum =
                      !!activeManualAlbum &&
                      activeManualAlbum.mediaIds.includes(item.id);

                    const isCover =
                      !!activeManualAlbum &&
                      activeManualAlbum.coverMediaId === item.id;

                    const isSelectedForUpload =
                      selectMode && selectedIds.has(item.id);

                    return (
                      <TouchableOpacity
                        style={[
                          styles.gridItem,
                          albumEditMode &&
                            activeManualAlbum &&
                            isInActiveManualAlbum &&
                            styles.gridItemSelected,
                          isSelectedForUpload && styles.gridItemSelected,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => openItem(group.items, index)}
                        onLongPress={() => {
                          if (albumEditMode && activeManualAlbum) {
                            handleSetCoverForActiveAlbum(item.id);
                          }
                        }}
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
                        {albumEditMode &&
                          activeManualAlbum &&
                          isInActiveManualAlbum && (
                            <View style={styles.selectedOverlay}>
                              <View style={styles.checkbox}>
                                <Text style={styles.checkboxText}>✓</Text>
                              </View>
                            </View>
                          )}
                        {albumEditMode &&
                          activeManualAlbum &&
                          isCover && (
                            <View style={styles.coverBadge}>
                              <Text style={styles.coverBadgeText}>Cover</Text>
                            </View>
                          )}
                        {isSelectedForUpload && !albumEditMode && (
                          <View style={styles.selectedOverlay}>
                            <View style={styles.checkbox}>
                              <Text style={styles.checkboxText}>↑</Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
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

      {/* Rename album modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.renameModalBackdrop}>
          <View style={styles.renameModalCard}>
            <Text style={styles.renameModalTitle}>Rename album</Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Album name"
              placeholderTextColor="#6b7280"
              style={styles.renameModalInput}
            />
            <View style={styles.renameModalButtonsRow}>
              <TouchableOpacity
                onPress={() => setRenameModalVisible(false)}
                style={styles.renameModalButton}
              >
                <Text style={styles.renameModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmRenameAlbum}
                style={[
                  styles.renameModalButton,
                  styles.renameModalButtonPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.renameModalButtonText,
                    styles.renameModalButtonTextPrimary,
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Select / upload
  selectRow: {
    marginTop: 12,
    gap: 8,
  },
  selectToggleButton: {
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    alignItems: "center",
  },
  selectToggleButtonActive: {
    borderColor: "#38bdf8",
    backgroundColor: "#0f172a",
  },
  selectToggleButtonText: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "600",
  },
  selectToggleButtonTextActive: {
    color: "#38bdf8",
  },
  selectStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  selectStatusText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  uploadButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
  },

  // Albums
  albumsSection: {
    marginTop: 14,
  },
  albumsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  albumsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  albumsNewButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  albumsNewButtonText: {
    fontSize: 11,
    color: "#38bdf8",
    fontWeight: "600",
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
  albumBadgeManual: {
    position: "absolute",
    top: 8,
    right: 8,
    fontSize: 9,
    color: "#e5e7eb",
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },

  albumEditRow: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2933",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  albumEditTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  albumEditSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  albumEditButtonsColumn: {
    gap: 6,
  },
  albumEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  albumEditButtonActive: {
    borderColor: "#38bdf8",
    backgroundColor: "#0f172a",
  },
  albumEditButtonText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
  },
  albumEditButtonTextActive: {
    color: "#38bdf8",
  },
  albumEditSecondaryRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-end",
  },
  albumEditSecondaryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#374151",
  },
  albumEditSecondaryText: {
    fontSize: 11,
    color: "#e5e7eb",
  },
  albumEditSecondaryTextDestructive: {
    fontSize: 11,
    color: "#f97373",
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
    borderRadius: 10,
    overflow: "hidden",
  },
  gridItemSelected: {
    borderWidth: 2,
    borderColor: "#38bdf8",
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
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#38bdf8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  coverBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: "rgba(8,47,73,0.8)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverBadgeText: {
    fontSize: 10,
    color: "#e0f2fe",
    fontWeight: "600",
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

  // Rename modal
  renameModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  renameModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  renameModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 10,
  },
  renameModalInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#e5e7eb",
    fontSize: 14,
    marginBottom: 14,
    backgroundColor: "#020617",
  },
  renameModalButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  renameModalButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "#020617",
  },
  renameModalButtonPrimary: {
    borderColor: "#38bdf8",
    backgroundColor: "#0f172a",
  },
  renameModalButtonText: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  renameModalButtonTextPrimary: {
    color: "#38bdf8",
    fontWeight: "600",
  },
});
