import {
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
    useFonts,
} from "@expo-google-fonts/poppins";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "react-native-reanimated";
import { LogBox } from "react-native";

// Abaikan error merah dari expo-notifications di Expo Go
LogBox.ignoreLogs(["expo-notifications: Android Push notifications"]);

import { AppThemeProvider, useAppTheme } from "../src/theme/ThemeContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { resolved } = useAppTheme();

  return (
    <ThemeProvider value={resolved === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="manga/[mangaId]" />
        <Stack.Screen name="reader/[chapterId]" />
      </Stack>

      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
      // Minta izin notifikasi saat aplikasi dibuka
      void import('@/src/utils/notifications').then((module) => {
        module.requestNotificationPermissions();
      });
      // Daftarkan task background check updates
      void import('@/src/utils/backgroundTasks').then((module) => {
        module.registerBackgroundFetchAsync().catch(() => {});
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
