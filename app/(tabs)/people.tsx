// app/(tabs)/people.tsx
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header, ScreenContainer } from "./_components";

type MediaItem = {
  id: string;
  uri: string;
};

type Person = {
  id: string;
  name: string;
  isKnown: boolean;
  count: number;
  avatarUri: string;
  media: MediaItem[];
};

// -----------------------------------------------------------------------------
// Mock people data – later this would come from your backend / AI worker
// -----------------------------------------------------------------------------

const initialPeople: Person[] = [
  {
    id: "you",
    name: "You",
    isKnown: true,
    count: 128,
    avatarUri: "https://picsum.photos/200?random=201",
    media: makeMockMedia("you", 12),
  },
  {
    id: "u1",
    name: "Unknown 1",
    isKnown: false,
    count: 57,
    avatarUri: "https://picsum.photos/200?random=202",
    media: makeMockMedia("u1", 8),
  },
  {
    id: "u2",
    name: "Unknown 2",
    isKnown: false,
    count: 34,
    avatarUri: "https://picsum.photos/200?random=203",
    media: makeMockMedia("u2", 9),
  },
  {
    id: "u3",
    name: "Unknown 3",
    isKnown: false,
    count: 19,
    avatarUri: "https://picsum.photos/200?random=204",
    media: makeMockMedia("u3", 6),
  },
];

function makeMockMedia(seed: string, count: number): MediaItem[] {
  return Array.from({ length: count }).map((_, idx) => ({
    id: `${seed}-${idx}`,
    uri: `https://picsum.photos/400?random=${seed.length * 10 + idx}`,
  }));
}

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------

export default function PeopleScreen() {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [filter, setFilter] = useState<"all" | "known" | "unknown">("all");
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const filteredPeople = useMemo(() => {
    let result = people;

    if (filter === "known") {
      result = result.filter((p) => p.isKnown);
    } else if (filter === "unknown") {
      result = result.filter((p) => !p.isKnown);
    }

    if (search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    return result;
  }, [people, filter, search]);

  const openPerson = useCallback((person: Person) => {
    setSelectedPerson(person);
    setEditingName(person.name);
  }, []);

  const closePerson = useCallback(() => {
    setSelectedPerson(null);
    setEditingName("");
    setSavingName(false);
  }, []);

  const handleSaveName = useCallback(() => {
    if (!selectedPerson) return;
    const newName = editingName.trim();
    if (!newName) return;

    setSavingName(true);
    setTimeout(() => {
      setPeople((prev) =>
        prev.map((p) =>
          p.id === selectedPerson.id ? { ...p, name: newName, isKnown: true } : p
        )
      );
      setSelectedPerson((prev) =>
        prev ? { ...prev, name: newName, isKnown: true } : prev
      );
      setSavingName(false);
    }, 400);
  }, [editingName, selectedPerson]);

  return (
    <>
      <ScreenContainer>
        <Header
          title="People"
          subtitle="Automatically grouped by faces"
        />

        {/* Filter + search */}
        <View style={[styles.card, { marginBottom: 12 }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Filter</Text>
            <Text style={styles.cardHint}>
              These clusters come from your AI worker (demo).
            </Text>
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
                filter === "known" && styles.segmentItemActive,
              ]}
              onPress={() => setFilter("known")}
            >
              <Text
                style={[
                  styles.segmentItemText,
                  filter === "known" && styles.segmentItemTextActive,
                ]}
              >
                Named
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                filter === "unknown" && styles.segmentItemActive,
              ]}
              onPress={() => setFilter("unknown")}
            >
              <Text
                style={[
                  styles.segmentItemText,
                  filter === "unknown" && styles.segmentItemTextActive,
                ]}
              >
                Unknown
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search people..."
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
            />
          </View>
        </View>

        {filteredPeople.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No people found</Text>
            <Text style={styles.emptySubtitle}>
              Try changing the filter or search query.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.peopleGrid}>
              {filteredPeople.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.personCard}
                  activeOpacity={0.8}
                  onPress={() => openPerson(p)}
                >
                  <View>
                    <Image
                      source={{ uri: p.avatarUri }}
                      style={styles.personImage}
                    />
                    {!p.isKnown && (
                      <View style={styles.personBadge}>
                        <Text style={styles.personBadgeText}>Unknown</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.personName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.personCount}>{p.count} photos</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </ScreenContainer>

      {/* Person details modal */}
      <Modal
        visible={!!selectedPerson}
        transparent
        animationType="fade"
        onRequestClose={closePerson}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdrop} onPress={closePerson} />

          {selectedPerson && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalPersonInfo}>
                  <Image
                    source={{ uri: selectedPerson.avatarUri }}
                    style={styles.modalAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>Name</Text>
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      placeholder="Add a name"
                      placeholderTextColor="#6b7280"
                      style={styles.modalNameInput}
                    />
                    <Text style={styles.modalSubtitle}>
                      {selectedPerson.count} photos ·{" "}
                      {selectedPerson.isKnown ? "Named" : "Unknown person"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closePerson}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!editingName.trim() || savingName) && { opacity: 0.7 },
                ]}
                disabled={!editingName.trim() || savingName}
                onPress={handleSaveName}
              >
                <Text style={styles.saveButtonText}>
                  {savingName ? "Saving..." : "Save name"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.modalSectionTitle}>Photos with this person</Text>
              <FlatList
                data={selectedPerson.media}
                keyExtractor={(item) => item.id}
                numColumns={3}
                scrollEnabled={true}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={{ paddingTop: 6, paddingBottom: 8 }}
                renderItem={({ item }) => (
                  <View style={styles.gridItem}>
                    <Image source={{ uri: item.uri }} style={styles.gridImage} />
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

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2933",
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
  segment: {
    flexDirection: "row",
    backgroundColor: "#020617",
    borderRadius: 999,
    padding: 2,
    marginTop: 6,
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
  peopleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingTop: 8,
  },
  personCard: {
    width: "30%",
    alignItems: "center",
  },
  personImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  personName: {
    fontSize: 13,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  personCount: {
    fontSize: 12,
    color: "#9ca3af",
  },
  personBadge: {
    position: "absolute",
    bottom: 4,
    right: 0,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  personBadgeText: {
    fontSize: 10,
    color: "#f97316",
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
  modalPersonInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  modalLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 2,
  },
  modalNameInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2933",
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: "#e5e7eb",
    backgroundColor: "#020617",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#9ca3af",
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
    fontSize: 12,
    color: "#e5e7eb",
  },
  saveButton: {
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: "#38bdf8",
    paddingVertical: 10,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    marginTop: 4,
    marginBottom: 4,
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
});
