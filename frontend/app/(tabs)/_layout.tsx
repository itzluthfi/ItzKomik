// Patch untuk: Cannot read properties of null (reading 'dispatchEvent')
// Terjadi di Expo Router saat History.pushState dipanggil di Android web mode
if (typeof window !== "undefined" && window.history) {
  const originalPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args) {
    try {
      originalPushState(...args);
    } catch (e) {
      // Abaikan error dispatchEvent null — route tetap jalan
    }
  };

  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.replaceState = function (...args) {
    try {
      originalReplaceState(...args);
    } catch (e) {
      // Sama untuk replaceState
    }
  };
}

import { Tabs } from "expo-router";
import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "@/src/theme/ThemeContext";

export default function TabsLayout() {
  const { resolved } = useAppTheme();
  const isDark = resolved === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#0B0B0E" : "#F6F1E9",
          borderTopColor: isDark ? "#242434" : "#E6DED2",
        },
        tabBarActiveTintColor: isDark ? "#F2F2F7" : "#1E2329",
        tabBarInactiveTintColor: isDark ? "#B3B3C2" : "#8A8076",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} color={color} size={size + 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "library" : "library-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Akun",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />

    </Tabs>
  );
}
