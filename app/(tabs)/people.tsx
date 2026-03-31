// app/(tabs)/people.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { NAS_BASE_URL, useAuth } from "../auth-context";
import {
  getManualAlbumSnapshots,
  ManualAlbumSnapshot,
  subscribeManualAlbumSnapshots,
} from "../manual-albums-store";
import { Header, ScreenContainer } from "./_components";

type ServerMediaItem = {
  id: string;
  url: string;
  originalUrl?: string;
  createdAt?: string;
  width?: number;
  height?: number;
  originalName?: string;
  mimetype?: string;
  tags?: string[];
  tagStatus?: string;
  tagModel?: string;
};

type AlbumMediaItem = {
  id: string;
  uri: string;
};

type SuggestedAlbum = {
  id: string;
  name: string;
  kind: "person" | "suggested";
  count: number;
  coverUri?: string;
  badge?: string;
  media: AlbumMediaItem[];
};

const PERSON_TAGS = [
  "person",
  "people",
  "selfie",
  "portrait",
  "face",
  "man",
  "woman",
  "child",
  "boy",
  "girl",
];

const ALBUM_RULES: Array<{
  id: string;
  name: string;
  matchTags: string[];
  minCount?: number;
}> = [
  {
    id: "pets",
    name: "Pets",
    matchTags: ["pet", "animal", "cat", "dog", "kitten", "puppy"],
    minCount: 2,
  },
  {
    id: "cats",
    name: "Cats",
    matchTags: ["cat", "kitten", "feline"],
    minCount: 2,
  },
  {
    id: "dogs",
    name: "Dogs",
    matchTags: ["dog", "puppy", "canine"],
    minCount: 2,
  },
  {
    id: "vacations",
    name: "Vacations",
    matchTags: [
      "vacation",
      "travel",
      "trip",
      "beach",
      "sea",
      "ocean",
      "mountain",
      "hotel",
      "sunset",
      "landscape",
    ],
    minCount: 2,
  },
  {
    id: "food",
    name: "Food",
    matchTags: ["food", "meal", "dish", "dessert", "drink", "coffee"],
    minCount: 2,
  },
  {
    id: "cars",
    name: "Cars",
    matchTags: ["car", "vehicle", "automobile"],
    minCount: 2,
  },
  {
    id: "nature",
    name: "Nature",
    matchTags: ["tree", "forest", "flower", "mountain", "lake", "river"],
    minCount: 2,
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeTags(tags?: string[]) {
  return Array.isArray(tags)
    ? tags.map((tag) => normalizeText(String(tag))).filter(Boolean)
    : [];
}

function dedupeMedia(items: ServerMediaItem[]) {
  const seen = new Set<string>();
  const out: ServerMediaItem[] = [];

  for (const item of items) {
    const key = `${String(item.createdAt || "").slice(0, 19)}|${
      item.width || ""
    }x${item.height || ""}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function buildPlaceholderPeople(media: ServerMediaItem[]): SuggestedAlbum[] {
  const candidates = media.filter((item) => {
    const tags = normalizeTags(item.tags);
    return tags.some((tag) => PERSON_TAGS.includes(tag));
  });

  if (!candidates.length) return [];

  const deduped = dedupeMedia(candidates);
  const chunkSize = 12;
  const groups: SuggestedAlbum[] = [];

  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize);
    if (!chunk.length) continue;

    groups.push({
      id: `person-placeholder-${i / chunkSize + 1}`,
      name: `Unknown ${i / chunkSize + 1}`,
      kind: "person",
      badge: "Placeholder",
      count: chunk.length,
      coverUri: chunk[0]?.url,
      media: chunk.map((item) => ({
        id: item.id,
        uri: item.url,
      })),
    });
  }

  return groups;
}

function buildSuggestedAlbums(media: ServerMediaItem[]): SuggestedAlbum[] {
  const result: SuggestedAlbum[] = [];

  for (const rule of ALBUM_RULES) {
    const matched = dedupeMedia(
      media.filter((item) => {
        const tags = normalizeTags(item.tags);
        return tags.some((tag) => rule.matchTags.includes(tag));
      }),
    );

    if (matched.length < (rule.minCount ?? 2)) continue;

    result.push({
      id: rule.id,
      name: rule.name,
      kind: "suggested",
      count: matched.length,
      coverUri: matched[0]?.url,
      media: matched.map((item) => ({
        id: item.id,
        uri: item.url,
      })),
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export default function AlbumsScreen() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverMedia, setServerMedia] = useState<ServerMediaItem[]>([]);
  const [manualAlbums, setManualAlbums] = useState<ManualAlbumSnapshot[]>(
    getManualAlbumSnapshots(),
  );
  const [search, setSearch] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState<SuggestedAlbum | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = subscribeManualAlbumSnapshots(setManualAlbums);
    return unsubscribe;
  }, []);

  const loadAlbums = useCallback(async () => {
    if (!token) {
      setServerMedia([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${NAS_BASE_URL}/media`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setServerMedia(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load albums from server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlbums();
  }, [loadAlbums]);

  const suggestedPeople = useMemo(
    () => buildPlaceholderPeople(serverMedia),
    [serverMedia],
  );

  const suggestedAlbums = useMemo(
    () => buildSuggestedAlbums(serverMedia),
    [serverMedia],
  );

  const filteredPeople = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return suggestedPeople;
    return suggestedPeople.filter((album) =>
      normalizeText(album.name).includes(q),
    );
  }, [search, suggestedPeople]);

  const filteredSuggested = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return suggestedAlbums;
    return suggestedAlbums.filter((album) =>
      normalizeText(album.name).includes(q),
    );
  }, [search, suggestedAlbums]);

  const filteredManual = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return manualAlbums;
    return manualAlbums.filter((album) =>
      normalizeText(album.title).includes(q),
    );
  }, [manualAlbums, search]);

  const openAlbum = useCallback((album: SuggestedAlbum) => {
    setSelectedAlbum(album);
  }, []);

  const closeAlbum = useCallback(() => {
    setSelectedAlbum(null);
  }, []);

  return (
    <>
      <ScreenContainer>
        <Header
          title="Albums"
          subtitle="Suggested people, smart albums, and your manual albums"
        />

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Search albums</Text>
            <Text style={styles.cardHint}>
              People are placeholder groups for now. Suggested albums are real.
            </Text>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search albums..."
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={[styles.emptySubtitle, { marginTop: 8 }]}>
              Loading albums...
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
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Suggested People</Text>
                <Text style={styles.sectionMeta}>
                  {filteredPeople.length} group
                  {filteredPeople.length === 1 ? "" : "s"}
                </Text>
              </View>

              {filteredPeople.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionTitle}>
                    No people groups yet
                  </Text>
                  <Text style={styles.emptySectionSubtitle}>
                    These are placeholders for future face grouping.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {filteredPeople.map((album) => (
                    <TouchableOpacity
                      key={album.id}
                      style={styles.personCard}
                      activeOpacity={0.85}
                      onPress={() => openAlbum(album)}
                    >
                      <Image
                        source={{
                          uri:
                            album.coverUri ||
                            "https://via.placeholder.com/200x200.png?text=Person",
                        }}
                        style={styles.personImage}
                      />
                      <Text style={styles.personName} numberOfLines={1}>
                        {album.name}
                      </Text>
                      <Text style={styles.personCount}>
                        {album.count} photo{album.count === 1 ? "" : "s"}
                      </Text>
                      {!!album.badge && (
                        <View style={styles.personBadge}>
                          <Text style={styles.personBadgeText}>
                            {album.badge}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Suggested Albums</Text>
                <Text style={styles.sectionMeta}>
                  {filteredSuggested.length} album
                  {filteredSuggested.length === 1 ? "" : "s"}
                </Text>
              </View>

              {filteredSuggested.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionTitle}>
                    No suggested albums yet
                  </Text>
                  <Text style={styles.emptySectionSubtitle}>
                    Upload more tagged photos first.
                  </Text>
                </View>
              ) : (
                <View style={styles.albumGrid}>
                  {filteredSuggested.map((album) => (
                    <TouchableOpacity
                      key={album.id}
                      style={styles.albumCard}
                      activeOpacity={0.85}
                      onPress={() => openAlbum(album)}
                    >
                      <Image
                        source={{
                          uri:
                            album.coverUri ||
                            "https://via.placeholder.com/400x400.png?text=Album",
                        }}
                        style={styles.albumCover}
                      />
                      <Text style={styles.albumTitle} numberOfLines={1}>
                        {album.name}
                      </Text>
                      <Text style={styles.albumCount}>
                        {album.count} item{album.count === 1 ? "" : "s"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.section, { marginBottom: 12 }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Manual Albums</Text>
                <Text style={styles.sectionMeta}>
                  {filteredManual.length} album
                  {filteredManual.length === 1 ? "" : "s"}
                </Text>
              </View>

              {filteredManual.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionTitle}>
                    No manual albums yet
                  </Text>
                  <Text style={styles.emptySectionSubtitle}>
                    Create one from the Library tab.
                  </Text>
                </View>
              ) : (
                <View style={styles.albumGrid}>
                  {filteredManual.map((album) => (
                    <TouchableOpacity
                      key={album.id}
                      style={styles.albumCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        Alert.alert(
                          album.title,
                          "For now, manual albums are edited in the Library tab.",
                        )
                      }
                    >
                      {album.coverUri ? (
                        <Image
                          source={{ uri: album.coverUri }}
                          style={styles.albumCover}
                        />
                      ) : (
                        <View
                          style={[styles.albumCover, styles.albumCoverFallback]}
                        >
                          <Text style={styles.albumCoverFallbackText}>
                            Album
                          </Text>
                        </View>
                      )}
                      <Text style={styles.albumTitle} numberOfLines={1}>
                        {album.title}
                      </Text>
                      <Text style={styles.albumCount}>
                        {album.count} item{album.count === 1 ? "" : "s"}
                      </Text>
                      <Text style={styles.manualBadge}>Manual</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </ScreenContainer>

      <Modal
        visible={!!selectedAlbum}
        transparent
        animationType="fade"
        onRequestClose={closeAlbum}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdrop} onPress={closeAlbum} />

          {selectedAlbum && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.modalTitle}>{selectedAlbum.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedAlbum.count} photo
                    {selectedAlbum.count === 1 ? "" : "s"}
                    {selectedAlbum.kind === "person"
                      ? " · face placeholder"
                      : " · suggested album"}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeAlbum}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={selectedAlbum.media}
                keyExtractor={(item) => item.id}
                numColumns={3}
                scrollEnabled
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={{ paddingTop: 6, paddingBottom: 8 }}
                renderItem={({ item }) => (
                  <View style={styles.gridItem}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.gridImage}
                    />
                  </View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2933",
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  cardHint: {
    fontSize: 11,
    color: "#6b7280",
    maxWidth: "60%",
    textAlign: "right",
  },
  searchBox: {
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2933",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#020617",
  },
  searchInput: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  section: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  sectionMeta: {
    fontSize: 12,
    color: "#9ca3af",
  },
  horizontalList: {
    paddingRight: 8,
    gap: 12,
  },
  personCard: {
    width: 96,
    alignItems: "center",
  },
  personImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#111827",
    marginBottom: 8,
  },
  personName: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "500",
  },
  personCount: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  personBadge: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  personBadgeText: {
    color: "#f97316",
    fontSize: 10,
    fontWeight: "600",
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  albumCard: {
    width: "47%",
    backgroundColor: "#020617",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2933",
    padding: 8,
  },
  albumCover: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#111827",
    marginBottom: 8,
  },
  albumCoverFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  albumCoverFallbackText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  albumTitle: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  albumCount: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  manualBadge: {
    marginTop: 6,
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 40,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  emptySectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2933",
    padding: 14,
    backgroundColor: "#020617",
  },
  emptySectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  emptySectionSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    position: "absolute",
    top: 40,
    bottom: 24,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2933",
    backgroundColor: "#020617",
    padding: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  modalTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 4,
  },
  modalCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modalCloseText: {
    color: "#e5e7eb",
    fontSize: 12,
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
    backgroundColor: "#111827",
  },
});
