import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getMangaDetail } from "@/src/api/shngmClient";
import type { ShngmManga } from "@/src/api/shngmTypes";
import {
  clearHistory,
  getAllHistory,
  replaceHistory,
  type ReadingProgress,
} from "@/src/store/history";
import { MangaListSkeleton } from "@/components/ui/SkeletonLoaders";

type HistoryRow = {
  mangaId: string;
  title: string;
  coverUrl: string;
  updatedAt: number;
  chapterId: string;
  chapterNumber: number;
  pageIndex: number;
  totalPages: number;
};

async function fetchMangaDetail(mangaId: string): Promise<ShngmManga | null> {
  try {
    const res = await getMangaDetail(mangaId);
    return res.data;
  } catch {
    return null;
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("id-ID");
}

export function HistoryTab() {
  const router = useRouter();
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const insets = useSafeAreaInsets();

  const colors = React.useMemo(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      chip: isDark ? "#1A1A24" : "#EFE6DA",
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
      primary: isDark ? "#F2F2F7" : "#1E2A3A",
      primaryText: isDark ? "#111111" : "#F7F2EA",
      button: isDark ? "#F2F2F7" : "#1E2329",
      buttonText: isDark ? "#0B0B0E" : "#F6F1E9",
    }),
    [isDark]
  );

  const [loading, setLoading] = React.useState<boolean>(true);
  const [rows, setRows] = React.useState<HistoryRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const buildRows = React.useCallback(async (): Promise<HistoryRow[]> => {
    const history = await getAllHistory();
    const out: HistoryRow[] = [];

    for (const h of history) {
      const hasMeta = Boolean(h.mangaTitle || h.coverUrl);
      const manga = hasMeta ? null : await fetchMangaDetail(h.mangaId);
      out.push({
        mangaId: h.mangaId,
        title: h.mangaTitle ?? manga?.title ?? "Unknown",
        coverUrl:
          h.coverUrl ??
          manga?.cover_portrait_url ??
          manga?.cover_image_url ??
          "",
        updatedAt: h.updatedAt,
        chapterId: h.chapterId,
        chapterNumber: h.chapterNumber,
        pageIndex: h.pageIndex,
        totalPages: h.totalPages,
      });
    }

    return out;
  }, []);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await buildRows();
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildRows]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  const onClearAll = React.useCallback(() => {
    const doClear = async () => {
      await clearHistory();
      await load();
    };

    if (Platform.OS === "web") {
      if (window.confirm("Hapus history?\nSemua riwayat bacaan akan dihapus.")) {
        doClear();
      }
    } else {
      Alert.alert(
        "Hapus history?",
        "Semua riwayat bacaan akan dihapus.",
        [
          { text: "Batal", style: "cancel" },
          { text: "Hapus", style: "destructive", onPress: () => { doClear(); } },
        ]
      );
    }
  }, [load]);

  const onRemoveOne = React.useCallback(
    (item: HistoryRow) => {
      const doRemove = async () => {
        const all = await getAllHistory();
        const filtered = all.filter((x) => x.mangaId !== item.mangaId);
        await replaceHistory(filtered);
        await load();
      };

      if (Platform.OS === "web") {
        if (window.confirm(`Hapus item ini?\nHapus history untuk "${item.title}"?`)) {
          doRemove();
        }
      } else {
        Alert.alert(
          "Hapus item ini?",
          `Hapus history untuk "${item.title}"?`,
          [
            { text: "Batal", style: "cancel" },
            { text: "Hapus", style: "destructive", onPress: () => { doRemove(); } },
          ]
        );
      }
    },
    [load]
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: 12,
        }}
      >
        <MangaListSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: 16,
          gap: 12,
        }}
      >
        <Text style={{ color: colors.subtext }}>{error}</Text>

        <Pressable
          onPress={() => void load()}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: colors.ghost,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: colors.ghostText, fontWeight: "900", textAlign: 'center' }}>
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ padding: 12, gap: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.subtext }}>
            Menampilkan komik yang terakhir kamu baca.
          </Text>

          <Pressable
            onPress={onClearAll}
            style={{
              backgroundColor: colors.ghost,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: "900" }}>
              Clear
            </Text>
          </Pressable>
        </View>
      </View>

      {rows.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 60,
            paddingHorizontal: 32,
            gap: 16,
          }}
        >
          <Ionicons
            name="time-outline"
            size={64}
            color={colors.subtext}
            style={{ opacity: 0.4 }}
          />
          <Text
            style={{
              color: colors.text,
              fontWeight: "900",
              fontSize: 18,
              textAlign: "center",
            }}
          >
            Belum ada riwayat baca
          </Text>
          <Text
            style={{
              color: colors.subtext,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Chapter yang sudah kamu baca akan tersimpan otomatis di sini.
          </Text>
          <Pressable
            onPress={() => router.push("/")}
            style={{
              backgroundColor: colors.button,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 20,
              marginTop: 8,
            }}
          >
            <Text style={{ color: colors.buttonText, fontWeight: "900" }}>
              Mulai Baca
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.mangaId}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/manga/[mangaId]",
                      params: {
                        mangaId: item.mangaId,
                        title: item.title,
                        coverUrl: item.coverUrl,
                      },
                    })
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1 })}
                >
                  <ExpoImage
                    source={{ uri: item.coverUrl }}
                    style={{
                      width: 72,
                      height: 96,
                      borderRadius: 14,
                      backgroundColor: colors.chip,
                    }}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={0}
                  />
                </Pressable>

                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/manga/[mangaId]",
                        params: {
                          mangaId: item.mangaId,
                          title: item.title,
                          coverUrl: item.coverUrl,
                        },
                      })
                    }
                    style={({ pressed }) => ({ opacity: pressed ? 0.86 : 1, gap: 8 })}
                  >
                    <Text
                      style={{ color: colors.text, fontWeight: "900" }}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    <Text style={{ color: colors.subtext }}>
                      Terakhir dibaca: {formatTime(item.updatedAt)}
                    </Text>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      <View
                        style={{
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                          Ch {item.chapterNumber}
                        </Text>
                      </View>

                      <View
                        style={{
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                          Hal {item.pageIndex + 1}/{item.totalPages}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: "/reader/[chapterId]",
                            params: {
                              chapterId: item.chapterId,
                              mangaTitle: item.title,
                              coverUrl: item.coverUrl,
                            },
                          })
                        }
                        style={{
                          backgroundColor: colors.primary,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                          Lanjutkan
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => onRemoveOne(item)}
                        style={{
                          backgroundColor: colors.ghost,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: colors.danger, fontWeight: "900" }}>
                          Hapus
                        </Text>
                      </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
