// app/(tabs)/people.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { ScreenContainer, Header } from "./_components";

type Person = {
  id: string;
  name: string;
  count: number;
  uri: string;
};

const mockPeople: Person[] = [
  { id: "p1", name: "You", count: 128, uri: "https://picsum.photos/200?random=201" },
  { id: "p2", name: "Unknown 1", count: 57, uri: "https://picsum.photos/200?random=202" },
  { id: "p3", name: "Unknown 2", count: 34, uri: "https://picsum.photos/200?random=203" },
  { id: "p4", name: "Unknown 3", count: 19, uri: "https://picsum.photos/200?random=204" },
];

export default function PeopleScreen() {
  return (
    <ScreenContainer>
      <Header
        title="People"
        subtitle="Automatically grouped by faces"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Clusters</Text>
        <Text style={styles.cardSubtitle}>
          These are mock clusters your AI worker would detect on the server.
        </Text>
      </View>

      <View style={styles.peopleGrid}>
        {mockPeople.map((p) => (
          <View key={p.id} style={styles.personCard}>
            <Image source={{ uri: p.uri }} style={styles.personImage} />
            <Text style={styles.personName}>{p.name}</Text>
            <Text style={styles.personCount}>{p.count} photos</Text>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  cardSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginBottom: 8,
  },
  peopleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
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
    backgroundColor: "#020617",
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
});
