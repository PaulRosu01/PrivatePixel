// app/(tabs)/library.tsx
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Header, ScreenContainer } from "./_components";

type MediaType = "photo" | "video";

type MediaItem = {
  id: string;
  uri: string;
  createdAt: string; // ISO date
  type: MediaType;
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
  },
  {
    id: "2",
    uri: "https://picsum.photos/400?random=12",
    createdAt: new Date().toISOString(),
    type: "photo",
  },
  {
    id: "3",
    uri: "https://picsum.photos/400?random=13",
    createdAt: daysAgo(1),
    type: "video",
  },
  {
    id: "4",
    uri: "https://picsum.photos/400?random=14",
    createdAt: daysAgo(2),
    type: "photo",
  },
  {
    id: "5",
    uri: "https://picsum.photos/400?random=15",
    createdAt: daysAgo(5),
    type: "video",
  },
  {
    id: "6",
    uri: "https://picsum.photos/400?random=16",
    createdAt: daysAgo(12),
    type: "photo",
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

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

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
    };
    setMedia((prev) => [newItem, ...prev]);
    setRefreshing(false);
  }, []);

  const handleSyncClick = useCallback(async () => {
    setSyncing(true);
    await handleRefresh();
    setSyncing(false);
  }, [handleRefresh]);

  const handleItemPress = (item: MediaItem) => {
    setSelectedItem(item);
  };

  const closeViewer = () => {
    setSelectedItem(null);
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
            <Text style={styles.cardTitle}>Filter</Text>
            <TouchableOpacity
              onPress={handleSyncClick}
              style={[styles.syncButton, syncing && { opacity: 0.7 }]}
              disabled={syncing}
            >
              <Text style={styles.syncButtonText}>
                {syncing ? "Syncing..." : "Sync with server (demo)"}
              </Text>
            </TouchableOpacity>
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
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No media in this filter</Text>
            <Text style={styles.emptySubtitle}>
              Try selecting another filter or sync with your server.
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
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.gridItem}
                      onPress={() => handleItemPress(item)}
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
                    </TouchableOpacity>
                  )}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </ScreenContainer>

      {/* Fullscreen viewer */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdrop} onPress={closeViewer}>
            {/* Block touches to background but allow them on content */}
          </Pressable>

          {selectedItem && (
            <View style={styles.modalContent}>
              <Image
                source={{ uri: selectedItem.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
              <View style={styles.modalTopBar}>
                <Text style={styles.modalTitle}>
                  {selectedItem.type === "video" ? "Video" : "Photo"} •{" "}
                  {new Date(selectedItem.createdAt).toLocaleString()}
                </Text>
                <TouchableOpacity
                  onPress={closeViewer}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  syncButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  syncButtonText: {
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 40,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  fullImage: {
    flex: 1,
    width: "100%",
  },
  modalTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  modalTitle: {
    fontSize: 12,
    color: "#e5e7eb",
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  closeButtonText: {
    fontSize: 12,
    color: "#e5e7eb",
    fontWeight: "500",
  },
});
