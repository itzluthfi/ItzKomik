import type { ShngmManga } from "@/src/api/shngmTypes";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/ui/app-text";

type Props = {
  item: ShngmManga;
  isDark: boolean;
};

export default function LatestSection({ item, isDark }: Props) {
  const router = useRouter();
  const toMangaParams = React.useCallback((manga: ShngmManga) => ({
    mangaId: manga.manga_id,
    title: manga.title,
    description: manga.description,
    coverUrl: manga.cover_portrait_url || manga.cover_image_url || "",
    countryId: manga.country_id,
    userRate: String(manga.user_rate ?? ""),
  }), []);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/manga/[mangaId]",
          params: toMangaParams(item),
        })
      }
      style={{ marginBottom: 12 }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          padding: 12,
          borderRadius: 16,
          backgroundColor: isDark ? "#121218" : "#FBF6EE",
          borderWidth: 1,
          borderColor: isDark ? "#242434" : "#E6DED2",
        }}
      >
        <Image
          source={{ uri: item.cover_portrait_url }}
          style={{
            width: 72,
            height: 96,
            borderRadius: 14,
            backgroundColor: "#000",
          }}
        />

        <View style={{ flex: 1, gap: 6 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: isDark ? "#F2F2F7" : "#1E2329",
            }}
          >
            {item.title}
          </Text>

          <Text
            numberOfLines={2}
            style={{ color: isDark ? "#B3B3C2" : "#6A625A" }}
          >
            {item.description}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
