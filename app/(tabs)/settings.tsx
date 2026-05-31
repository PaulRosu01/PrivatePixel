// app/(tabs)/settings.tsx
import { useTheme } from "@react-navigation/native";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { NAS_BASE_URL, useAuth } from "../auth-context";
import { ThemeModeContext } from "../theme-context";
import { Header, ScreenContainer } from "./_components";

type ServerMediaItem = {
  id: string;
  createdAt?: string;
  width?: number;
  height?: number;
};

type DeviceMediaItem = {
  id: string;
  uri: string;
  createdAt: string;
  width?: number;
  height?: number;
  type: "photo" | "video";
};

function buildDedupKey(input: {
  createdAt: string;
  width?: number;
  height?: number;
}) {
  const timePart = String(input.createdAt || "").slice(0, 19);
  const sizePart =
    input.width && input.height ? `${input.width}x${input.height}` : "";
  return `${timePart}|${sizePart}`;
}

export default function SettingsScreen() {
  const [wifiOnly, setWifiOnly] = useState(true);
  const [backupOnOpen, setBackupOnOpen] = useState(true);
  const [retryingTags, setRetryingTags] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [lastBackupSummary, setLastBackupSummary] = useState<string | null>(
    null,
  );

  const auth = useAuth();
  const themeMode = useContext(ThemeModeContext);
  const router = useRouter();
  const { colors } = useTheme();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [modelModalVisible, setModelModalVisible] = useState(false);

  const isDark = themeMode?.mode === "dark";

  const handleLogout = () => {
    auth?.logout?.();
    router.replace("/login");
  };
  const loadAiModelSettings = async () => {
    if (!auth?.token) {
      console.warn("No token yet, skipping AI model load");
      return;
    }

    try {
      setLoadingModels(true);

      const headers = {
        Authorization: `Bearer ${auth.token}`,
      };

      const [modelsRes, settingsRes] = await Promise.all([
        fetch(`${NAS_BASE_URL}/ai/models`, { headers }),
        fetch(`${NAS_BASE_URL}/ai/settings`, { headers }),
      ]);

      if (modelsRes.status === 401 || settingsRes.status === 401) {
        throw new Error("Invalid token");
      }

      const modelsData = await modelsRes.json();
      const settingsData = await settingsRes.json();

      setAvailableModels(modelsData.models || []);
      setSelectedModel(settingsData.selectedTagModel || "");
    } catch (err) {
      console.error("Failed to load AI model settings:", err);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveSelectedModel = async () => {
    if (!auth?.token) {
      Alert.alert("Not logged in", "Please sign in first.");
      return;
    }

    if (!selectedModel) {
      Alert.alert("No model selected", "Choose a model first.");
      return;
    }

    try {
      setSavingModel(true);

      const response = await fetch(`${NAS_BASE_URL}/ai/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          selectedTagModel: selectedModel,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save selected model.");
      }

      setModelModalVisible(false);

      Alert.alert(
        "Model saved",
        `Future AI tagging will use ${selectedModel}.`,
      );
    } catch (error: any) {
      Alert.alert(
        "Save failed",
        error?.message || "Could not save the selected model.",
      );
    } finally {
      setSavingModel(false);
    }
  };
  useEffect(() => {
    if (!auth?.token) return;

    loadAiModelSettings();
  }, [auth?.token]);
  console.log("TOKEN:", auth?.token);
  const saveSelectedModel = async () => {
    try {
      setSavingModel(true);

      const res = await fetch(`${NAS_BASE_URL}/ai/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify({
          selectedTagModel: selectedModel,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save model");
      }

      Alert.alert("Saved", "AI model updated successfully");
    } catch (err) {
      Alert.alert("Error", "Could not save model");
    } finally {
      setSavingModel(false);
    }
  };
  const checkServer = async () => {
    if (!auth?.token) {
      setServerOnline(null);
      return;
    }

    try {
      setCheckingServer(true);

      const res = await fetch(`${NAS_BASE_URL}/media`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      setServerOnline(res.ok);
    } catch (err) {
      console.warn("Server check failed:", err);
      setServerOnline(false);
    } finally {
      setCheckingServer(false);
    }
  };

  useEffect(() => {
    checkServer();
  }, [auth?.token]);

  const scanDeviceMedia = async (): Promise<DeviceMediaItem[]> => {
    if (Platform.OS === "web") {
      return [];
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "We need access to your photos.");
      return [];
    }

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      first: 1000,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    const items: DeviceMediaItem[] = await Promise.all(
      assets.assets.map(async (a): Promise<DeviceMediaItem> => {
        const info = await MediaLibrary.getAssetInfoAsync(a);

        return {
          id: `device-${a.id}`,
          uri: info.localUri ?? a.uri,
          createdAt: new Date(a.creationTime ?? Date.now()).toISOString(),
          type:
            a.mediaType === MediaLibrary.MediaType.video ? "video" : "photo",
          width: info.width ?? (a as any).width,
          height: info.height ?? (a as any).height,
        };
      }),
    );

    return items;
  };

  const fetchServerMedia = async (): Promise<ServerMediaItem[]> => {
    if (!auth?.token) return [];

    const res = await fetch(`${NAS_BASE_URL}/media`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  const uploadOneToNas = async (item: DeviceMediaItem): Promise<boolean> => {
    try {
      if (!auth?.token) {
        Alert.alert("Not logged in", "Please sign in before uploading.");
        return false;
      }

      if (!item.uri) {
        console.warn("Missing local uri for item", item.id);
        return false;
      }

      const formData = new FormData();

      const file: any = {
        uri: item.uri,
        name:
          (item.type === "video" ? "video-" : "photo-") +
          item.id +
          (item.type === "video" ? ".mp4" : ".jpg"),
        type: item.type === "video" ? "video/mp4" : "image/jpeg",
      };

      formData.append("takenAt", item.createdAt);

      if (item.width != null) {
        formData.append("width", String(item.width));
      }
      if (item.height != null) {
        formData.append("height", String(item.height));
      }

      formData.append("file", file);

      const res = await fetch(`${NAS_BASE_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        console.warn("Upload failed:", await res.text());
        return false;
      }

      return true;
    } catch (err) {
      console.error("Upload error:", err);
      return false;
    }
  };

  const handleBackupNow = async () => {
    if (!auth?.token) {
      Alert.alert("Not logged in", "Please sign in before starting backup.");
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert(
        "Not available on web",
        "Backup now from Settings currently works on iOS/Android. On web, use the Library upload flow.",
      );
      return;
    }

    try {
      setRunningBackup(true);

      const [deviceItems, serverItems] = await Promise.all([
        scanDeviceMedia(),
        fetchServerMedia(),
      ]);

      const serverKeySet = new Set(
        serverItems.map((item) =>
          buildDedupKey({
            createdAt: item.createdAt || "",
            width: item.width,
            height: item.height,
          }),
        ),
      );

      const missingDeviceItems = deviceItems.filter((item) => {
        const key = buildDedupKey(item);
        return !serverKeySet.has(key);
      });

      if (!missingDeviceItems.length) {
        setLastBackupSummary("Everything from Device is already on Server.");
        Alert.alert(
          "Already backed up",
          "Everything from Device is already on Server.",
        );
        return;
      }

      let successCount = 0;

      for (const item of missingDeviceItems) {
        const ok = await uploadOneToNas(item);
        if (ok) successCount++;
      }

      const photoCount = missingDeviceItems.filter(
        (item) => item.type === "photo",
      ).length;
      const videoCount = missingDeviceItems.filter(
        (item) => item.type === "video",
      ).length;

      setLastBackupSummary(
        `Uploaded ${successCount} of ${missingDeviceItems.length} missing items (${photoCount} photos, ${videoCount} videos).`,
      );

      await checkServer();

      Alert.alert(
        "Backup finished",
        `Uploaded ${successCount} of ${missingDeviceItems.length} missing item(s).`,
      );
    } catch (error: any) {
      console.error("Backup failed:", error);
      Alert.alert(
        "Backup failed",
        error?.message || "Something went wrong while backing up.",
      );
    } finally {
      setRunningBackup(false);
    }
  };

  const handleRetryAiTagging = async () => {
    try {
      setRetryingTags(true);

      const response = await fetch(`${NAS_BASE_URL}/media/retry-tagging`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify({
          retryErrors: true,
          retryUntagged: true,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to retry AI tagging.");
      }

      Alert.alert(
        "AI tagging started",
        data?.message || "Retry started for failed and untagged items.",
      );
    } catch (error: any) {
      Alert.alert(
        "Retry failed",
        error?.message || "Something went wrong while retrying AI tagging.",
      );
    } finally {
      setRetryingTags(false);
    }
  };

  const serverStatusText = useMemo(() => {
    if (checkingServer) return "Checking";
    if (serverOnline === null) return "Unknown";
    return serverOnline ? "Connected" : "Offline";
  }, [checkingServer, serverOnline]);

  const serverStatusColor = useMemo(() => {
    if (checkingServer || serverOnline === null) return "#9ca3af";
    return serverOnline ? "#16a34a" : "#ef4444";
  }, [checkingServer, serverOnline]);

  return (
    <>
      <ScreenContainer>
        <Header
          title="Settings"
          subtitle="Account, server & backup preferences"
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Appearance
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.settingsLabel}>Dark mode</Text>
              <Text style={styles.settingsHint}>
                Switch between light and dark theme.
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(value) =>
                themeMode?.setMode(value ? "dark" : "light")
              }
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Server</Text>

          <Text style={styles.settingsLabel}>Server URL</Text>
          <Text style={styles.settingsValue}>{NAS_BASE_URL}</Text>

          <View
            style={[
              styles.pillStatus,
              {
                backgroundColor: serverOnline
                  ? "rgba(22,163,74,0.15)"
                  : "rgba(239,68,68,0.15)",
              },
            ]}
          >
            <Text style={[styles.pillDot, { color: serverStatusColor }]}>
              ●
            </Text>
            <Text style={[styles.pillText, { color: serverStatusColor }]}>
              {serverStatusText}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={checkServer}
            disabled={checkingServer}
          >
            <Text style={styles.secondaryButtonText}>
              {checkingServer ? "Checking..." : "Check server again"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Backup</Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.settingsLabel}>Backup on app open</Text>
              <Text style={styles.settingsHint}>
                Scan for new media each time you open the app.
              </Text>
            </View>
            <Switch value={backupOnOpen} onValueChange={setBackupOnOpen} />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.settingsLabel}>Wi-Fi only</Text>
              <Text style={styles.settingsHint}>
                Avoid using mobile data for uploads.
              </Text>
            </View>
            <Switch value={wifiOnly} onValueChange={setWifiOnly} />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              runningBackup && styles.buttonDisabled,
            ]}
            onPress={handleBackupNow}
            disabled={runningBackup}
          >
            {runningBackup ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator size="small" color="#0f172a" />
                <Text style={styles.primaryButtonText}>Backing up...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Backup now</Text>
            )}
          </TouchableOpacity>

          {lastBackupSummary ? (
            <Text style={styles.summaryText}>{lastBackupSummary}</Text>
          ) : null}

          <View style={styles.sectionDivider} />

          <Text style={styles.settingsLabel}>AI tagging</Text>
          <Text style={styles.settingsHint}>
            Choose which AI model is used for tagging new uploads and retry
            tagging.
          </Text>

          <TouchableOpacity
            style={styles.modelSelectorButton}
            onPress={() => setModelModalVisible(true)}
            disabled={loadingModels || availableModels.length === 0}
          >
            <Text style={styles.modelSelectorButtonText}>
              {loadingModels
                ? "Loading models..."
                : selectedModel || "No model available"}
            </Text>
            <Text style={styles.modelSelectorChevron}>▾</Text>
          </TouchableOpacity>

          <Text style={styles.settingsHint}>
            {availableModels.length > 0
              ? `${availableModels.length} model(s) available`
              : loadingModels
                ? "Checking available models..."
                : "No supported vision models found"}
          </Text>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              savingModel && styles.buttonDisabled,
            ]}
            onPress={handleSaveSelectedModel}
            disabled={savingModel || !selectedModel}
          >
            {savingModel ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator size="small" color="#f97316" />
                <Text style={styles.secondaryButtonText}>Saving model...</Text>
              </View>
            ) : (
              <Text style={styles.secondaryButtonText}>Save model</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.settingsHint}>
            Retry failed tags and queue media that was not tagged yet.
          </Text>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              retryingTags && styles.buttonDisabled,
            ]}
            onPress={handleRetryAiTagging}
            disabled={retryingTags}
          >
            {retryingTags ? (
              <View style={styles.buttonContentRow}>
                <ActivityIndicator size="small" color="#f97316" />
                <Text style={styles.secondaryButtonText}>
                  Retrying AI tagging...
                </Text>
              </View>
            ) : (
              <Text style={styles.secondaryButtonText}>
                Retry failed / untagged AI tagging
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Account
          </Text>

          <Text style={styles.settingsLabel}>Logged in as</Text>
          <Text style={styles.settingsValue}>
            {auth?.user?.email || "Signed in"}
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLogout}
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>

      <Modal
        visible={modelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelModalVisible(false)}
      >
        <View style={styles.photoMenuBackdrop}>
          <Pressable
            style={styles.photoMenuBackdropPressArea}
            onPress={() => setModelModalVisible(false)}
          />

          <View style={styles.photoMenuSheet}>
            <Text style={styles.photoMenuTitle}>Choose AI model</Text>
            <Text style={styles.settingsHint}>
              This affects future uploads and retry tagging.
            </Text>

            <ScrollView
              style={{ maxHeight: 320, marginTop: 10 }}
              showsVerticalScrollIndicator={false}
            >
              {availableModels.map((model) => {
                const isSelected = model === selectedModel;

                return (
                  <TouchableOpacity
                    key={model}
                    style={styles.modelOptionRow}
                    onPress={() => setSelectedModel(model)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modelOptionText,
                        isSelected && styles.modelOptionTextSelected,
                      ]}
                    >
                      {model}
                    </Text>

                    <View
                      style={[
                        styles.modelRadioOuter,
                        isSelected && styles.modelRadioOuterSelected,
                      ]}
                    >
                      {isSelected ? (
                        <View style={styles.modelRadioInner} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.photoMenuAction,
                savingModel && styles.buttonDisabled,
              ]}
              onPress={handleSaveSelectedModel}
              disabled={savingModel || !selectedModel}
            >
              <Text style={styles.photoMenuActionText}>
                {savingModel ? "Saving..." : "Save selected model"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.photoMenuAction, styles.photoMenuCancelAction]}
              onPress={() => setModelModalVisible(false)}
            >
              <Text style={styles.photoMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  settingsLabel: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  settingsValue: {
    fontSize: 13,
    color: "#e5e7eb",
    marginTop: 4,
  },
  settingsHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#1f2933",
    marginTop: 14,
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: "#38bdf8",
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#0f172a",
    fontWeight: "600",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#f97316",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillStatus: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
  },
  pillDot: {
    fontSize: 11,
    marginRight: 4,
  },
  pillText: {
    fontSize: 11,
  },
  summaryText: {
    marginTop: 10,
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 18,
  },
  modelSelectorButton: {
    marginTop: 10,
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2933",
    backgroundColor: "#020617",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelSelectorButtonText: {
    color: "#e5e7eb",
    fontSize: 16,
    flex: 1,
  },
  modelSelectorChevron: {
    color: "#9ca3af",
    fontSize: 16,
    marginLeft: 12,
  },
  photoMenuBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  photoMenuBackdropPressArea: {
    flex: 1,
  },
  photoMenuSheet: {
    backgroundColor: "#020617",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "#1f2933",
  },
  photoMenuTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 10,
  },
  photoMenuAction: {
    paddingVertical: 18,
    borderTopWidth: 1,
    borderColor: "#1f2933",
  },
  photoMenuActionText: {
    fontSize: 16,
    color: "#e5e7eb",
  },
  photoMenuCancelAction: {
    marginTop: 8,
  },
  photoMenuCancelText: {
    fontSize: 16,
    color: "#f97373",
    fontWeight: "600",
  },
  modelOptionRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2933",
    backgroundColor: "#020617",
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modelOptionText: {
    color: "#e5e7eb",
    fontSize: 15,
    flex: 1,
  },
  modelOptionTextSelected: {
    color: "#38bdf8",
    fontWeight: "600",
  },
  modelRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  modelRadioOuterSelected: {
    borderColor: "#38bdf8",
  },
  modelRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38bdf8",
  },
});
