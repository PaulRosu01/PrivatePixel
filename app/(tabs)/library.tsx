// app/(tabs)/library.tsx
import * as MediaLibrary from "expo-media-library";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  Alert,
  FlatList,
  Image,
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Header, ScreenContainer } from "./_components";
import { useAuth, NAS_BASE_URL } from "../auth-context";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type MediaType = "photo" | "video";
type MediaSource = "mock" | "device" | "server";

type MediaItem = {
  id: string;
  uri: string;
  createdAt: string;
  type: MediaType;
  source: MediaSource;
  width?: number;
  height?: number;
  exif?: Record<string, any>;
  favorite?: boolean;
};

type AlbumId = "all" | "device" | "videos" | "favorites";

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

function detectTypeFromName(nameOrUrl: string): MediaType {
  const lower = nameOrUrl.toLowerCase();
  if (/\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(lower)) return "video";
  return "photo";
}

// Used to deduplicate device/server/mock copies of the same photo
function buildDedupKey(item: MediaItem): string {
  // Use createdAt (to the second) + resolution.
  // Device + server copies share this if they represent the same asset.
  const timePart = item.createdAt.slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
  const sizePart =
    item.width && item.height ? `${item.width}x${item.height}` : "";

  return `${timePart}|${sizePart}`;
}

// -----------------------------------------------------------------------------
// Demo data
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
// Grouping helpers
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
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
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
// Fullscreen Viewer (swipe + zoom + metadata + favorite + delete)
// -----------------------------------------------------------------------------

type ViewerProps = {
  images: MediaItem[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
  onToggleFavorite?: (item: MediaItem) => void;
  onDeleteCurrent?: (item: MediaItem) => void;
};

const FullscreenViewer: React.FC<ViewerProps> = ({
  images,
  imageIndex,
  visible,
  onRequestClose,
  onToggleFavorite,
  onDeleteCurrent,
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

  const handleToggleFavPress = () => {
    if (!current || !onToggleFavorite) return;
    onToggleFavorite(current);
  };

  const handleDeletePress = () => {
    if (!current || !onDeleteCurrent) return;
    onDeleteCurrent(current);
  };

  return (
    <View style={styles.viewerBackdropOuter}>
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
    <View
      style={[
        styles.viewerPage,
        { width, height },
      ]}
    >
      <ZoomableImage uri={item.uri} />
    </View>
  )}
  // 👇 Tell FlatList how big each page is
  getItemLayout={(_, index) => ({
    length: width,
    offset: width * index,
    index,
  })}
  // 👇 Retry if it fails to scroll on the first attempt
  onScrollToIndexFailed={(info) => {
    const wait = new Promise<void>((resolve) => setTimeout(resolve, 50));
    wait.then(() => {
      if (listRef.current) {
        listRef.current.scrollToIndex({
          index: info.index,
          animated: false,
        });
      }
    });
  }}
/>


        {/* Top bar */}
        <View style={styles.viewerTopBar}>
          <TouchableOpacity
            onPress={onRequestClose}
            style={styles.viewerCloseButton}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </TouchableOpacity>

          <View style={styles.viewerTopBarRight}>
            {/* Favorite */}
            {current && onToggleFavorite && (
              <TouchableOpacity
                onPress={handleToggleFavPress}
                style={styles.viewerIconButton}
              >
                <Text
                  style={[
                    styles.viewerIconText,
                    current.favorite && styles.viewerIconTextActive,
                  ]}
                >
                  {current.favorite ? "♥" : "♡"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Delete from NAS (only for server items) */}
            {current &&
              current.source === "server" &&
              onDeleteCurrent && (
                <TouchableOpacity
                  onPress={handleDeletePress}
                  style={styles.viewerDeleteButton}
                >
                  <Text style={styles.viewerDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}

            <View style={styles.viewerCounter}>
              <Text style={styles.viewerCounterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom metadata */}
        {current && (
          <View style={styles.viewerMetaBar}>
            <Text numberOfLines={2} style={styles.viewerMetaText}>
              {formatDateTime(current.createdAt)}
              {current.width && current.height
                ? ` · ${current.width}×${current.height}`
                : ""}
              {current.type === "video" ? " · Video" : " · Photo"}
              {current.source === "server" ? " · On NAS" : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// -----------------------------------------------------------------------------
// Main Screen
// -----------------------------------------------------------------------------

export default function LibraryScreen() {
  const { token } = useAuth();

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

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameText, setRenameText] = useState("");

  // Selection + upload queue
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);

  // Search (Step 9)
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCount = selectedIds.size;

  const activeManualAlbum = useMemo(() => {
    if (!activeAlbum || activeAlbum.kind !== "manual") return null;
    return manualAlbums.find((a) => a.id === activeAlbum.id) ?? null;
  }, [activeAlbum, manualAlbums]);

  // Build albums list (includes Favorites smart album)
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
    makeSmart("favorites", "Favorites", (m) => m.favorite === true);
    makeSmart("device", "From device", (m) => m.source === "device");
    makeSmart("videos", "Videos", (m) => m.type === "video");

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

  // Media for timeline (album + filter + search + dedupe)
  const mediaForTimeline = useMemo(() => {
    let base = media;

    // Album filter
    if (!albumEditMode && activeAlbum) {
      if (activeAlbum.kind === "smart") {
        if (activeAlbum.id === "device") {
          base = base.filter((m) => m.source === "device");
        } else if (activeAlbum.id === "videos") {
          base = base.filter((m) => m.type === "video");
        } else if (activeAlbum.id === "favorites") {
          base = base.filter((m) => m.favorite);
        }
      } else if (activeAlbum.kind === "manual") {
        const album = manualAlbums.find((a) => a.id === activeAlbum.id);
        if (album) {
          base = base.filter((m) => album.mediaIds.includes(m.id));
        }
      }
    }

    // Type filter
    if (filter === "photos") base = base.filter((m) => m.type === "photo");
    if (filter === "videos") base = base.filter((m) => m.type === "video");

    // Search filter (Step 9)
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      base = base.filter((m) => {
        const d = new Date(m.createdAt);
        const text = [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          m.source,
          m.type,
          m.favorite ? "favorite" : "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    // 🔥 Dedupe device/server/mock duplicates by key
    const priority = (source: MediaSource) => {
      if (source === "server") return 3;
      if (source === "device") return 2;
      if (source === "mock") return 1;
      return 0;
    };

    // Group items by dedup key
    const buckets = new Map<string, MediaItem[]>();
    for (const item of base) {
      const key = buildDedupKey(item);
      const arr = buckets.get(key);
      if (arr) arr.push(item);
      else buckets.set(key, [item]);
    }

    const deduped: MediaItem[] = [];
    for (const items of buckets.values()) {
      let best = items[0];
      for (const item of items) {
        if (priority(item.source) > priority(best.source)) {
          best = item;
        }
      }
      deduped.push(best);
    }

    return deduped;
  }, [
    media,
    filter,
    activeAlbum,
    albumEditMode,
    manualAlbums,
    searchQuery,
  ]);

  const groups = useMemo(
    () => groupMedia(mediaForTimeline),
    [mediaForTimeline]
  );

  // Pull-to-refresh (demo)
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

  // Sync from NAS
  const syncFromServer = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${NAS_BASE_URL}/media`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.warn("Failed to fetch NAS media:", await res.text());
        return;
      }

      const data: any[] = await res.json();

      const serverItems: MediaItem[] = (data ?? []).map((item: any) => {
        const url: string = item.url;
        const baseName: string =
          typeof item.id === "string" && item.id.length ? item.id : url;

        const type = detectTypeFromName(baseName);

        let createdAtIso = new Date().toISOString();
        if (item.createdAt) {
          try {
            createdAtIso = new Date(item.createdAt).toISOString();
          } catch {
            // ignore parse error
          }
        }

        return {
          id: `server-${item.id}`,
          uri: url,
          createdAt: createdAtIso,
          type,
          source: "server",
          width: item.width,
          height: item.height,
        };
      });

      setMedia((prev): MediaItem[] => {
        const existingIds = new Set(prev.map((m) => m.id));
        const merged = [...prev];
        for (const item of serverItems) {
          if (!existingIds.has(item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });
    } catch (err) {
      console.error("Error syncing NAS media", err);
    }
  }, [token]);

  const handleSyncClick = useCallback(async () => {
    setSyncing(true);
    await Promise.all([handleRefresh(), syncFromServer()]);
    setSyncing(false);
  }, [handleRefresh, syncFromServer]);

  // Auto-sync once when token appears
  useEffect(() => {
    if (!token) return;
    syncFromServer();
  }, [token, syncFromServer]);

  // Scan device
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

  // Selection
  const toggleSelectMode = () => {
    if (selectMode) setSelectedIds(new Set());
    setSelectMode((prev) => !prev);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Upload one item to NAS
  const uploadOneToNas = useCallback(
    async (item: MediaItem): Promise<boolean> => {
      try {
        if (!token) {
          Alert.alert(
            "Not logged in",
            "Please sign in before uploading to NAS."
          );
          return false;
        }

        if (item.source === "device" && Platform.OS !== "web") {
          const formData = new FormData();

          const file: any = {
            uri: item.uri,
            name:
              (item.type === "video" ? "video-" : "photo-") +
              item.id +
              (item.type === "video" ? ".mp4" : ".jpg"),
            type: item.type === "video" ? "video/mp4" : "image/jpeg",
          };

          // 👇 send original metadata to server
          formData.append("takenAt", item.createdAt);
          if (item.width != null) {
            formData.append("width", String(item.width));
          }
          if (item.height != null) {
            formData.append("height", String(item.height));
          }

          formData.append("file", file);

          const res = await fetch(`${NAS_BASE_URL}/upload`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!res.ok) {
            console.warn("Upload failed", await res.text());
            return false;
          }

          return true;
        }

        // For mock or web, simulate
        await new Promise((res) => setTimeout(res, 400));
        return true;
      } catch (err) {
        console.error("Upload error", err);
        return false;
      }
    },
    [token]
  );

  const handleUploadSelected = useCallback(async () => {
    if (selectedCount === 0) {
      Alert.alert("Nothing selected", "Select some items first.");
      return;
    }

    const itemsToUpload = media.filter(
      (m) => selectedIds.has(m.id) && m.source !== "server"
    );

    if (itemsToUpload.length === 0) {
      Alert.alert(
        "Already uploaded",
        "All selected items are already on the server."
      );
      return;
    }

    setUploading(true);
    setUploadTotal(itemsToUpload.length);
    setUploadIndex(0);

    let successCount = 0;

    for (let i = 0; i < itemsToUpload.length; i++) {
      setUploadIndex(i);
      const item = itemsToUpload[i];

      const ok = await uploadOneToNas(item);

      if (ok) {
        successCount++;
        setMedia((prev) =>
          prev.map((m) =>
            m.id === item.id ? { ...m, source: "server" } : m
          )
        );
      }
    }

    setUploading(false);
    setSelectedIds(new Set());
    setSelectMode(false);

    Alert.alert(
      "Upload complete",
      `Uploaded ${successCount} of ${itemsToUpload.length} item(s) to NAS.`
    );
  }, [media, selectedCount, selectedIds, uploadOneToNas]);

  // Manual albums

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
  };

  const handlePressAlbum = (album: AlbumInfo) => {
    setAlbumEditMode(false);
    if (album.kind === "smart") {
      const smartId = album.id as AlbumId;
      if (smartId === "all") setActiveAlbum(null);
      else setActiveAlbum({ kind: "smart", id: smartId });
    } else {
      setActiveAlbum({ kind: "manual", id: album.id });
    }
  };

  const toggleAlbumEditMode = () => {
    if (!activeManualAlbum) return;
    setAlbumEditMode((prev) => !prev);
  };

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

  // Favorites (Step 8)
  const handleToggleFavorite = useCallback((item: MediaItem) => {
    setMedia((prev) =>
      prev.map((m) =>
        m.id === item.id ? { ...m, favorite: !m.favorite } : m
      )
    );
  }, []);

  // Delete from NAS (Step 6)
  const handleDeleteFromNas = useCallback(
    (item: MediaItem) => {
      if (item.source !== "server") {
        Alert.alert(
          "Not on NAS",
          "This photo is not stored on the NAS yet."
        );
        return;
      }

      Alert.alert(
        "Delete from NAS",
        "Delete this photo from your NAS? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (!token) {
                Alert.alert(
                  "Not logged in",
                  "Please sign in first."
                );
                return;
              }

              try {
                const serverId = item.id.startsWith("server-")
                  ? item.id.slice("server-".length)
                  : item.id;

                const res = await fetch(
                  `${NAS_BASE_URL}/media/${encodeURIComponent(
                    serverId
                  )}`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                );

                if (!res.ok) {
                  console.warn(
                    "Delete failed",
                    await res.text()
                  );
                  Alert.alert(
                    "Error",
                    "Failed to delete from NAS."
                  );
                  return;
                }

                // Remove server version from local state
                setMedia((prev) =>
                  prev.filter((m) => m.id !== item.id)
                );
                setViewerVisible(false);
              } catch (err) {
                console.error("Delete error", err);
                Alert.alert(
                  "Error",
                  "Failed to delete from NAS."
                );
              }
            },
          },
        ]
      );
    },
    [token]
  );

  // Opening photos
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

    const photos = allItems.filter((i) => i.type === "photo");
    const clicked = allItems[index];
    let start = photos.findIndex((p) => p.id === clicked.id);
    if (start === -1) start = 0;

    setViewerItems(photos);
    setViewerIndex(start);
    setViewerVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <ScreenContainer>
        <Header title="Library" subtitle="Timeline of backed up media" />

        {/* Filters + search + actions + albums */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Filter & sources</Text>

            <TouchableOpacity
              onPress={toggleSelectMode}
              style={[
                styles.selectButton,
                selectMode && styles.selectButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  selectMode && styles.selectButtonTextActive,
                ]}
              >
                {selectMode ? "Cancel" : "Select"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search (Step 9) */}
          <View style={styles.searchRow}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by date, time, source, type, favorite..."
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
            />
          </View>

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

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={handleSyncClick}
              style={styles.actionButton}
              disabled={syncing}
            >
              <Text style={styles.actionButtonText}>
                {syncing ? "Syncing..." : "Sync (demo + NAS)"}
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

          {/* Albums */}
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
                    ? "Tap photos to add/remove. Long press one to set cover."
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

        {/* Upload queue */}
        {(selectMode || uploading) && (
          <View style={styles.uploadCard}>
            <View style={styles.uploadRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.uploadTitle}>Upload to NAS</Text>
                {!uploading ? (
                  <Text style={styles.uploadSubtitle}>
                    {selectedCount === 0
                      ? "Select photos you want to back up."
                      : `${selectedCount} item(s) selected.`}
                  </Text>
                ) : (
                  <Text style={styles.uploadSubtitle}>
                    Uploading {uploadIndex + 1} of {uploadTotal}...
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  (selectedCount === 0 || uploading) && { opacity: 0.6 },
                ]}
                onPress={handleUploadSelected}
                disabled={selectedCount === 0 || uploading}
              >
                <Text style={styles.uploadButtonText}>
                  {uploading ? "Uploading..." : "Upload to NAS"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                    const isSelectedForUpload = selectedIds.has(item.id);

                    return (
                      <TouchableOpacity
                        style={[
                          styles.gridItem,
                          albumEditMode &&
                            activeManualAlbum &&
                            isInActiveManualAlbum &&
                            styles.gridItemSelected,
                          !albumEditMode &&
                            selectMode &&
                            isSelectedForUpload &&
                            styles.gridItemSelected,
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
                        {item.source === "server" && (
                          <View style={styles.serverBadge}>
                            <Text style={styles.serverBadgeText}>Server</Text>
                          </View>
                        )}
                        {item.favorite && (
                          <View style={styles.favoriteBadge}>
                            <Text style={styles.favoriteBadgeText}>♥</Text>
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
                        {!albumEditMode &&
                          selectMode &&
                          isSelectedForUpload && (
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
      {viewerVisible && (
        <FullscreenViewer
          images={viewerItems}
          imageIndex={viewerIndex}
          visible={viewerVisible}
          onRequestClose={() => setViewerVisible(false)}
          onToggleFavorite={handleToggleFavorite}
          onDeleteCurrent={handleDeleteFromNas}
        />
      )}

      {/* Rename album modal */}
      <View>
        {/* Keep your existing rename modal here if you had one previously.
           (Removed here for brevity; you can reinsert your previous modal code.) */}
      </View>
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
  searchRow: {
    marginBottom: 8,
    marginTop: 4,
  },
  searchInput: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2933",
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: "#e5e7eb",
    fontSize: 12,
    backgroundColor: "#020617",
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
  selectButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectButtonActive: {
    borderColor: "#38bdf8",
    backgroundColor: "#0f172a",
  },
  selectButtonText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  selectButtonTextActive: {
    color: "#38bdf8",
  },
  uploadCard: {
    backgroundColor: "#020617",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  uploadSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  uploadButton: {
    borderRadius: 999,
    backgroundColor: "#38bdf8",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
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
  serverBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: "rgba(5,46,22,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  serverBadgeText: {
    fontSize: 10,
    color: "#bbf7d0",
    fontWeight: "500",
  },
  favoriteBadge: {
    position: "absolute",
    right: 4,
    top: 4,
    backgroundColor: "rgba(127,29,29,0.85)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  favoriteBadgeText: {
    fontSize: 10,
    color: "#fecaca",
    fontWeight: "700",
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
  // Fullscreen viewer styles
  viewerBackdropOuter: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
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
    alignItems: "center",
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
  viewerTopBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewerIconButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  viewerIconText: {
    fontSize: 16,
    color: "#e5e7eb",
  },
  viewerIconTextActive: {
    color: "#f97373",
  },
  viewerDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(127,29,29,0.85)",
  },
  viewerDeleteText: {
    color: "#fee2e2",
    fontSize: 13,
    fontWeight: "600",
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
