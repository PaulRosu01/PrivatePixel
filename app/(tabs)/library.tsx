// app/(tabs)/library.tsx
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { ScreenContainer, Header } from "./_components";

type Photo = {
  id: string;
  uri: string;
  createdAt: string; // ISO date string
};

// -----------------------------------------------------------------------------
// Demo data – this simulates what you'd later receive from your backend
// -----------------------------------------------------------------------------

const initialPhotos: Photo[] = [
  {
    id: "1",
    uri: "https://picsum.photos/400?random=11",
    createdAt: new Date().toISOString(), // today
  },
  {
    id: "2",
    uri: "https://picsum.photos/400?random=12",
    createdAt: new Date().toISOString(), // today
  },
  {
    id: "3",
    uri: "https://picsum.photos/400?random=13",
    createdAt: daysAgo(2),
  },
  {
    id: "4",
    uri: "https://picsum.photos/400?random=14",
    createdAt: daysAgo(4),
  },
  {
    id: "5",
    uri: "https://picsum.photos/400?random=15",
    createdAt: daysAgo(9),
  },
  {
    id: "6",
    uri: "https://picsum.photos/400?random=16",
    createdAt: daysAgo(20),
  },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// -----------------------------------------------------------------------------
// Helpers – grouping photos by date "buckets"
// -----------------------------------------------------------------------------

type GroupKey = "Today" | "This week" | "Earlier";

type GroupedPhotos = {
  group: GroupKey;
  items: Photo[];
};

function groupPhotos(photos: Photo[]): GroupedPhotos[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const weekAgo = new Date(todayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<GroupKey, Photo[]> = {
    Today: [],
    "This week": [],
    Earlier: [],
  };

  for (const photo of photos) {
    const created = new Date(photo.createdAt);
    if (created >= todayStart) {
      buckets["Today"].push(photo);
    } else if (created >= weekAgo) {
      buckets["This week"].push(photo);
    } else {
      buckets["Earlier"].push(photo);
    }
  }

  const result: GroupedPhotos[] = [];
  (["Today", "This week", "Earlier"] as GroupKey[]).forEach((key) => {
    if (buckets[key].length > 0) {
      result.push({ group: key, items: buckets[key] });
    }
  });

  return result;
}

// -----------------------------------------------------------------------------
// Screen component
// -----------------------------------------------------------------------------

export default function LibraryScreen() {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [filter, setFilter] = useState<"all" | "photos" | "videos">("all"); // videos later
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const groups = useMemo(() => {
    // later you can filter by mediaType when you have real data
    const visible = photos; // for now all are photos
    return groupPhotos(visible);
  }, [photos, filter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // here you'd call your backend: GET /api/library
    await new Promise((resolve) => setTimeout(resolve, 700));

    // demo: prepend a "new" photo as if it came from server
    const newPhoto: Photo = {
      id: String(Date.now()),
      uri: "https://picsum.photos/400?random=" + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
    };
    setPhotos((prev) => [newPhoto, ...prev]);
    setRefreshing(false);
  }, []);

  const handleSyncClick = useCallback(async () => {
    setSyncing(true);
    await handleRefresh();
    setSyncing(false);
  }, [handleRefresh]);

  return (
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
          <Text style={styles.emptyTitle}>No media yet</Text>
          <Text style={styles.emptySubtitle}>
            Once your phone starts backing up to your server, photos and videos
            will appear here.
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
                  <View style={styles.gridItem}>
                    <Image source={{ uri: item.uri }} style={styles.gridImage} />
                  </View>
                )}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
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
