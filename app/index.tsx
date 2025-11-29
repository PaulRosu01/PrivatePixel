// app/index.tsx
import React from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "./auth-context";

export default function Index() {
  const { isLoggedIn, initializing } = useAuth();

  // While we load auth state from AsyncStorage
  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020617",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
        <Text style={{ color: "#e5e7eb", marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
