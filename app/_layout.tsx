// app/_layout.tsx
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import React from "react";
import "react-native-url-polyfill/auto"; // if you moved it here
import { AuthProvider } from "./auth-context";
import { ThemeModeContext, ThemeModeProvider } from "./theme-context";

// Dark + light theme definitions
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

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f9fafb",
    border: "#d1d5db",
    card: "#ffffff",
    primary: "#0ea5e9",
    text: "#020617",
    notification: "#0ea5e9",
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <ThemeModeContext.Consumer>
          {(themeMode) => {
            const navTheme =
              themeMode?.mode === "light" ? customLightTheme : customDarkTheme;

            return (
              <NavThemeProvider value={navTheme}>
                <Stack screenOptions={{ headerShown: false }}>
                  {/* index decides login vs tabs */}
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </NavThemeProvider>
            );
          }}
        </ThemeModeContext.Consumer>
      </ThemeModeProvider>
    </AuthProvider>
  );
}
