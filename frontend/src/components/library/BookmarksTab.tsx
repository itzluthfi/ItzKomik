import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, View, useWindowDimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { clearBookmarks, getBookmarks, removeBookmark, type BookmarkItem } from "@/src/store/bookmarks";
import { checkUpdatesForBookmarks, getPendingUpdates, removePendingUpdate, type UpdateEntry } from "@/src/store/updates";
import { MangaListSkeleton } from "@/components/ui/SkeletonLoaders";

export function BookmarksTab() {
  const router = useRouter();
  const { resolved } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDark = resolved === "dark";
  const columns = width >= 720 ? 2 : 1;
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
      button: isDark ? "#F2F2F7" : "#1E2329",
      buttonText: isDark ? "#0B0B0E" : "#F6F1E9",
    }),
    [isDark]
  );

  const [items, setItems] = React.useState<BookmarkItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [updates, setUpdates] = React.useState<UpdateEntry[]>([]);
  const [updatesLoading, setUpdatesLoading] = React.useState<boolean>(true);
  const [checkingUpdates, setCheckingUpdates] = React.useState<boolean>(false);
  const [updatesMsg, setUpdatesMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    const res = await getBookmarks();
    setItems(res);
    const pending = await getPendingUpdates();
    setUpdates(pending);
    setUpdatesLoading(false);
    if (opts?.silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  const handleCheckUpdates = React.useCallback(async () => {
    if (items.length === 0) return;
    try {
      setCheckingUpdates(true);
      setUpdatesMsg(null);
      const res = await checkUpdatesForBookmarks(items);
      const pending = await getPendingUpdates();
      setUpdates(pending);
      if (res.updates.length === 0) {
        setUpdatesMsg("Tidak ada update baru.");
      } else {
        setUpdatesMsg(`Ada ${res.updates.length} update baru.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal cek update";
      setUpdatesMsg(msg);
    } finally {
      setCheckingUpdates(false);
    }
  }, [items]);

  const handleRemove = React.useCallback(
    (item: BookmarkItem) => {
      const doDelete = async () => {
        await removeBookmark(item.mangaId);
        setItems((prev) => prev.filter((x) => x.mangaId !== item.mangaId));
      };

      if (Platform.OS === "web") {
        if (window.confirm(`Hapus bookmark?\n${item.title}`)) {
          doDelete();
        }
      } else {
        Alert.alert("Hapus bookmark?", item.title, [
          { text: "Batal", style: "cancel" },
          { text: "Hapus", style: "destructive", onPress: () => { doDelete(); } },
        ]);
      }
    },
    [setItems]
  );

  const handleClearAll = React.useCallback(() => {
    const doClear = async () => {
      await clearBookmarks();
      setItems([]);
    };

    if (Platform.OS === "web") {
      if (window.confirm("Hapus semua bookmark?\nTindakan ini tidak bisa dibatalkan.")) {
        doClear();
      }
    } else {
      Alert.alert("Hapus semua bookmark?", "Tindakan ini tidak bisa dibatalkan.", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus semua", style: "destructive", onPress: () => { doClear(); } },
      ]);
    }
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 12 }}>
        <MangaListSkeleton />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 60,
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <Ionicons
          name="bookmark-outline"
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
          Belum ada bookmark
        </Text>
        <Text
          style={{
            color: colors.subtext,
            fontSize: 14,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          Tandai manga favoritmu dan mereka akan muncul di sini.
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
            Jelajahi Manga
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.mangaId}
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        contentContainerStyle={{ padding: 12, paddingBottom: 24, gap: 12 }}
        refreshing={refreshing}
        onRefresh={() => load({ silent: true })}
        ListHeaderComponent={
          <View style={{ gap: 6, paddingBottom: 8 }}>
            <Text style={{ color: colors.subtext }}>{items.length} judul tersimpan</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                hitSlop={8}
                onPress={handleClearAll}
                style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ghost }}
              >
                <Text style={{ color: colors.danger, fontWeight: "900" }}>Hapus semua</Text>
              </Pressable>
            </View>

            <View style={{ gap: 10, marginTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>Update chapter</Text>
                <Pressable
                  hitSlop={8}
                  onPress={handleCheckUpdates}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ghost }}
                >
                  <Text style={{ color: colors.ghostText, fontWeight: "900" }}>
                    {checkingUpdates ? "Cek..." : "Cek update"}
                  </Text>
                </Pressable>
              </View>

              {updatesMsg ? <Text style={{ color: colors.subtext }}>{updatesMsg}</Text> : null}

              {updatesLoading ? (
                <View style={{ paddingVertical: 8 }}>
                  <ActivityIndicator color={colors.subtext} />
                </View>
              ) : updates.length === 0 ? (
                <View
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.subtext }}>
                    Belum ada update. Tekan "Cek update" untuk memeriksa.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {updates.map((u) => (
                    <View
                      key={`update-${u.mangaId}`}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 12,
                        flexDirection: "row",
                        gap: 12,
                      }}
                    >
                      <ExpoImage
                        source={{ uri: u.coverUrl }}
                        style={{ width: 64, height: 86, borderRadius: 12, backgroundColor: colors.chip }}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={0}
                      />

                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                          {u.title}
                        </Text>
                        <Text style={{ color: colors.subtext }}>
                          Chapter terbaru: {u.chapterNumber}
                        </Text>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={async () => {
                              await removePendingUpdate(u.mangaId);
                              setUpdates((prev) => prev.filter((x) => x.mangaId !== u.mangaId));
                              router.push({
                                pathname: "/reader/[chapterId]",
                                params: {
                                  chapterId: u.chapterId,
                                  mangaTitle: u.title,
                                  coverUrl: u.coverUrl,
                                },
                              });
                            }}
                            style={{
                              backgroundColor: colors.ghost,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: colors.ghostText, fontWeight: "900" }}>Baca</Text>
                          </Pressable>

                          <Pressable
                            onPress={async () => {
                              await removePendingUpdate(u.mangaId);
                              setUpdates((prev) => prev.filter((x) => x.mangaId !== u.mangaId));
                            }}
                            style={{
                              backgroundColor: colors.ghost,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                            }}
                          >
                            <Text style={{ color: colors.subtext, fontWeight: "900" }}>Tandai dibaca</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                gap: 12,
                minHeight: 118,
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
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <ExpoImage
                  source={{ uri: item.coverUrl }}
                  style={{ width: 72, height: 96, borderRadius: 14, backgroundColor: colors.chip }}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={0}
                />
              </Pressable>

              <View style={{ flex: 1, gap: 6, justifyContent: "space-between" }}>
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
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, gap: 6 })}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.subtext }}>
                    Disimpan: {new Date(item.updatedAt).toLocaleDateString("id-ID")}
                  </Text>
                </Pressable>

                  <Pressable
                    hitSlop={8}
                    onPress={() => handleRemove(item)}
                    style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ghost }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: "900" }}>Hapus</Text>
                  </Pressable>
                </View>
              </View>
            </View>
        )}
      />
    </View>
  );
}
