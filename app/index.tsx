// app/index.tsx
import React, { useContext } from "react";
import { Redirect } from "expo-router";
import { AuthContext } from "./auth-context";

export default function Index() {
  const auth = useContext(AuthContext);

  // While auth mounts, you could show a splash, but here it's instant.
  if (!auth?.isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
