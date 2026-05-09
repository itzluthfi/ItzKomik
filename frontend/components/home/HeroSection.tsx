import type { ShngmManga } from "@/src/api/shngmTypes";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Image, Pressable, View } from "react-native";
import { Text } from "@/components/ui/app-text";

type Props = {
  items: ShngmManga[];
};

export default function HeroSection({ items }: Props) {
  const router = useRouter();
  const toMangaParams = React.useCallback((item: ShngmManga) => ({
    mangaId: item.manga_id,
    title: item.title,
    description: item.description,
    coverUrl: item.cover_image_url || item.cover_portrait_url || "",
    countryId: item.country_id,
    userRate: String(item.user_rate ?? ""),
  }), []);

  if (items.length === 0) return null;

  return (
    <View style={{ paddingVertical: 8 }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(i) => i.manga_id}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/manga/[mangaId]",
                params: toMangaParams(item),
              })
            }
          >
            <Image
              source={{ uri: item.cover_image_url }}
              style={{
                width: 280,
                height: 160,
                borderRadius: 18,
                backgroundColor: "#000",
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                position: "absolute",
                bottom: 10,
                left: 12,
                right: 12,
                color: "#FFF",
                fontWeight: "900",
              }}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
