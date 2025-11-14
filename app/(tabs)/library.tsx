// app/(tabs)/library.tsx
import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import { ScreenContainer, Header } from "./_components";

type Asset = {
  id: string;
  uri: string;
  group: "Today" | "This week" | "Earlier";
};

const mockAssets: Asset[] = Array.from({ length: 27 }).map((_, idx) => ({
  id: String(idx),
  uri: `https://picsum.photos/200?random=${10 + idx}`,
  group: idx < 6 ? "Today" : idx < 15 ? "This week" : "Earlier",
}));

export default function LibraryScreen() {
  const groups = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const asset of mockAssets) {
      const key = asset.group;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(asset);
    }
    return Array.from(map.entries()).map(([group, items]) => ({
      group,
      items,
    }));
  }, []);

  return (
    <ScreenContainer>
      <Header title="Library" subtitle="Timeline of backed up media" />

      <View style={[s.card, { marginBottom: 8 }]}>
        <Text style={s.cardTitle}>Filter</Text>
        <View style={s.segment}>
          <Text style={[s.segmentItem, s.segmentItemActive]}>All</Text>
          <Text style={s.segmentItem}>Photos</Text>
          <Text style={s.segmentItem}>Videos</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <View key={group.group} style={s.dateGroup}>
            <Text style={s.dateGroupTitle}>{group.group}</Text>
            <FlatList
              data={group.items}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={s.gridRow}
              renderItem={({ item }) => (
                <View style={s.gridItem}>
                  <Image source={{ uri: item.uri }} style={s.gridImage} />
                </View>
              )}
            />
          </View>
        ))}
      </ScrollView>
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
  segment: {
    flexDirection: "row",
    backgroundColor: "#020617",
    borderRadius: 999,
    padding: 2,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1f2933",
  },
  segmentItem: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    paddingVertical: 4,
    borderRadius: 999,
    color: "#9ca3af",
  },
  segmentItemActive: {
    backgroundColor: "#111827",
    color: "#e5e7eb",
    fontWeight: "600",
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
});
