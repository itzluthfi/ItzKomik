import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Poppins } from "@/constants/theme";
import type { FeedType, MangaFormat } from "@/src/api/shngmClient";
import {
  getMangaDetail,
  getMangaListByType,
  getRecommendedByFormat,
  invalidateListCache,
} from "@/src/api/shngmClient";
import type { ShngmManga } from "@/src/api/shngmTypes";
import { getAllHistory, type ReadingProgress } from "@/src/store/history";

import { MangaGridSkeleton, MangaListSkeleton } from "@/components/ui/SkeletonLoaders";
import HeroCarousel from "@/components/home/HeroCarousel";
import RecommendedSection from "@/components/home/RecommendedSection";
import { useAppTheme } from "@/src/theme/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";

type FeedState = {
  items: ShngmManga[];
  page: number;
  totalPage: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  loaded: boolean;
};

type RecommendedState = {
  manhwa: ShngmManga[];
  manga: ShngmManga[];
  manhua: ShngmManga[];
  loading: boolean;
  error: string | null;
};

const PAGE_SIZE = 24;

function mergeUnique(prev: ShngmManga[], next: ShngmManga[]): ShngmManga[] {
  const map = new Map<string, ShngmManga>();
  for (const it of prev) map.set(it.manga_id, it);
  for (const it of next) map.set(it.manga_id, it);
  return Array.from(map.values());
}

function isOfflineError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("offline")
    );
  }
  return false;
}

function getFlagEmoji(countryId: string) {
  const map: Record<string, string> = {
    kr: "🇰🇷", jp: "🇯🇵", cn: "🇨🇳", id: "🇮🇩", gb: "🇬🇧", us: "🇺🇸",
  };
  return map[(countryId || "").toLowerCase()] || countryId?.toUpperCase() || "";
}

function parseRelativeTime(dateStr: string) {
  if (!dateStr) return "";
  if (dateStr.includes("hour")) return dateStr.split(" ")[0] + " jam lalu";
  if (dateStr.includes("day")) return dateStr.split(" ")[0] + " hari lalu";
  if (dateStr.includes("min")) return dateStr.split(" ")[0] + " mnt lalu";
  if (dateStr.includes("sec")) return "Baru saja";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const diffMs = new Date().getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return `${Math.floor(diffDays / 30)} bln lalu`;
}

function getStatusLabel(status: number) {
  if (status === 1) return "Ongoing";
  if (status === 2) return "Completed";
  return "";
}

function getFormatLabel(manga: ShngmManga) {
  return manga.taxonomy?.Format?.[0]?.name || "";
}

export default function HomeScreen() {
  const router = useRouter();
  const { resolved, setMode } = useAppTheme();
  const isDark = resolved === "dark";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const toMangaParams = React.useCallback(
    (item: ShngmManga) => ({
      mangaId: item.manga_id,
      title: item.title,
      description: item.description,
      coverUrl: item.cover_portrait_url || item.cover_image_url || "",
      countryId: item.country_id,
      userRate: String(item.user_rate ?? ""),
    }),
    [],
  );

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
      activePillBg: isDark ? "#F2F2F7" : "#1E2A3A",
      activePillText: isDark ? "#111111" : "#F7F2EA",
      inputBg: isDark ? "#121218" : "#FBF5EC",
      inputText: isDark ? "#F2F2F7" : "#1E2329",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      shimmerBase: isDark ? "#1A1A24" : "#EFE6DA",
      shimmerHighlight: isDark ? "#2A2A36" : "#F7F1E8",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
    }),
    [isDark],
  );

  const [active, setActive] = React.useState<FeedType>("project");
  const [recFilter, setRecFilter] = React.useState<MangaFormat>("manhwa");
  const [queryInput, setQueryInput] = React.useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>("");
  const [isGrid, setIsGrid] = React.useState(true);

  const [feeds, setFeeds] = React.useState<Record<FeedType, FeedState>>({
    project: {
      items: [],
      page: 1,
      totalPage: 1,
      loading: true,
      loadingMore: false,
      refreshing: false,
      error: null,
      loaded: false,
    },
    mirror: {
      items: [],
      page: 1,
      totalPage: 1,
      loading: false, // penting: jangan true
      loadingMore: false,
      refreshing: false,
      error: null,
      loaded: false,
    },
  });

  const [rec, setRec] = React.useState<RecommendedState>({
    manhwa: [],
    manga: [],
    manhua: [],
    loading: true,
    error: null,
  });
  const [recent, setRecent] = React.useState<ReadingProgress[]>([]);
  const [recentLoading, setRecentLoading] = React.useState<boolean>(true);

  const [searchState, setSearchState] = React.useState<{
    items: ShngmManga[];
    loading: boolean;
    error: string | null;
  }>({ items: [], loading: false, error: null });
  const [searchNonce, setSearchNonce] = React.useState(0);

  const [offline, setOffline] = React.useState(false);
  const shimmer = React.useRef(new Animated.Value(0)).current;
  const offlinePulse = React.useRef(new Animated.Value(0)).current;
  const SHIMMER_WIDTH = 140;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  React.useEffect(() => {
    if (!offline) {
      offlinePulse.stopAnimation();
      offlinePulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(offlinePulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(offlinePulse, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [offline, offlinePulse]);

  const shimmerOverlayStyle = (width: number, radius: number) => ({
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: SHIMMER_WIDTH,
    borderRadius: radius,
    backgroundColor: colors.shimmerHighlight,
    opacity: 0.85,
    transform: [
      {
        translateX: shimmer.interpolate({
          inputRange: [0, 1],
          outputRange: [-SHIMMER_WIDTH, width + SHIMMER_WIDTH],
        }),
      },
    ],
  });

  const USE_SERVER_SEARCH = process.env.EXPO_PUBLIC_SERVER_SEARCH === "1";
  const SERVER_SEARCH_MIN = 2;

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  const loadRecent = React.useCallback(async () => {
    try {
      setRecentLoading(true);
      const items = await getAllHistory(6);
      
      const populated = await Promise.all(
        items.map(async (h) => {
          if (h.mangaTitle && h.coverUrl) return h;
          try {
            const res = await getMangaDetail(h.mangaId);
            const manga = res.data;
            return {
              ...h,
              mangaTitle: h.mangaTitle ?? manga.title,
              coverUrl: h.coverUrl ?? manga.cover_portrait_url ?? manga.cover_image_url ?? "",
            };
          } catch {
            return h;
          }
        })
      );
      
      setRecent(populated);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  const loadRecommended = React.useCallback(
    async (cacheMode?: "default" | "force" | "no-cache") => {
      try {
        setRec((s) => ({ ...s, loading: true, error: null }));

        const [manhwa, manga, manhua] = await Promise.all([
          getRecommendedByFormat("manhwa", { cacheMode }),
          getRecommendedByFormat("manga", { cacheMode }),
          getRecommendedByFormat("manhua", { cacheMode }),
        ]);

        setRec({
          manhwa: manhwa.data,
          manga: manga.data,
          manhua: manhua.data,
          loading: false,
          error: null,
        });
        setOffline(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (isOfflineError(e)) setOffline(true);
        setRec((s) => ({ ...s, loading: false, error: msg }));
      }
    },
    [],
  );

  const loadFirst = React.useCallback(async (type: FeedType) => {
    try {
      setFeeds((f) => ({
        ...f,
        [type]: {
          ...f[type],
          loading: true,
          error: null,
          loadingMore: false,
          refreshing: false,
        },
      }));

      const res = await getMangaListByType({
        type,
        page: 1,
        pageSize: PAGE_SIZE,
        isUpdate: true,
        sort: "latest",
        sortOrder: "desc",
      });

      setFeeds((f) => ({
        ...f,
        [type]: {
          ...f[type],
          items: res.data,
          page: res.meta.page,
          totalPage: res.meta.total_page,
          loading: false,
          loadingMore: false,
          refreshing: false,
          error: null,
          loaded: true,
        },
      }));
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setFeeds((f) => ({
        ...f,
        [type]: {
          ...f[type],
          loading: false,
          loadingMore: false,
          refreshing: false,
          error: msg,
          loaded: true,
        },
      }));
    }
  }, []);

  const refreshActive = React.useCallback(async () => {
    try {
      setFeeds((f) => ({
        ...f,
        [active]: { ...f[active], refreshing: true, error: null },
      }));

      await invalidateListCache();

      const res = await getMangaListByType(
        {
          type: active,
          page: 1,
          pageSize: PAGE_SIZE,
          isUpdate: true,
          sort: "latest",
          sortOrder: "desc",
        },
        { cacheMode: "force" },
      );

      setFeeds((f) => ({
        ...f,
        [active]: {
          ...f[active],
          items: res.data,
          page: res.meta.page,
          totalPage: res.meta.total_page,
          refreshing: false,
          loading: false,
          error: null,
          loaded: true,
        },
      }));
      setOffline(false);

      // recommended juga ikut update saat refresh
      await loadRecommended("force");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setFeeds((f) => ({
        ...f,
        [active]: { ...f[active], refreshing: false, error: msg },
      }));
    }
  }, [active, loadRecommended]);

  const loadMore = React.useCallback(async () => {
    if (debouncedQuery.trim().length > 0) return; // saat search jangan pagination

    let nextPage = 0;

    setFeeds((f) => {
      const cur = f[active];
      if (cur.loadingMore) return f;
      if (cur.page >= cur.totalPage) return f;
      nextPage = cur.page + 1;
      return { ...f, [active]: { ...cur, loadingMore: true } };
    });

    if (nextPage === 0) return;

    try {
      const res = await getMangaListByType({
        type: active,
        page: nextPage,
        pageSize: PAGE_SIZE,
        isUpdate: true,
        sort: "latest",
        sortOrder: "desc",
      });

      setFeeds((f) => {
        const cur = f[active];
        const merged = mergeUnique(cur.items, res.data);
        return {
          ...f,
          [active]: {
            ...cur,
            items: merged,
            page: res.meta.page,
            totalPage: res.meta.total_page,
            loadingMore: false,
          },
        };
      });
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setFeeds((f) => {
        const cur = f[active];
        return { ...f, [active]: { ...cur, loadingMore: false, error: msg } };
      });
    }
  }, [active, debouncedQuery]);

  // initial load
  React.useEffect(() => {
    void loadFirst("project");
    void loadRecommended();
  }, [loadFirst, loadRecommended]);

  useFocusEffect(
    React.useCallback(() => {
      void loadRecent();
    }, [loadRecent]),
  );

  // tab switch load
  React.useEffect(() => {
    const cur = feeds[active];
    if (!cur.loaded) {
      void loadFirst(active);
    }
  }, [active, feeds, loadFirst]);

  const activeFeed = feeds[active];

  const clientFiltered = React.useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return activeFeed.items;

    return activeFeed.items.filter((m) => {
      const t = (m.title ?? "").toLowerCase();
      const alt = (m.alternative_title ?? "").toLowerCase();
      return t.includes(q) || alt.includes(q);
    });
  }, [activeFeed.items, debouncedQuery]);

  const useServerSearch =
    USE_SERVER_SEARCH && debouncedQuery.trim().length >= SERVER_SEARCH_MIN;
  const filtered =
    useServerSearch && !searchState.error ? searchState.items : clientFiltered;
  const isSearching = debouncedQuery.trim().length > 0;
  const hero = filtered.slice(0, 3);

  const numColumns = isGrid ? (isDesktop ? (width >= 1024 ? 6 : 4) : 2) : 1;

  const groupedData = React.useMemo(() => {
    if (numColumns === 1) {
      return filtered.map((item) => ({ id: item.manga_id, items: [item] }));
    }
    const result = [];
    for (let i = 0; i < filtered.length; i += numColumns) {
      result.push({
        id: `row-${i}`,
        items: filtered.slice(i, i + numColumns),
      });
    }
    return result;
  }, [filtered, numColumns]);

  const [banner, setBanner] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (offline && activeFeed.items.length > 0) {
      setBanner("Offline. Menampilkan data tersimpan.");
    } else if (activeFeed.error && activeFeed.items.length > 0) {
      setBanner(activeFeed.error);
    } else if (useServerSearch && searchState.error) {
      setBanner(searchState.error);
    } else if (!activeFeed.error) {
      setBanner(null);
    }
  }, [
    offline,
    activeFeed.error,
    activeFeed.items.length,
    searchState.error,
    useServerSearch,
    active,
  ]);

  React.useEffect(() => {
    if (!useServerSearch) {
      setSearchState({ items: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setSearchState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const res = await getMangaListByType(
          {
            type: active,
            page: 1,
            pageSize: PAGE_SIZE,
            isUpdate: true,
            sort: "latest",
            sortOrder: "desc",
            query: debouncedQuery.trim(),
          },
          { cacheMode: "no-cache" },
        );

        if (cancelled) return;
        setSearchState({ items: res.data, loading: false, error: null });
        setOffline(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (isOfflineError(e)) setOffline(true);
        setSearchState((s) => ({ ...s, loading: false, error: msg }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useServerSearch, debouncedQuery, active, searchNonce]);

  // Helper — taruh di dalam komponen, sebelum JSX
  const handleToggleLayout = (toGrid: boolean) => {
    if (toGrid === isGrid) return;
    setIsGrid(toGrid);
  };

  const Segmented = (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: colors.bg,
      }}
    >
      {offline ? (
        <Animated.View
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.ghost,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            transform: [
              {
                scale: offlinePulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              },
            ],
            opacity: offlinePulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.85],
            }),
          }}
        >
          <IconSymbol name="wifi.slash" size={14} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontWeight: "800" }}>
            Offline
          </Text>
        </Animated.View>
      ) : null}

      {/* toggle theme */}
      <Pressable
        onPress={() => setMode(isDark ? "light" : "dark")}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: colors.chip,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <IconSymbol
          name={isDark ? "sun.max.fill" : "moon.fill"}
          size={16}
          color={colors.subtext}
        />
      </Pressable>
    </View>
  );

  if (activeFeed.loading && activeFeed.items.length === 0) {
    const skeletonCards = Array.from({ length: 6 });
    const skeletonShort = Array.from({ length: 8 });
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 10,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 120,
              height: 24,
              borderRadius: 8,
              backgroundColor: colors.shimmerBase,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(120, 8)} />
          </View>
          <View
            style={{
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.shimmerBase,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(320, 14)} />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
            paddingBottom: 10,
          }}
        >
          <View
            style={{
              width: 90,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors.shimmerBase,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(90, 999)} />
          </View>
          <View
            style={{
              width: 90,
              height: 32,
              borderRadius: 999,
              backgroundColor: colors.shimmerBase,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(90, 999)} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 12, marginBottom: 14 }}>
          <View
            style={{
              width: 80,
              height: 16,
              borderRadius: 6,
              backgroundColor: colors.shimmerBase,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(80, 6)} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {skeletonShort.slice(0, 3).map((_, idx) => (
              <View
                key={`hero-skeleton-${idx}`}
                style={{
                  width: 280,
                  height: 160,
                  borderRadius: 18,
                  backgroundColor: colors.shimmerBase,
                  overflow: "hidden",
                }}
              >
                <Animated.View style={shimmerOverlayStyle(280, 18)} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 12 }}>
          <View
            style={{
              width: 120,
              height: 16,
              borderRadius: 6,
              backgroundColor: colors.shimmerBase,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(120, 6)} />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
            {skeletonShort.slice(0, 6).map((_, idx) => (
              <View
                key={`rec-skeleton-${idx}`}
                style={{
                  width: 96,
                  height: 128,
                  borderRadius: 14,
                  backgroundColor: colors.shimmerBase,
                  overflow: "hidden",
                }}
              >
                <Animated.View style={shimmerOverlayStyle(96, 14)} />
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
          {skeletonCards.map((_, idx) => (
            <View
              key={`list-skeleton-${idx}`}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 72,
                  height: 96,
                  borderRadius: 14,
                  backgroundColor: colors.shimmerBase,
                  overflow: "hidden",
                }}
              >
                <Animated.View style={shimmerOverlayStyle(72, 14)} />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <View
                  style={{
                    height: 16,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(220, 6)} />
                </View>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    width: 180,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(180, 6)} />
                </View>
                <View
                  style={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: colors.shimmerBase,
                    width: 140,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(140, 6)} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (activeFeed.error && activeFeed.items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: 24,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.ghost,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <IconSymbol
            name={offline ? "wifi.slash" : "exclamationmark.triangle.fill"}
            size={40}
            color={colors.text}
          />
        </View>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center" }}>
          {offline ? "Kamu Sedang Offline" : `Gagal load ${active}`}
        </Text>
        <Text style={{ fontSize: 16, color: colors.subtext, textAlign: "center", paddingHorizontal: 20 }}>
          {offline ? "Cek koneksi internetmu lalu coba muat ulang halaman ini." : activeFeed.error}
        </Text>

        <Pressable
          onPress={() => void loadFirst(active)}
          style={({ pressed }) => ({
            marginTop: 10,
            paddingVertical: 14,
            paddingHorizontal: 32,
            backgroundColor: colors.text,
            borderRadius: 999,
            opacity: pressed ? 0.8 : 1,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          })}
        >
          <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 16 }}>
            {offline ? "Coba Lagi" : "Retry"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const Header = (
    <View style={{ backgroundColor: colors.bg }}>
      {/* Top bar + Search */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>
          ItzKomik
        </Text>

        <View
          style={{
            backgroundColor: colors.inputBg,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <IconSymbol
            name="magnifyingglass"
            size={16}
            color={colors.placeholder}
          />
          <TextInput
            value={queryInput}
            onChangeText={setQueryInput}
            placeholder="Cari judul"
            placeholderTextColor={colors.placeholder}
            style={{
              flex: 1,
              color: colors.inputText,
              fontWeight: "700",
              fontFamily: Poppins.bold,
            }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {queryInput.length > 0 ? (
            <Pressable onPress={() => setQueryInput("")}>
              <IconSymbol
                name="xmark.circle.fill"
                size={18}
                color={colors.placeholder}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {Segmented}

      {banner ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          <View
            style={{
              backgroundColor: colors.ghost,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text style={{ flex: 1, color: colors.subtext }} numberOfLines={2}>
              {banner}
            </Text>
            <Pressable
              onPress={() => {
                setBanner(null);
                if (useServerSearch && isSearching) {
                  setSearchNonce((n) => n + 1);
                } else {
                  void refreshActive();
                }
              }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.activePillBg,
              }}
            >
              <Text style={{ color: colors.activePillText, fontWeight: "800" }}>
                Retry
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setBanner(null)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 999,
              }}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={16}
                color={colors.subtext}
              />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Hero */}
      {!isSearching && hero.length > 0 ? (
        <HeroCarousel
          items={hero}
          colors={colors}
          onPressItem={(item) =>
            router.push({
              pathname: "/manga/[mangaId]",
              params: toMangaParams(item),
            })
          }
        />
      ) : null}

      {/* Continue reading */}
      {!isSearching && (recentLoading || recent.length > 0) ? (
        <View style={{ paddingHorizontal: 12, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: colors.text,
              }}
            >
              Lanjutkan Bacaan
            </Text>
            <Pressable onPress={() => router.push("/library")}>
              <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                Lihat semua
              </Text>
            </Pressable>
          </View>

          {recentLoading ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              {Array.from({ length: 3 }).map((_, idx) => (
                <View
                  key={`recent-loading-${idx}`}
                  style={{
                    width: 220,
                    borderRadius: 16,
                    backgroundColor: colors.shimmerBase,
                    height: 120,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(220, 16)} />
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              data={recent}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(it) => `${it.mangaId}:${it.chapterId}`}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => {
                const title = item.mangaTitle || "Unknown";
                const page = item.pageIndex + 1;
                const total = item.totalPages || 0;
                const pct =
                  total > 0
                    ? Math.min(100, Math.round((page / total) * 100))
                    : 0;

                return (
                  <View style={{ width: 220 }}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/reader/[chapterId]",
                          params: {
                            chapterId: item.chapterId,
                            mangaTitle: title,
                            coverUrl: item.coverUrl ?? "",
                          },
                        })
                      }
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <View
                        style={{
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 16,
                          padding: 12,
                          gap: 8,
                        }}
                      >
                        {item.coverUrl ? (
                          <Image
                            source={{ uri: item.coverUrl }}
                            style={{
                              width: "100%",
                              height: 120,
                              borderRadius: 12,
                              backgroundColor: colors.chip,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: "100%",
                              height: 120,
                              borderRadius: 12,
                              backgroundColor: colors.chip,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ color: colors.subtext }}>
                              No cover
                            </Text>
                          </View>
                        )}

                        <View style={{ gap: 6 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              fontWeight: "900",
                              color: colors.text,
                            }}
                          >
                            {title}
                          </Text>
                          <Text style={{ color: colors.subtext }}>
                            Ch {item.chapterNumber} · Hal {page}/{total || "-"}
                          </Text>
                        </View>

                        <View
                          style={{
                            height: 6,
                            borderRadius: 999,
                            backgroundColor: colors.chip,
                            overflow: "hidden",
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <View
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              backgroundColor: colors.activePillBg,
                            }}
                          />
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : null}

      {/* Recommended 3 format */}
      {!isSearching ? (
        <View style={{ paddingHorizontal: 12 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: colors.text,
              marginBottom: 10,
            }}
          >
            Recommended
          </Text>
          {/* 🔹 FILTER BUTTON */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            {(["manhwa", "manga", "manhua"] as const).map((t) => {
              const selected = recFilter === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setRecFilter(t)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: selected
                      ? colors.activePillBg
                      : colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.activePillText : colors.subtext,
                      fontWeight: "900",
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 🔹 CONTENT */}
          {rec.loading ? (
            <View
              style={{ paddingVertical: 10, flexDirection: "row", gap: 12 }}
            >
              {Array.from({ length: 6 }).map((_, idx) => (
                <View
                  key={`rec-loading-${idx}`}
                  style={{
                    width: 96,
                    height: 128,
                    borderRadius: 14,
                    backgroundColor: colors.shimmerBase,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(96, 14)} />
                </View>
              ))}
            </View>
          ) : rec.error ? (
            <View style={{ paddingVertical: 10, gap: 10 }}>
              <Text style={{ color: colors.subtext }}>
                Gagal load recommended: {rec.error}
              </Text>
              <Pressable
                onPress={() => void loadRecommended()}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  backgroundColor: colors.ghost,
                  borderRadius: 12,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: colors.ghostText, fontWeight: "900" }}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : rec.manhwa.length + rec.manga.length + rec.manhua.length === 0 ? (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.subtext }}>
                Belum ada rekomendasi saat ini.
              </Text>
            </View>
          ) : (
            <>
              {recFilter === "manhwa" && (
                <RecommendedSection
                  title=""
                  items={rec.manhwa}
                  isDark={isDark}
                />
              )}

              {recFilter === "manga" && (
                <RecommendedSection
                  title=""
                  items={rec.manga}
                  isDark={isDark}
                />
              )}

              {recFilter === "manhua" && (
                <RecommendedSection
                  title=""
                  items={rec.manhua}
                  isDark={isDark}
                />
              )}
            </>
          )}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 12, marginTop: 6, marginBottom: 10 }}>
        {/* Title */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: colors.text,
            marginBottom: 10,
          }}
        >
          {isSearching
            ? "Hasil Pencarian"
            : `Latest Updates (${active === "project" ? "Project" : "Mirror"})`}
        </Text>

        {/* ROW: LEFT (Project/Mirror) + RIGHT (View Toggle) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* 🔹 LEFT: Project / Mirror */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["project", "mirror"] as const).map((t) => {
              const selected = active === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setActive(t)}
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: selected
                      ? colors.activePillBg
                      : colors.chip,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.activePillText : colors.subtext,
                      fontWeight: "900",
                    }}
                  >
                    {t === "project" ? "Project" : "Mirror"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 🔹 RIGHT: Grid / List Toggle */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 4,
            }}
          >
            {/* Grid */}
            <Pressable
              onPress={() => handleToggleLayout(true)}
              style={{
                padding: 6,
                borderRadius: 6,
                backgroundColor: isGrid ? colors.activePillBg : "transparent",
              }}
            >
              <Ionicons
                name="grid-outline"
                size={16}
                color={isGrid ? colors.activePillText : colors.subtext}
              />
            </Pressable>

            {/* List */}
            <Pressable
              onPress={() => handleToggleLayout(false)}
              style={{
                padding: 6,
                borderRadius: 6,
                backgroundColor: !isGrid ? colors.activePillBg : "transparent",
              }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={!isGrid ? colors.activePillText : colors.subtext}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={groupedData}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={Header}
        contentContainerStyle={{
          paddingBottom: 24,
          paddingHorizontal: 12,
          paddingTop: insets.top + 8,
        }}
        refreshControl={
          <RefreshControl
            refreshing={activeFeed.refreshing}
            onRefresh={() => void refreshActive()}
            tintColor={isDark ? "#F2F2F7" : "#1E2329"}
            colors={[isDark ? "#F2F2F7" : "#1E2329"]}
          />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => void loadMore()}
        ListFooterComponent={
          activeFeed.loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
            {useServerSearch && searchState.loading ? (
              <View style={{ paddingTop: 16 }}>
                {isGrid ? <MangaGridSkeleton columns={numColumns} /> : <MangaListSkeleton />}
              </View>
            ) : offline ? (
              <>
                <Text style={{ color: colors.subtext }}>
                  Offline. Tidak bisa memuat data.
                </Text>
                <Pressable
                  onPress={() => void refreshActive()}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.ghost,
                  }}
                >
                  <Text style={{ color: colors.ghostText, fontWeight: "800" }}>
                    Coba lagi
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ color: colors.subtext }}>
                {debouncedQuery.trim()
                  ? `Tidak ada hasil untuk "${debouncedQuery.trim()}".`
                  : "Belum ada update."}
              </Text>
            )}
          </View>
        }
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: "row", gap: isGrid ? 8 : 0 }}>
            {row.items.map((item) => {
              if (!isGrid) {
                return (
                  <Pressable
                    key={item.manga_id}
                    onPress={() =>
                      router.push({
                        pathname: "/manga/[mangaId]",
                        params: toMangaParams(item),
                      })
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      opacity: pressed ? 0.85 : 1,
                      marginBottom: 12,
                    })}
                  >
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
                      <View style={{ position: "relative" }}>
                        <Image
                          source={{
                            uri: item.cover_portrait_url || item.cover_image_url,
                          }}
                          style={{
                            width: 72,
                            height: 96,
                            borderRadius: 14,
                            backgroundColor: colors.chip,
                          }}
                        />
                        {item.latest_chapter_time && (new Date().getTime() - new Date(item.latest_chapter_time).getTime()) / (1000 * 3600 * 24) <= 3 && (
                          <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3B30', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 1, elevation: 2, zIndex: 10 }}>
                            <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>NEW</Text>
                          </View>
                        )}
                        {item.latest_chapter_time ? (
                          <View style={{ position: "absolute", top: 4, left: 4, backgroundColor: colors.danger, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "900" }}>{item.is_recommended ? "UP " : ""}{parseRelativeTime(item.latest_chapter_time)}</Text>
                          </View>
                        ) : null}
                        {item.status ? (
                          <View style={{ position: "absolute", bottom: 4, left: 4, backgroundColor: item.status === 1 ? "#34C759" : "#5856D6", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: "#FFF", fontSize: 8, fontWeight: "900" }}>{getStatusLabel(item.status).toUpperCase()}</Text>
                          </View>
                        ) : null}
                        {item.country_id ? (
                          <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 2 }}>
                            <Text style={{ fontSize: 9 }}>{getFlagEmoji(item.country_id)}</Text>
                            <Text style={{ color: "#FFF", fontSize: 8, fontWeight: "700" }}>{getFormatLabel(item)}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <Text
                          numberOfLines={2}
                          style={{
                            fontSize: 16,
                            fontWeight: "900",
                            color: colors.text,
                          }}
                        >
                          {item.title}
                        </Text>

                        <Text numberOfLines={2} style={{ color: colors.subtext }}>
                          {item.description}
                        </Text>

                        <View
                          style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                        >
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
                              Rate {item.user_rate || 0}
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
                              Views {item.view_count.toLocaleString("id-ID")}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <IconSymbol
                        name="chevron.right"
                        size={18}
                        color={colors.subtext}
                      />
                    </View>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={item.manga_id}
                  onPress={() =>
                    router.push({
                      pathname: "/manga/[mangaId]",
                      params: toMangaParams(item),
                    })
                  }
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      marginBottom: 12,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={{ aspectRatio: 2 / 3, width: "100%", position: "relative" }}>
                    <Image
                      source={{
                        uri: item.cover_portrait_url || item.cover_image_url,
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: colors.chip,
                      }}
                      resizeMode="cover"
                    />
                    {item.latest_chapter_time && (new Date().getTime() - new Date(item.latest_chapter_time).getTime()) / (1000 * 3600 * 24) <= 3 && (
                      <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 }}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>NEW</Text>
                      </View>
                    )}
                    {item.latest_chapter_time ? (
                      <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "900" }}>{item.is_recommended ? "UP " : ""}{parseRelativeTime(item.latest_chapter_time)}</Text>
                      </View>
                    ) : null}
                    {item.status ? (
                      <View style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: item.status === 1 ? "#34C759" : "#5856D6", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: "#FFF", fontSize: 8, fontWeight: "900" }}>{getStatusLabel(item.status).toUpperCase()}</Text>
                      </View>
                    ) : null}
                    {item.country_id ? (
                      <View style={{ position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 2 }}>
                        <Text style={{ fontSize: 10 }}>{getFlagEmoji(item.country_id)}</Text>
                        <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "700" }}>{getFormatLabel(item)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ padding: 8, gap: 4 }}>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 13,
                        fontWeight: "900",
                        color: colors.text,
                      }}
                    >
                      {item.title}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}>
                        Ch {item.latest_chapter_number || "-"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <Ionicons name="star" size={12} color="#F5B041" />
                          <Text style={{ color: colors.subtext, fontSize: 11 }}>
                            {item.user_rate || "0.0"}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          <IconSymbol name="eye" size={12} color={colors.subtext} />
                          <Text style={{ color: colors.subtext, fontSize: 11 }}>
                            {item.view_count >= 1000000 
                              ? (item.view_count / 1000000).toFixed(1) + "M"
                              : item.view_count >= 1000
                              ? (item.view_count / 1000).toFixed(1) + "K"
                              : item.view_count}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            
            {/* Pad the last row with empty views if it's a grid */}
            {isGrid && Array.from({ length: numColumns - row.items.length }).map((_, i) => (
              <View key={`empty-${i}`} style={{ flex: 1 }} />
            ))}
          </View>
        )}
      />
    </View>
  );
}