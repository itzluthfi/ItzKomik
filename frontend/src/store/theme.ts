import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "komik:theme:v1";

export type ThemeMode = "light" | "dark" | "system";

export async function getThemeMode(): Promise<ThemeMode> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
