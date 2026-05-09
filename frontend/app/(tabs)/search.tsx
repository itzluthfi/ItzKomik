import { Text } from "@/components/ui/app-text";
import { getMangaListByType } from "@/src/api/shngmClient";
import type { ShngmManga } from "@/src/api/shngmTypes";
import { useAppTheme } from "@/src/theme/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MangaGridSkeleton, MangaListSkeleton } from "@/components/ui/SkeletonLoaders";

// ─────────────────────────── constants ───────────────────────────
const MOCK_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mecha",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

const FORMAT_OPTIONS = ["Manga", "Manhwa", "Manhua"];
const TYPE_OPTIONS = ["Mirror", "Project"];
const STATUS_OPTIONS = ["Ongoing", "Completed", "Hiatus"];

type SortKey = "latest" | "popular" | "rating" | "bookmark";
type SortOption = { label: string; value: SortKey };
const SORT_OPTIONS: SortOption[] = [
  { label: "Terbaru", value: "latest" },
  { label: "Popularitas", value: "popular" },
  { label: "Rating", value: "rating" },
  { label: "Bookmark", value: "bookmark" },
];

// ─────────────────────────── helpers ─────────────────────────────
function getFlagEmoji(countryId: string) {
  const map: Record<string, string> = {
    kr: "🇰🇷",
    jp: "🇯🇵",
    cn: "🇨🇳",
    id: "🇮🇩",
    gb: "🇬🇧",
    us: "🇺🇸",
  };
  return map[(countryId || "").toLowerCase()] || countryId?.toUpperCase() || "";
}

function formatViews(views: number) {
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + "M";
  if (views >= 1_000) return (views / 1_000).toFixed(1) + "K";
  return String(views);
}

function parseRelativeTime(dateStr: string) {
  if (!dateStr) return "";

  // Jika dari API sudah berupa string relative ("2 hours ago")
  if (dateStr.includes("hour")) return dateStr.split(" ")[0] + " jam lalu";
  if (dateStr.includes("day")) return dateStr.split(" ")[0] + " hari lalu";
  if (dateStr.includes("min")) return dateStr.split(" ")[0] + " mnt lalu";
  if (dateStr.includes("sec")) return "Baru saja";

  // Jika dateStr berupa timestamp ISO (2024-05-10T12:00:00Z)
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

/** Client-side sort so all four options work without needing new API params */
function sortItems(items: ShngmManga[], key: SortKey): ShngmManga[] {
  const arr = [...items];
  switch (key) {
    case "popular":
      return arr.sort((a, b) => b.view_count - a.view_count);
    case "rating":
      return arr.sort((a, b) => (b.user_rate ?? 0) - (a.user_rate ?? 0));
    case "bookmark":
      return arr.sort((a, b) => b.bookmark_count - a.bookmark_count);
    case "latest":
    default:
      return arr.sort((a, b) => {
        const timeA = new Date(a.latest_chapter_time || a.updated_at).getTime();
        const timeB = new Date(b.latest_chapter_time || b.updated_at).getTime();
        return timeB - timeA;
      });
  }
}

// ─────────────────────────── types ───────────────────────────────
type Colors = {
  bg: string;
  card: string;
  sidebar: string;
  text: string;
  subtext: string;
  border: string;
  chip: string;
  chipActive: string;
  chipTextActive: string;
  danger: string;
  primary: string;
  button: string;
  buttonText: string;
};

// ─────────────────────── CollapsibleSection ──────────────────────
const CollapsibleSection = ({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: Colors;
}) => {
  const [open, setOpen] = useState(true); // open by default for better UX
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>
          {title}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.subtext}
        />
      </Pressable>
      {open && <View style={{ paddingTop: 10 }}>{children}</View>}
    </View>
  );
};

// ─────────────────────── FilterChips ─────────────────────────────
/** A row of selectable pill chips */
const FilterChips = ({
  options,
  selected,
  onToggle,
  colors,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  colors: Colors;
}) => (
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map((opt) => {
      const active = selected.includes(opt);
      return (
        <Pressable
          key={opt}
          onPress={() => onToggle(opt)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            backgroundColor: active ? colors.chipActive : colors.chip,
            borderColor: active ? colors.chipActive : colors.border,
          }}
        >
          <Text
            style={{
              color: active ? colors.chipTextActive : colors.subtext,
              fontSize: 12,
              fontWeight: active ? "800" : "600",
            }}
          >
            {opt}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

// ─────────────────────── SidebarContent ──────────────────────────
type SidebarProps = {
  colors: Colors;
  selectedGenres: string[];
  selectedTypes: string[];
  onToggleGenre: (g: string) => void;
  onToggleType: (t: string) => void;
  onClearAll: () => void;
};

const SidebarContent = ({
  colors,
  selectedGenres,
  selectedTypes,
  onToggleGenre,
  onToggleType,
  onClearAll,
}: SidebarProps) => {
  const [genreQuery, setGenreQuery] = useState("");
  const filteredGenres = genreQuery
    ? MOCK_GENRES.filter((g) =>
        g.toLowerCase().includes(genreQuery.toLowerCase()),
      )
    : MOCK_GENRES;

  const totalActive = selectedGenres.length + selectedTypes.length;

  return (
    <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      {/* Header with clear button */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          Filter
        </Text>
        {totalActive > 0 && (
          <Pressable
            onPress={onClearAll}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.danger,
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>
              Clear ({totalActive})
            </Text>
          </Pressable>
        )}
      </View>

      {/* Genre */}
      <CollapsibleSection title="Genre" colors={colors}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={14} color={colors.subtext} />
          <TextInput
            placeholder="Cari genre..."
            placeholderTextColor={colors.subtext}
            value={genreQuery}
            onChangeText={setGenreQuery}
            style={{ flex: 1, marginLeft: 8, color: colors.text, fontSize: 13 }}
          />
        </View>
        <FilterChips
          options={filteredGenres}
          selected={selectedGenres}
          onToggle={onToggleGenre}
          colors={colors}
        />
      </CollapsibleSection>

      {/* Type */}
      <CollapsibleSection title="Type" colors={colors}>
        <FilterChips
          options={TYPE_OPTIONS}
          selected={selectedTypes}
          onToggle={onToggleType}
          colors={colors}
        />
      </CollapsibleSection>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

// ─────────────────────── MangaCard ───────────────────────────────
type CardProps = { item: ShngmManga; colors: Colors; isGrid: boolean };

const MangaCard = ({ item, colors, isGrid }: CardProps) => {
  const router = useRouter();
  const handlePress = () =>
    router.push({
      pathname: "/manga/[mangaId]",
      params: {
        mangaId: item.manga_id,
        title: item.title,
        coverUrl: item.cover_portrait_url || item.cover_image_url,
      },
    });

  const coverUri = item.cover_portrait_url || item.cover_image_url;

  if (!isGrid) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          backgroundColor: colors.card,
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 10,
          opacity: pressed ? 0.85 : 1,
          gap: 12,
          padding: 10,
        })}
      >
        <View style={{ position: "relative" }}>
          <ExpoImage
            source={{ uri: coverUri }}
            style={{
              width: 72,
              height: 96,
              borderRadius: 8,
              backgroundColor: colors.border,
            }}
            contentFit="cover"
          />
          {item.latest_chapter_time && (new Date().getTime() - new Date(item.latest_chapter_time).getTime()) / (1000 * 3600 * 24) <= 3 && (
            <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3B30', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 1, elevation: 2, zIndex: 10 }}>
              <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>NEW</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
          <Text
            style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.alternative_title ? (
            <Text
              style={{ color: colors.subtext, fontSize: 12 }}
              numberOfLines={1}
            >
              {item.alternative_title}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Text
              style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}
            >
              Ch {item.latest_chapter_number}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <Ionicons name="eye" size={12} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontSize: 11 }}>
                {formatViews(item.view_count)}
              </Text>
            </View>
            {item.user_rate ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Ionicons name="star" size={11} color="#EAB308" />
                <Text style={{ color: colors.subtext, fontSize: 11 }}>
                  {item.user_rate}
                </Text>
              </View>
            ) : null}
            {item.latest_chapter_time ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 'auto' }}>
                <Ionicons name="time-outline" size={12} color={colors.subtext} />
                <Text style={{ color: colors.subtext, fontSize: 11 }}>
                  {parseRelativeTime(item.latest_chapter_time)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.subtext}
          style={{ alignSelf: "center" }}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={{ aspectRatio: 2 / 3, width: "100%", position: "relative" }}>
        <ExpoImage
          source={{ uri: coverUri }}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: colors.border,
          }}
          contentFit="cover"
        />
        {item.latest_chapter_time ? (
          <View
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              backgroundColor: colors.danger,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "900" }}>
              {item.is_recommended ? "UP " : ""}
              {parseRelativeTime(item.latest_chapter_time)}
            </Text>
          </View>
        ) : null}
        {item.latest_chapter_time && (new Date().getTime() - new Date(item.latest_chapter_time).getTime()) / (1000 * 3600 * 24) <= 3 && (
          <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3 }}>
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>NEW</Text>
          </View>
        )}
        {item.status ? (
          <View style={{ position: "absolute", bottom: 6, left: 6, backgroundColor: item.status === 1 ? "#34C759" : "#5856D6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
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
          style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}
          numberOfLines={2}
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
          <Text
            style={{ color: colors.subtext, fontSize: 11, fontWeight: "700" }}
          >
            Ch {item.latest_chapter_number}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Ionicons name="star" size={12} color="#F5B041" />
              <Text style={{ color: colors.subtext, fontSize: 11 }}>
                {item.user_rate || "0.0"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Ionicons name="eye" size={12} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontSize: 11 }}>
                {formatViews(item.view_count)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

// ─────────────────────── SortDropdown Modal ───────────────────────
const SortDropdown = ({
  visible,
  onClose,
  sortBy,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  sortBy: SortKey;
  onSelect: (v: SortKey) => void;
  colors: Colors;
}) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <Pressable style={{ flex: 1 }} onPress={onClose}>
      <View
        style={{
          position: "absolute",
          top: 100,
          right: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 180,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        {SORT_OPTIONS.map((opt) => {
          const active = sortBy === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: active
                  ? colors.chip
                  : pressed
                    ? colors.border
                    : "transparent",
              })}
            >
              <Text
                style={{
                  color: active ? colors.text : colors.subtext,
                  fontWeight: active ? "800" : "600",
                  fontSize: 14,
                }}
              >
                {opt.label}
              </Text>
              {active && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.chipActive}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  </Modal>
);

// ─────────────────────── SearchScreen ────────────────────────────
export default function SearchScreen() {
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isDesktop = width >= 768;

  const [isGridView, setIsGridView] = useState(true);
  const columns = isGridView ? (isDesktop ? (width >= 1024 ? 6 : 4) : 2) : 1;

  const colors = useMemo<Colors>(
    () => ({
      bg: isDark ? "#0B0B0E" : "#F6F1E9",
      card: isDark ? "#121218" : "#FBF6EE",
      sidebar: isDark ? "#101015" : "#F2EADF",
      text: isDark ? "#F2F2F7" : "#1E2329",
      subtext: isDark ? "#B3B3C2" : "#6A625A",
      border: isDark ? "#242434" : "#E6DED2",
      chip: isDark ? "#1A1A24" : "#EFE6DA",
      chipActive: isDark ? "#F2F2F7" : "#1E2329",
      chipTextActive: isDark ? "#0B0B0E" : "#F6F1E9",
      danger: isDark ? "#FF5C5C" : "#D32F2F",
      primary: isDark ? "#4A90E2" : "#005bb5",
      button: isDark ? "#F2F2F7" : "#1E2329",
      buttonText: isDark ? "#0B0B0E" : "#F6F1E9",
    }),
    [isDark],
  );

  // filter state
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Singular filter states for the new horizontal bar
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();

  // sort state
  const [sortBy, setSortBy] = useState<SortKey>("latest");
  const [isSortOpen, setIsSortOpen] = useState(false);

  // data
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [rawItems, setRawItems] = useState<ShngmManga[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // stable toggle helpers
  const makeToggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    useCallback(
      (v: string) =>
        setter((prev) =>
          prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
        ),
      [],
    );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleGenre = useCallback(
    (v: string) =>
      setSelectedGenres((p) =>
        p.includes(v) ? p.filter((x) => x !== v) : [...p, v],
      ),
    [],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toggleType = useCallback(
    (v: string) =>
      setSelectedTypes((p) =>
        p.includes(v) ? p.filter((x) => x !== v) : [...p, v],
      ),
    [],
  );

  const clearAll = useCallback(() => {
    setSelectedGenres([]);
    setSelectedTypes([]);
    setSelectedFormat(undefined);
    setSelectedStatus(undefined);
  }, []);

  // fetch
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    // Don't clear rawItems here immediately to avoid full blank screen on every keystroke,
    // let the loading state handle the UI, or you can clear it if you want.
    
    const timer = setTimeout(() => {
      setLoading(true);
      getMangaListByType({
        page: 1,
        pageSize: 48,
        query: searchQuery || undefined,
        format: selectedFormat as any,
        status: selectedStatus as any,
        genre:
          selectedGenres.length > 0
            ? selectedGenres[0].toLowerCase()
            : undefined, // API accepts 1 genre max currently
        sort: sortBy === "latest" ? "latest" : undefined,
        sortOrder: "desc",
      })
        .then((res) => {
          setRawItems(res.data);
          setHasMore(res.data.length >= 48);
        })
        .catch((err) => console.log("fetch error:", err))
        .finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedFormat, selectedStatus, selectedGenres, sortBy]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    
    getMangaListByType({
      page: nextPage,
      pageSize: 20, // Load 20 on subsequent scrolls
      query: searchQuery || undefined,
      format: selectedFormat as any,
      status: selectedStatus as any,
      genre:
        selectedGenres.length > 0
          ? selectedGenres[0].toLowerCase()
          : undefined,
      sort: sortBy === "latest" ? "latest" : undefined,
      sortOrder: "desc",
    })
      .then((res) => {
        if (res.data.length > 0) {
          setRawItems((prev) => {
            // merge unique to prevent duplicates if API is weird
            const map = new Map<string, ShngmManga>();
            for (const it of prev) map.set(it.manga_id, it);
            for (const it of res.data) map.set(it.manga_id, it);
            return Array.from(map.values());
          });
          setPage(nextPage);
        }
        setHasMore(res.data.length >= 20);
      })
      .catch((err) => console.log("loadMore error:", err))
      .finally(() => setLoadingMore(false));
  }, [page, hasMore, loading, loadingMore, searchQuery, selectedFormat, selectedStatus, selectedGenres, sortBy]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    getMangaListByType({
      page: 1,
      pageSize: 48,
      query: searchQuery || undefined,
      format: selectedFormat as any,
      status: selectedStatus as any,
      genre:
        selectedGenres.length > 0 ? selectedGenres[0].toLowerCase() : undefined,
      sort: sortBy === "latest" ? "latest" : undefined,
      sortOrder: "desc",
    })
      .then((res) => {
        setRawItems(res.data);
        setHasMore(res.data.length >= 48);
      })
      .catch((err) => console.log("refresh error:", err))
      .finally(() => setRefreshing(false));
  }, [searchQuery, selectedFormat, selectedStatus, selectedGenres, sortBy]);

  // derived: sort client-side
  const items = useMemo(() => sortItems(rawItems, sortBy), [rawItems, sortBy]);

  const groupedData = useMemo(() => {
    if (columns === 1) {
      return items.map((item) => ({ id: item.manga_id, items: [item] }));
    }
    const result = [];
    for (let i = 0; i < items.length; i += columns) {
      result.push({
        id: `row-${i}`,
        items: items.slice(i, i + columns),
      });
    }
    return result;
  }, [items, columns]);

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Terbaru";

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      {/* ── Top Bar ──────────────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 10,
        }}
      >
        {!isDesktop && (
          <Pressable
            onPress={() => setIsSidebarOpenMobile(true)}
            style={{
              padding: 8,
              backgroundColor: colors.card,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </Pressable>
        )}

        {/* Search */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44, // Fixed height to prevent vertical stretching
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={18} color={colors.subtext} />
          <TextInput
            placeholder="Cari komik..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              setTimeout(() => setIsSearchFocused(false), 200);
            }}
            multiline={false}
            numberOfLines={1}
            returnKeyType="search"
            style={{
              flex: 1,
              marginLeft: 10,
              color: colors.text,
              fontSize: 15,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(""); setIsSearchFocused(false); }}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </Pressable>
          )}
        </View>

        {/* Grid/List toggle */}
        <Pressable
          onPress={() => setIsGridView((v) => !v)}
          style={{
            padding: 8,
            backgroundColor: colors.card,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name={isGridView ? "grid-outline" : "list-outline"}
            size={20}
            color={colors.text}
          />
        </Pressable>

        {/* Sort button — uses Modal so it's never clipped */}
        <Pressable
          onPress={() => setIsSortOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.card,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={16}
            color={colors.subtext}
          />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {currentSortLabel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.subtext} />
        </Pressable>
      </View>

      {/* Suggestion Dropdown */}
      {isSearchFocused && searchQuery.trim().length > 0 && (
        <View
          style={{
            position: "absolute",
            top: 70 + insets.top, // Adjust top using insets.top
            left: !isDesktop ? 54 : 12,
            right: !isDesktop ? 12 : 150,
            backgroundColor: colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: 300,
            zIndex: 999,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 10,
            overflow: "hidden"
          }}
        >
          {loading ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.subtext }}>Mencari...</Text>
            </View>
          ) : (() => {
            const lowerQuery = searchQuery.trim().toLowerCase();
            const suggestionItems = items.filter((item) => 
              item.title.toLowerCase().includes(lowerQuery) || 
              (item.alternative_title && item.alternative_title.toLowerCase().includes(lowerQuery))
            ).slice(0, 5);

            if (suggestionItems.length === 0) {
              return (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.subtext }}>Tidak ada hasil.</Text>
                </View>
              );
            }
            return (
              <FlatList
                data={suggestionItems}
              keyExtractor={(item) => item.manga_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setIsSearchFocused(false);
                    router.push({
                      pathname: "/manga/[mangaId]",
                      params: {
                        mangaId: item.manga_id,
                        title: item.title,
                        coverUrl: item.cover_portrait_url || item.cover_image_url,
                      },
                    });
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    padding: 12,
                    alignItems: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? colors.border : "transparent"
                  })}
                >
                  <Ionicons name="search-outline" size={16} color={colors.subtext} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
            );
          })()}
        </View>
      )}

      {/* ── Horizontal Filter Bar ────────────────────────── */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 12, gap: 8, alignItems: "center" }}
        >
          {/* Format */}
          <Pressable
            onPress={() => setSelectedFormat(undefined)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: !selectedFormat ? colors.button : colors.chip,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: !selectedFormat ? colors.buttonText : colors.subtext,
                fontWeight: !selectedFormat ? "800" : "600",
                fontSize: 12,
              }}
            >
              Semua
            </Text>
          </Pressable>
          {["Manhwa", "Manga", "Manhua"].map((f) => (
            <Pressable
              key={f}
              onPress={() => setSelectedFormat(f.toLowerCase())}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor:
                  selectedFormat === f.toLowerCase()
                    ? colors.button
                    : colors.chip,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color:
                    selectedFormat === f.toLowerCase()
                      ? colors.buttonText
                      : colors.subtext,
                  fontWeight:
                    selectedFormat === f.toLowerCase() ? "800" : "600",
                  fontSize: 12,
                }}
              >
                {f}
              </Text>
            </Pressable>
          ))}
          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: colors.border,
              marginHorizontal: 4,
            }}
          />
          {/* Status */}
          {[
            { label: "Ongoing", value: "ongoing" },
            { label: "Completed", value: "completed" },
          ].map((s) => (
            <Pressable
              key={s.value}
              onPress={() =>
                setSelectedStatus(
                  selectedStatus === s.value ? undefined : s.value,
                )
              }
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor:
                  selectedStatus === s.value ? colors.button : colors.chip,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color:
                    selectedStatus === s.value
                      ? colors.buttonText
                      : colors.subtext,
                  fontWeight: selectedStatus === s.value ? "800" : "600",
                  fontSize: 12,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Sort Modal Dropdown */}
      <SortDropdown
        visible={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        sortBy={sortBy}
        onSelect={setSortBy}
        colors={colors}
      />

      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* ── Sidebar Desktop ──────────────────────────── */}
        {isDesktop && (
          <View
            style={{
              width: 260,
              backgroundColor: colors.sidebar,
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }}
          >
            <SidebarContent
              colors={colors}
              selectedGenres={selectedGenres}
              selectedTypes={selectedTypes}
              onToggleGenre={toggleGenre}
              onToggleType={toggleType}
              onClearAll={clearAll}
            />
          </View>
        )}

        {/* ── Sidebar Mobile Overlay ───────────────────── */}
        {!isDesktop && isSidebarOpenMobile && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              flexDirection: "row",
            }}
          >
            <View
              style={{
                width: 300,
                backgroundColor: colors.sidebar,
                height: "100%",
                shadowColor: "#000",
                shadowOpacity: 0.5,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: "900",
                  }}
                >
                  Filter
                </Text>
                <Pressable
                  onPress={() => setIsSidebarOpenMobile(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <SidebarContent
                colors={colors}
                selectedGenres={selectedGenres}
                selectedTypes={selectedTypes}
                onToggleGenre={toggleGenre}
                onToggleType={toggleType}
                onClearAll={clearAll}
              />
            </View>
            <Pressable
              style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
              onPress={() => setIsSidebarOpenMobile(false)}
            />
          </View>
        )}

        {/* ── Main Content ──────────────────────────────── */}
        <View style={{ flex: 1 }}>
          <View
            style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
          >
            <Text
              style={{ color: colors.subtext, fontSize: 13, fontWeight: "700" }}
            >
              {items.length} hasil ditemukan
            </Text>
          </View>
          <FlatList
            data={groupedData}
            keyExtractor={(row) => row.id}
            contentContainerStyle={{
              padding: isGridView ? 14 : 12,
              gap: isGridView ? 14 : 0,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDark ? "#F2F2F7" : "#1E2329"}
                colors={[isDark ? "#F2F2F7" : "#1E2329"]}
              />
            }
            onEndReachedThreshold={0.5}
            onEndReached={loadMore}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color={colors.subtext} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              loading ? (
                <View style={{ paddingTop: 16 }}>
                  {isGridView ? <MangaGridSkeleton columns={columns} /> : <MangaListSkeleton />}
                </View>
              ) : (
                <View style={{ padding: 48, alignItems: "center", gap: 8 }}>
                  <Ionicons
                    name="search-outline"
                    size={40}
                    color={colors.subtext}
                  />
                  <Text style={{ color: colors.subtext }}>
                    Tidak ada komik ditemukan.
                  </Text>
                </View>
              )
            }
            renderItem={({ item: row }) => (
              <View style={{ flexDirection: "row", gap: isGridView ? 14 : 0 }}>
                {row.items.map((item) => (
                  <MangaCard
                    key={item.manga_id}
                    item={item}
                    colors={colors}
                    isGrid={isGridView}
                  />
                ))}
                {isGridView &&
                  Array.from({ length: columns - row.items.length }).map(
                    (_, i) => <View key={`empty-${i}`} style={{ flex: 1 }} />,
                  )}
              </View>
            )}
          />
        </View>
      </View>
      
      {/* Floating Refresh Button */}
      <Pressable
        onPress={onRefresh}
        style={({ pressed }) => ({
          position: "absolute",
          bottom: 24, // pastikan di atas bottom bar
          right: 24,
          backgroundColor: colors.primary,
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 6,
          opacity: pressed || refreshing ? 0.8 : 1,
          zIndex: 100,
        })}
      >
        <Ionicons name="refresh" size={24} color={isDark ? "#111" : "#fff"} />
      </Pressable>
    </View>
  );
}
