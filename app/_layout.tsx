// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { AuthProvider } from "./auth-context";

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#020617",
    border: "#1f2933",
    card: "#020617",
    primary: "#38bdf8",
    text: "#e5e7eb",
    notification: "#38bdf8",
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={customDarkTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Index decides whether to show login or tabs */}
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
