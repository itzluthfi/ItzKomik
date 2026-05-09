import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAppTheme } from "@/src/theme/ThemeContext";
import { getChapterList, getMangaDetail } from "../../src/api/shngmClient";
import type { ShngmChapter, ShngmManga } from "../../src/api/shngmTypes";
import { isBookmarked, toggleBookmark } from "../../src/store/bookmarks";
import { getLatestProgressByManga, getReadChaptersLocal } from "../../src/store/history";

type ResumeState = {
  chapterId: string;
  chapterNumber: number;
  pageIndex: number;
  totalPages: number;
} | null;

type ScreenState = {
  manga: ShngmManga | null;
  chapters: ShngmChapter[];
  page: number;
  totalPage: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
};

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

export default function MangaDetailScreen() {
  const { mangaId, title, description, coverUrl, countryId, userRate } =
    useLocalSearchParams<{
      mangaId: string;
      title?: string;
      description?: string;
      coverUrl?: string;
      countryId?: string;
      userRate?: string;
    }>();
  const id = typeof mangaId === "string" ? mangaId : "";

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
      button: isDark ? "#F2F2F7" : "#1E2A3A",
      buttonText: isDark ? "#111111" : "#F7F2EA",
      ghost: isDark ? "#1A1A24" : "#F2E9DD",
      ghostText: isDark ? "#F2F2F7" : "#1E2329",
      inputBg: isDark ? "#121218" : "#FBF5EC",
      inputText: isDark ? "#F2F2F7" : "#1E2329",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      shimmerBase: isDark ? "#1A1A24" : "#EFE6DA",
      shimmerHighlight: isDark ? "#2A2A36" : "#F7F1E8",
      primary: isDark ? "#00FFF5" : "#1D1135",
      primaryText: isDark ? "#1D1135" : "#F7F2EA",
    }),
    [isDark],
  );

  const [resume, setResume] = React.useState<ResumeState>(null);
  const [bookmarked, setBookmarked] = React.useState<boolean>(false);
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [sortDir, setSortDir] = React.useState<"desc" | "asc">("desc");
  const [toast, setToast] = React.useState<string | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [readChapters, setReadChapters] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");

  const shimmer = React.useRef(new Animated.Value(0)).current;
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

  const [state, setState] = React.useState<ScreenState>({
    manga: null,
    chapters: [],
    page: 1,
    totalPage: 1,
    loading: true,
    loadingMore: false,
    error: null,
  });

  const routeTitle = typeof title === "string" ? title : "";
  const routeDescription = typeof description === "string" ? description : "";
  const routeCoverUrl = typeof coverUrl === "string" ? coverUrl : "";
  const routeCountryId = typeof countryId === "string" ? countryId : "";
  const parsedUserRate =
    typeof userRate === "string" && userRate.trim() !== ""
      ? parseFloat(userRate)
      : null;

  const displayTitle = state.manga?.title || routeTitle || "Manga";
  const displayDescription =
    state.manga?.description || routeDescription || "-";
  const displayCover =
    state.manga?.cover_portrait_url ??
    state.manga?.cover_image_url ??
    routeCoverUrl ??
    "";
  const displayCountryId = state.manga?.country_id || routeCountryId;
  const displayUserRate =
    typeof state.manga?.user_rate === "number"
      ? state.manga.user_rate
      : Number.isFinite(parsedUserRate) ? parsedUserRate : null;

  // --- Helper format angka (1200 → "1.2K") ---
  function formatCount(n: number): string {
    if (n >= 1_000_000)
      return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(n);
  }

  // --- Derived metadata dari API detail ---
  const displayMeta = React.useMemo(() => {
    const m = state.manga;
    if (!m) return null;
    return {
      genres: (m.taxonomy.Genre ?? []).filter((g) => g.name),
      authors: (m.taxonomy.Author ?? []).filter((a) => a.name),
      artists: (m.taxonomy.Artist ?? []).filter((a) => a.name),
      formats: (m.taxonomy.Format ?? []).filter((a) => a.name),
      types: (m.taxonomy.Type ?? []).filter((a) => a.name),
      status: m.status, // 1=Ongoing, 2=Completed, 0=Unknown
      year: m.release_year,
      views: m.view_count,
      bookmarks: m.bookmark_count,
    };
  }, [state.manga]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const loadResume = React.useCallback(async () => {
    if (!id) return;
    const [progress, localRead] = await Promise.all([
      getLatestProgressByManga(id),
      getReadChaptersLocal(id),
    ]);
    setReadChapters(localRead);
    setResume(
      progress
        ? {
            chapterId: progress.chapterId,
            chapterNumber: progress.chapterNumber,
            pageIndex: progress.pageIndex,
            totalPages: progress.totalPages,
          }
        : null,
    );
  }, [id]);

  const loadBookmarkState = React.useCallback(async () => {
    if (!id) return;
    const bm = await isBookmarked(id);
    setBookmarked(bm);
  }, [id]);

  const load = React.useCallback(async () => {
    if (!id) return;

    try {
      setState((s) => ({ ...s, loading: true, error: null }));

      const [detailRes, chapterRes] = await Promise.all([
        getMangaDetail(id),
        getChapterList({ mangaId: id, page: 1, pageSize: 20 }),
      ]);
      const manga: ShngmManga = detailRes.data;
      setState((s) => ({
        ...s,
        manga,
        chapters: chapterRes.data,
        page: chapterRes.meta.page,
        totalPage: chapterRes.meta.total_page,
        loading: false,
        loadingMore: false,
        error: null,
      }));
      setOffline(false);

      await Promise.all([loadResume(), loadBookmarkState()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        error: msg,
      }));
    }
  }, [id, loadResume, loadBookmarkState]);

  const loadMore = React.useCallback(async () => {
    if (!id) return;

    try {
      let nextPage = 0;

      // ambil next page dari state TERBARU biar gak race condition
      setState((s) => {
        if (s.loadingMore) return s;
        if (s.page >= s.totalPage) return s;
        nextPage = s.page + 1;
        return { ...s, loadingMore: true };
      });

      if (nextPage === 0) return;

      const res = await getChapterList({
        mangaId: id,
        page: nextPage,
        pageSize: 20,
      });

      setState((s) => {
        // dedupe chapter_id biar gak ada key duplikat kalau API ngirim dobel
        const map = new Map<string, ShngmChapter>();
        for (const ch of s.chapters) map.set(ch.chapter_id, ch);
        for (const ch of res.data) map.set(ch.chapter_id, ch);

        return {
          ...s,
          chapters: Array.from(map.values()),
          page: res.meta.page,
          totalPage: res.meta.total_page,
          loadingMore: false,
        };
      });
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isOfflineError(e)) setOffline(true);
      setState((s) => ({ ...s, loadingMore: false, error: msg }));
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // saat balik ke screen ini dari reader / tab lain, refresh resume + bookmark
  useFocusEffect(
    React.useCallback(() => {
      void loadResume();
      void loadBookmarkState();
    }, [loadResume, loadBookmarkState]),
  );

  const showDescToggle = displayDescription.length > 140;
  const orderedChapters = React.useMemo(() => {
    let copy = [...state.chapters];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      copy = copy.filter((c) => {
        const numStr = String(c.chapter_number ?? "");
        const titleStr = String(c.chapter_title ?? "").toLowerCase();
        return numStr.includes(q) || titleStr.includes(q);
      });
    }

    copy.sort((a, b) => {
      const aNum = typeof a.chapter_number === "number" ? a.chapter_number : 0;
      const bNum = typeof b.chapter_number === "number" ? b.chapter_number : 0;
      return sortDir === "desc" ? bNum - aNum : aNum - bNum;
    });
    return copy;
  }, [state.chapters, sortDir, searchQuery]);
  const jumpIndex = React.useMemo(() => {
    if (orderedChapters.length === 0) return 0;
    
    if (resume) {
      const idx = orderedChapters.findIndex((c) => c.chapter_number === resume.chapterNumber);
      if (idx >= 0) return idx;
    }

    let maxNum = -Infinity;
    let minNum = Infinity;
    for (const ch of orderedChapters) {
      const num = typeof ch.chapter_number === "number" ? ch.chapter_number : 0;
      if (num > maxNum) maxNum = num;
      if (num < minNum) minNum = num;
    }
    const targetNum = sortDir === "desc" ? maxNum : minNum;
    const idx = orderedChapters.findIndex((c) => {
      const num = typeof c.chapter_number === "number" ? c.chapter_number : 0;
      return num === targetNum;
    });
    return idx >= 0 ? idx : 0;
  }, [orderedChapters, sortDir, resume]);
  const listRef = React.useRef<FlatList<ShngmChapter>>(null);

  const resumeCta = resume ? (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/reader/[chapterId]",
          params: {
            chapterId: resume.chapterId,
            mangaTitle: displayTitle,
            coverUrl: displayCover,
          },
        })
      }
      style={{
        backgroundColor: colors.button,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <IconSymbol name="play.fill" size={18} color={colors.buttonText} />
      <Text style={{ color: colors.buttonText, fontWeight: "900" }}>
        Lanjutkan: Chapter {resume.chapterNumber} (hal {resume.pageIndex + 1}/
        {resume.totalPages})
      </Text>
    </Pressable>
  ) : null;
  const bottomInset = (resume ? 120 : 24) + (toast ? 40 : 0);

  if (state.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 12, gap: 12, paddingTop: insets.top + 12 }}>
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
            <View
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

            <View style={{ flex: 1, gap: 8 }}>
              <View
                style={{
                  height: 18,
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
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <View
                  style={{
                    width: 70,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: colors.shimmerBase,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(70, 999)} />
                </View>
                <View
                  style={{
                    width: 70,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: colors.shimmerBase,
                    overflow: "hidden",
                  }}
                >
                  <Animated.View style={shimmerOverlayStyle(70, 999)} />
                </View>
              </View>
            </View>
          </View>

          <View
            style={{
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.shimmerBase,
              overflow: "hidden",
            }}
          >
            <Animated.View style={shimmerOverlayStyle(320, 14)} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 12 }}>
          {Array.from({ length: 8 }).map((_, idx) => (
            <View
              key={`chapter-skeleton-${idx}`}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: colors.shimmerBase,
                  overflow: "hidden",
                }}
              >
                <Animated.View style={shimmerOverlayStyle(56, 14)} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View
                  style={{
                    height: 14,
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
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (state.error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          padding: 24,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          paddingTop: insets.top + 16,
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
          {offline ? "Kamu Sedang Offline" : "Gagal load"}
        </Text>
        <Text style={{ fontSize: 16, color: colors.subtext, textAlign: "center", paddingHorizontal: 20 }}>
          {offline ? "Cek koneksi internetmu lalu coba muat ulang halaman ini." : state.error}
        </Text>

        <Pressable
          onPress={() => void load()}
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

  const header = (
    <View style={{ backgroundColor: colors.bg, padding: 12, gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.push("/")}
            style={{
              padding: 10,
              borderRadius: 999,
              backgroundColor: colors.chip,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
            Detail
          </Text>
        </View>
        {offline && (
          <View
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
            }}
          >
            <IconSymbol name="wifi.slash" size={14} color={colors.subtext} />
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              Offline
            </Text>
          </View>
        )}
      </View>
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
        <ExpoImage
          source={{
            uri: displayCover,
          }}
          style={{
            width: 96,
            height: 128,
            borderRadius: 14,
            backgroundColor: colors.chip,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <Text
            style={{ fontSize: 18, fontWeight: "900", color: colors.text }}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          <Text
            style={{ color: colors.subtext, lineHeight: 18 }}
            numberOfLines={descExpanded ? 0 : 4}
          >
            {displayDescription}
          </Text>
          {showDescToggle && (
            <Pressable onPress={() => setDescExpanded((v) => !v)}>
              <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                {descExpanded ? "Show less" : "Read more"}
              </Text>
            </Pressable>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {displayCountryId && (
              <View
                style={{
                  backgroundColor: colors.chip,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <IconSymbol name="flag.fill" size={14} color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                  {displayCountryId}
                </Text>
              </View>
            )}
            {typeof displayUserRate === "number" && (
              <View
                style={{
                  backgroundColor: colors.chip,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <IconSymbol name="star.fill" size={14} color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                  {displayUserRate}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Metadata Section ── */}
      {displayMeta && (
        <View style={{ gap: 10 }}>
          {/* Status + Release Year + Stats */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {/* Status badge */}
            {displayMeta.status === 1 && (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(52,199,89,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(52,199,89,0.4)",
                }}
              >
                <Text
                  style={{ color: "#34C759", fontWeight: "800", fontSize: 12 }}
                >
                  Ongoing
                </Text>
              </View>
            )}
            {displayMeta.status === 2 && (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  Completed
                </Text>
              </View>
            )}
            {/* Release year */}
            {!!displayMeta.year && (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <IconSymbol name="calendar" size={12} color={colors.subtext} />
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {displayMeta.year}
                </Text>
              </View>
            )}
            {/* View count */}
            {displayMeta.views > 0 && (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <IconSymbol name="eye" size={12} color={colors.subtext} />
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {formatCount(displayMeta.views)}
                </Text>
              </View>
            )}
            {/* Bookmark count */}
            {displayMeta.bookmarks > 0 && (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <IconSymbol name="bookmark" size={12} color={colors.subtext} />
                <Text
                  style={{
                    color: colors.subtext,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {formatCount(displayMeta.bookmarks)}
                </Text>
              </View>
            )}
          </View>

          {/* Taxonomy Section matching image layout */}
          <View style={{ gap: 12 }}>
            {/* Row 1: Genre | Author */}
            {(displayMeta.genres.length > 0 ||
              displayMeta.authors.length > 0) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center", gap: 8 }}
              >
                {displayMeta.genres.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginRight: 2,
                        marginLeft: 2,
                      }}
                    >
                      Genre
                    </Text>
                    {displayMeta.genres.map((g) => (
                      <View
                        key={`g-${g.slug}`}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          {g.name}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                {displayMeta.genres.length > 0 &&
                  displayMeta.authors.length > 0 && (
                    <View
                      style={{
                        width: 1,
                        height: 16,
                        backgroundColor: colors.border,
                        marginHorizontal: 4,
                      }}
                    />
                  )}
                {displayMeta.authors.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginRight: 2,
                        marginLeft: 2,
                      }}
                    >
                      Author
                    </Text>
                    {displayMeta.authors.map((a) => (
                      <View
                        key={`a-${a.slug}`}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          {a.name}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            {/* Row 2: Artist | Format | Type */}
            {(displayMeta.artists.length > 0 ||
              displayMeta.formats.length > 0 ||
              displayMeta.types.length > 0) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center", gap: 8 }}
              >
                {displayMeta.artists.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginRight: 2,
                        marginLeft: 2,
                      }}
                    >
                      Artist
                    </Text>
                    {displayMeta.artists.map((a) => (
                      <View
                        key={`ar-${a.slug}`}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          {a.name}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                {displayMeta.artists.length > 0 &&
                  (displayMeta.formats.length > 0 ||
                    displayMeta.types.length > 0) && (
                    <View
                      style={{
                        width: 1,
                        height: 16,
                        backgroundColor: colors.border,
                        marginHorizontal: 4,
                      }}
                    />
                  )}
                {displayMeta.formats.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginRight: 2,
                        marginLeft: 2,
                      }}
                    >
                      Format
                    </Text>
                    {displayMeta.formats.map((f) => (
                      <View
                        key={`f-${f.slug}`}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          {f.name}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                {displayMeta.formats.length > 0 &&
                  displayMeta.types.length > 0 && (
                    <View
                      style={{
                        width: 1,
                        height: 16,
                        backgroundColor: colors.border,
                        marginHorizontal: 4,
                      }}
                    />
                  )}
                {displayMeta.types.length > 0 && (
                  <>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginRight: 2,
                        marginLeft: 2,
                      }}
                    >
                      Type
                    </Text>
                    {displayMeta.types.map((t) => (
                      <View
                        key={`t-${t.slug}`}
                        style={{
                          paddingVertical: 5,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: colors.chip,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: "600",
                            fontSize: 12,
                          }}
                        >
                          {t.name}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* Tombol Baca */}
        <Pressable
          onPress={() => {
            const targetId =
              resume?.chapterId ?? state.manga?.latest_chapter_id;
            if (targetId) {
              router.push(`/reader/${targetId}`);
            }
          }}
          style={{
            flex: 1,
            backgroundColor: colors.button,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSymbol name="book.fill" size={18} color={colors.buttonText} />
            <Text style={{ color: colors.buttonText, fontWeight: "900" }}>
              {resume ? `Lanjut Ch. ${resume.chapterNumber}` : "Baca Terbaru"}
            </Text>
          </View>
        </Pressable>

        {/* Tombol Bookmark */}
        <Pressable
          onPress={async () => {
            if (!id) return;
            const cover = displayCover;
            const next = await toggleBookmark({
              mangaId: id,
              title: displayTitle,
              coverUrl: cover,
            });
            setBookmarked(next);
            setToast(
              next ? "Ditambahkan ke bookmark" : "Dihapus dari bookmark",
            );
          }}
          style={{
            flex: 1,
            backgroundColor: bookmarked ? colors.ghost : colors.chip,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: bookmarked ? colors.border : colors.border,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSymbol
              name={bookmarked ? "bookmark.fill" : "bookmark"}
              size={18}
              color={bookmarked ? colors.ghostText : colors.text}
            />
            <Text
              style={{
                color: bookmarked ? colors.ghostText : colors.text,
                fontWeight: "900",
              }}
            >
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </Text>
          </View>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
          Chapter
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => {
              if (state.chapters.length === 0) return;
              let minNum = Infinity;
              let firstChapterId = state.chapters[0].chapter_id;
              for (const ch of state.chapters) {
                const num = typeof ch.chapter_number === "number" ? ch.chapter_number : 0;
                if (num < minNum) {
                  minNum = num;
                  firstChapterId = ch.chapter_id;
                }
              }
              router.push({
                pathname: "/reader/[chapterId]",
                params: {
                  chapterId: firstChapterId,
                  mangaTitle: displayTitle,
                  coverUrl: displayCover,
                },
              });
            }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.chip,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol name="book.fill" size={14} color={colors.subtext} />
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>Awal</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              listRef.current?.scrollToIndex({
                index: jumpIndex,
                animated: true,
              });
            }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.chip,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol
              name="arrow.up.to.line"
              size={14}
              color={colors.subtext}
            />
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              Jump
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSortDir((v) => (v === "desc" ? "asc" : "desc"));
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.chip,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <IconSymbol
              name="arrow.up.arrow.down"
              size={14}
              color={colors.subtext}
            />
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              {sortDir === "desc" ? "Latest" : "Oldest"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 🔹 CHAPTER SEARCH */}
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
          marginTop: 12,
        }}
      >
        <IconSymbol
          name="magnifyingglass"
          size={16}
          color={colors.placeholder}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari chapter (contoh: 15, ep 20)"
          placeholderTextColor={colors.placeholder}
          style={{
            flex: 1,
            color: colors.inputText,
            fontWeight: "700",
          }}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <IconSymbol
              name="xmark.circle.fill"
              size={18}
              color={colors.placeholder}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={listRef}
        data={orderedChapters}
        keyExtractor={(c) => c.chapter_id}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingBottom: bottomInset,
          paddingTop: insets.top + 8,
        }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (!state.loadingMore) void loadMore();
        }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
            {offline ? (
              <>
                <Text style={{ color: colors.subtext }}>
                  Offline. Tidak bisa memuat daftar chapter.
                </Text>
                <Pressable
                  onPress={() => void load()}
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
                Belum ada chapter untuk manga ini.
              </Text>
            )}
          </View>
        }
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={
          state.loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator />
            </View>
          ) : state.chapters.length > 0 && state.page >= state.totalPage ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: colors.subtext }}>
                Tidak ada chapter lagi.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/reader/[chapterId]",
                params: {
                  chapterId: item.chapter_id,
                  mangaTitle: displayTitle,
                  coverUrl: displayCover,
                },
              })
            }
            style={({ pressed }) => ({
              backgroundColor: colors.bg,
              opacity: pressed ? 0.85 : 1,
              paddingHorizontal: 12,
              paddingVertical: 10,
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
                alignItems: "center",
                gap: 12,
              }}
            >
              <ExpoImage
                source={{ uri: item.thumbnail_image_url ?? "" }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: colors.chip,
                }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />

              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text 
                    style={{ 
                      fontWeight: resume && item.chapter_number === resume.chapterNumber ? "700" : "900", 
                      color: resume && item.chapter_number === resume.chapterNumber ? colors.subtext : colors.text 
                    }}
                  >
                    Chapter {item.chapter_number}
                    {item.chapter_title ? ` - ${item.chapter_title}` : ""}
                  </Text>
                  {resume && item.chapter_number === resume.chapterNumber && (
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>Terakhir Dibaca</Text>
                    </View>
                  )}
                  {readChapters.includes(item.chapter_id) && (!resume || item.chapter_number !== resume.chapterNumber) && (
                    <View style={{ backgroundColor: colors.chip, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: "800" }}>Sudah Dibaca</Text>
                    </View>
                  )}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <IconSymbol name="eye" size={14} color={colors.subtext} />
                    <Text style={{ color: colors.subtext }}>
                      {item.view_count.toLocaleString("id-ID")}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <IconSymbol
                      name="calendar"
                      size={14}
                      color={colors.subtext}
                    />
                    <Text style={{ color: colors.subtext }}>
                      {new Date(item.release_date).toLocaleDateString("id-ID")}
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
        )}
      />
      {resumeCta && (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          {resumeCta}
        </View>
      )}
      {toast && (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: resume ? 76 : 12,
          }}
        >
          <View
            style={{
              backgroundColor: colors.ghost,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 8,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IconSymbol name="bookmark.fill" size={16} color={colors.subtext} />
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              {toast}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
