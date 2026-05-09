import { useAppTheme } from "@/src/theme/ThemeContext";
import React from "react";
import { Pressable, TextInput, View } from "react-native";
import { Text } from "@/components/ui/app-text";
import { Poppins } from "@/constants/theme";

type Props = {
  query: string;
  onChangeQuery: (v: string) => void;
};

export default function HomeHeader({ query, onChangeQuery }: Props) {
  const { resolved, toggle } = useAppTheme();
  const isDark = resolved === "dark";

  const colors = {
    bg: isDark ? "#0B0B0E" : "#F6F1E9",
    card: isDark ? "#121218" : "#FBF6EE",
    text: isDark ? "#F2F2F7" : "#1E2329",
    subtext: isDark ? "#B3B3C2" : "#6A625A",
    border: isDark ? "#242434" : "#E6DED2",
  };

  return (
    <View style={{ padding: 12, gap: 12, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
          KOMIK
        </Text>

        <Pressable onPress={() => void toggle()}>
          <Text style={{ fontSize: 18 }}>
            {isDark ? "☀️" : "🌙"}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder="Cari komik…"
        placeholderTextColor={colors.subtext}
        style={{
          backgroundColor: colors.card,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
          color: colors.text,
          fontFamily: Poppins.regular,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    </View>
  );
}
