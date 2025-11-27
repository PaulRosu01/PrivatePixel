// app/(tabs)/_components.tsx
import { useTheme } from "@react-navigation/native";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const ScreenContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { colors, dark } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <ScrollView
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

export const Header: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.headerSubtitle, { color: "#9ca3af" }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
});
