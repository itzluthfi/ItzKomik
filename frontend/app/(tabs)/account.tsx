import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/app-text";
import { useAppTheme } from "@/src/theme/ThemeContext";
import {
  getProfile,
  signIn,
  register,
  signOut,
  refreshProfile,
  type AccountProfile,
} from "@/src/store/account";
import {
  getReaderSettings,
  setReaderSettings,
  type ReaderSettings,
} from "@/src/store/readerSettings";
import { KomikamApiError } from "@/src/api/komikamApi";

type AuthMode = "login" | "register";

function formatTime(ts?: string | number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID");
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { resolved, setMode, mode } = useAppTheme();
  const isDark = resolved === "dark";

  const colors = React.useMemo(
    () => ({
      bg:          isDark ? "#0B0B0E" : "#F6F1E9",
      card:        isDark ? "#121218" : "#FBF6EE",
      text:        isDark ? "#F2F2F7" : "#1E2329",
      subtext:     isDark ? "#B3B3C2" : "#6A625A",
      border:      isDark ? "#242434" : "#E6DED2",
      chip:        isDark ? "#1A1A24" : "#EFE6DA",
      ghost:       isDark ? "#1A1A24" : "#F2E9DD",
      ghostText:   isDark ? "#F2F2F7" : "#1E2329",
      primary:     isDark ? "#F2F2F7" : "#1E2A3A",
      primaryText: isDark ? "#111111" : "#F7F2EA",
      danger:      isDark ? "#FF5C5C" : "#D32F2F",
      inputBg:     isDark ? "#121218" : "#FBF6EE",
      placeholder: isDark ? "#7E7E91" : "#9A8F83",
      accent:      isDark ? "#6C63FF" : "#3B30CC",
    }),
    [isDark]
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [profile, setProfile]   = React.useState<AccountProfile | null>(null);
  const [authMode, setAuthMode] = React.useState<AuthMode>("login");
  const [name, setName]         = React.useState("");
  const [email, setEmail]       = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading]   = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage]   = React.useState<{ text: string; isError: boolean } | null>(null);
  const [settings, setSettings] = React.useState<ReaderSettings>({
    imageQuality: "high",
    readerBg: "black",
  });

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([getProfile(), getReaderSettings()]);
    setProfile(p);
    setSettings(s);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showMessage = (text: string, isError = false) =>
    setMessage({ text, isError });

  const clearForm = () => {
    setName(""); setEmail(""); setPassword("");
  };

  const updateSetting = React.useCallback(
    async (partial: Partial<ReaderSettings>) => {
      const next = await setReaderSettings(partial);
      setSettings(next);
    },
    []
  );

  // ── Auth Handlers ─────────────────────────────────────────────────────────
  const handleAuth = React.useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      showMessage("Email dan password wajib diisi.", true);
      return;
    }
    if (authMode === "register" && !name.trim()) {
      showMessage("Nama wajib diisi untuk daftar.", true);
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const p =
        authMode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password })
          : await signIn({ email: email.trim(), password });

      setProfile(p);
      clearForm();
      showMessage(
        authMode === "register" ? "Akun berhasil dibuat!" : "Berhasil masuk!",
        false
      );
      // Load settings dari server setelah login
      const s = await getReaderSettings();
      setSettings(s);
    } catch (e) {
      const msg =
        e instanceof KomikamApiError
          ? e.message
          : e instanceof Error
          ? e.message
          : "Terjadi kesalahan.";
      showMessage(msg, true);
    } finally {
      setSubmitting(false);
    }
  }, [authMode, name, email, password]);

  const handleSignOut = React.useCallback(() => {
    const performSignOut = async () => {
      setSubmitting(true);
      try {
        await signOut();
        setProfile(null);
        showMessage("Berhasil keluar.", false);
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmOut = window.confirm("Kamu akan logout dari akun ini. Lanjutkan?");
      if (confirmOut) {
        void performSignOut();
      }
    } else {
      Alert.alert("Keluar akun?", "Kamu akan logout dari akun ini.", [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: performSignOut,
        },
      ]);
    }
  }, []);

  const handleRefresh = React.useCallback(async () => {
    setSubmitting(true);
    const p = await refreshProfile();
    if (p) {
      setProfile(p);
      showMessage("Profil diperbarui.", false);
    } else {
      showMessage("Gagal memuat profil dari server.", true);
    }
    setSubmitting(false);
  }, []);

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.subtext} />
        <Text style={{ marginTop: 8, color: colors.subtext }}>Memuat...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: insets.top + 12,
        gap: 12,
        paddingBottom: insets.bottom + 40,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>Akun</Text>

      {/* Message Banner */}
      {message ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: message.isError ? colors.danger : colors.border,
            backgroundColor: message.isError
              ? isDark ? "#2A0F0F" : "#FDECEA"
              : colors.card,
          }}
        >
          <Text style={{ color: message.isError ? colors.danger : colors.subtext }}>
            {message.text}
          </Text>
        </View>
      ) : null}

      {/* ── Belum Login ─────────────────────────────────────────────────── */}
      {!profile ? (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 16,
            gap: 12,
          }}
        >
          {/* Mode Toggle */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["login", "register"] as AuthMode[]).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => { setAuthMode(mode); setMessage(null); }}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: authMode === mode ? colors.accent : "transparent",
                  borderWidth: 1,
                  borderColor: authMode === mode ? colors.accent : colors.border,
                }}
              >
                <Text style={{ color: authMode === mode ? "#FFF" : colors.subtext, fontWeight: "700" }}>
                  {mode === "login" ? "Masuk" : "Daftar"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Name (Register only) */}
          {authMode === "register" && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>Nama</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nama kamu"
                placeholderTextColor={colors.placeholder}
                style={inputStyle(colors)}
              />
            </View>
          )}

          {/* Email */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.subtext, fontSize: 13 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@contoh.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle(colors)}
            />
          </View>

          {/* Password */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.subtext, fontSize: 13 }}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              style={inputStyle(colors)}
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleAuth}
            disabled={submitting}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 13,
              borderRadius: 12,
              alignItems: "center",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
              {submitting
                ? "Memproses..."
                : authMode === "login"
                ? "Masuk"
                : "Buat Akun"}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* ── Sudah Login ──────────────────────────────────────────────────── */
        <View style={{ gap: 10 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 4,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {profile.name}
            </Text>
            <Text style={{ color: colors.subtext }}>{profile.email}</Text>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>
              Bergabung: {formatTime(profile.created_at)}
            </Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            disabled={submitting}
            style={{
              backgroundColor: colors.ghost,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.ghostText, fontWeight: "700" }}>
              {submitting ? "Memuat..." : "Refresh Profil"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={{
              backgroundColor: colors.ghost,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: "900" }}>
              {submitting ? "Memproses..." : "Keluar akun"}
              </Text>
          </Pressable>
        </View>
      )}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

      {/* ── Pengaturan Tema Aplikasi ────────────────────────────────────────── */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
          Tema Aplikasi
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[
            { val: "system", label: "Otomatis", icon: "contrast-outline" },
            { val: "light", label: "Terang", icon: "sunny-outline" },
            { val: "dark", label: "Gelap", icon: "moon-outline" },
          ].map((t) => (
            <Pressable
              key={t.val}
              onPress={() => setMode(t.val as any)}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                backgroundColor: mode === t.val ? colors.text : colors.card,
                borderWidth: 1,
                borderColor: mode === t.val ? colors.text : colors.border,
                gap: 6,
              }}
            >
              <Ionicons
                name={t.icon as any}
                size={20}
                color={mode === t.val ? colors.bg : colors.subtext}
              />
              <Text
                style={{
                  color: mode === t.val ? colors.bg : colors.subtext,
                  fontWeight: mode === t.val ? "900" : "600",
                  fontSize: 12,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

      {/* ── Pengaturan Baca ───────────────────────────────────────────────── */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
          Pengaturan Baca
        </Text>

        {!profile && (
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            Login untuk menyimpan pengaturan ke akun.
          </Text>
        )}

        {/* Image Quality */}
        <View>
          <Text style={{ color: colors.subtext, fontWeight: "700", marginBottom: 10 }}>
            Kualitas Gambar
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["high", "low"] as const).map((q) => (
              <Pressable
                key={q}
                onPress={() => updateSetting({ imageQuality: q })}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: settings.imageQuality === q ? colors.text : colors.card,
                  borderWidth: 1,
                  borderColor: settings.imageQuality === q ? colors.text : colors.border,
                }}
              >
                <Text
                  style={{
                    color: settings.imageQuality === q ? colors.bg : colors.subtext,
                    fontWeight: settings.imageQuality === q ? "900" : "600",
                  }}
                >
                  {q === "high" ? "High (HQ)" : "Low (Data Saver)"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Reader Background */}
        <View>
          <Text style={{ color: colors.subtext, fontWeight: "700", marginBottom: 10 }}>
            Warna Latar Saat Membaca (Reader Background)
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { val: "black", label: "Hitam", color: "#000" },
              { val: "dark",  label: "Gelap", color: "#121218" },
              { val: "white", label: "Putih", color: "#FFF", txtColor: "#000" },
            ].map((bg) => (
              <Pressable
                key={bg.val}
                onPress={() => updateSetting({ readerBg: bg.val as ReaderSettings["readerBg"] })}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: bg.color,
                  borderWidth: 2,
                  borderColor:
                    settings.readerBg === bg.val
                      ? isDark ? "#4A90E2" : "#005bb5"
                      : "transparent",
                }}
              >
                <Text
                  style={{
                    color: bg.txtColor || "#FFF",
                    fontWeight: settings.readerBg === bg.val ? "900" : "600",
                  }}
                >
                  {bg.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function inputStyle(colors: Record<string, string>) {
  return {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  };
}
