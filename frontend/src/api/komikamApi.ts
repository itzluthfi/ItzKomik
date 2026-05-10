/**
 * komikamApi.ts
 * HTTP client untuk berkomunikasi dengan Komikam Laravel Backend API.
 * Base URL dipilih otomatis berdasarkan platform jika EXPO_PUBLIC_KOMIKAM_API_URL tidak di-set.
 */

import { Platform } from "react-native";
import { getToken } from "@/src/store/authToken";

/**
 * Pilih URL yang tepat:
 * - Jika EXPO_PUBLIC_KOMIKAM_API_URL di-set di .env.local → pakai itu
 * - Web / iOS Simulator        → http://localhost:8000
 * - Android Emulator           → http://10.0.2.2:8000
 * - Physical device            → set EXPO_PUBLIC_KOMIKAM_API_URL ke IP LAN komputer kamu
 */
function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_KOMIKAM_API_URL;
  if (envUrl) return `${envUrl}/api`;

  if (Platform.OS === "android") return "http://10.0.2.2:8000/api";
  return "http://localhost:8000/api"; // web & iOS simulator
}

const BASE_URL = getBaseUrl();

export class KomikamApiError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Dilempar saat user belum login (tidak ada token). Bisa ditangkap store untuk silent fallback. */
export class KomikamAuthError extends KomikamApiError {
  constructor() {
    super(401, "Belum login.");
    this.name = "KomikamAuthError";
  }
}

// ─── Internal fetch helper ──────────────────────────────────────────────────

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
  };

  if (requireAuth) {
    const token = await getToken();
    if (!token) throw new KomikamAuthError();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg: string =
      (json as { message?: string }).message ?? `HTTP ${res.status}`;
    
    // LOG DEBUG: Cetak detail error ke terminal untuk analisa
    console.log(`[API ERROR] ${method} ${path} -> Status: ${res.status}, Message: ${msg}`);
    if (res.status === 403) {
      console.log("[DEBUG 403] Isi response body:", JSON.stringify(json));
    }

    throw new KomikamApiError(res.status, msg);
  }

  return json as T;
}

// ─── AUTH ──────────────────────────────────────────────────────────────────

export type AuthResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    created_at: string;
  };
};

export async function apiRegister(data: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("POST", "/auth/register", data, false);
}

export async function apiLogin(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("POST", "/auth/login", data, false);
}

export async function apiLogout(): Promise<void> {
  await request("POST", "/auth/logout");
}

export async function apiMe(): Promise<AuthResponse["user"]> {
  return request("GET", "/auth/me");
}

// ─── HISTORY ───────────────────────────────────────────────────────────────

export type ApiHistory = {
  manga_id: string;
  chapter_id: string;
  chapter_number: number;
  page_index: number;
  total_pages: number;
  manga_title: string | null;
  cover_url: string | null;
  updated_at: string;
};

export async function apiGetHistory(): Promise<ApiHistory[]> {
  return request("GET", "/history");
}

export async function apiUpsertHistory(
  mangaId: string,
  data: Omit<ApiHistory, "manga_id" | "updated_at">,
): Promise<ApiHistory> {
  return request("PUT", `/history/${encodeURIComponent(mangaId)}`, data as Record<string, unknown>);
}

export async function apiDeleteHistory(mangaId: string): Promise<void> {
  await request("DELETE", `/history/${encodeURIComponent(mangaId)}`);
}

export async function apiClearHistory(): Promise<void> {
  await request("DELETE", "/history");
}

// ─── BOOKMARKS ─────────────────────────────────────────────────────────────

export type ApiBookmark = {
  manga_id: string;
  title: string;
  cover_url: string;
  created_at: string;
};

export async function apiGetBookmarks(): Promise<ApiBookmark[]> {
  return request("GET", "/bookmarks");
}

export async function apiCheckBookmark(
  mangaId: string,
): Promise<{ bookmarked: boolean }> {
  return request("GET", `/bookmarks/${encodeURIComponent(mangaId)}`);
}

export async function apiToggleBookmark(data: {
  manga_id: string;
  title: string;
  cover_url: string;
}): Promise<{ bookmarked: boolean; message: string }> {
  return request("POST", "/bookmarks", data as Record<string, unknown>);
}

export async function apiDeleteBookmark(mangaId: string): Promise<void> {
  await request("DELETE", `/bookmarks/${encodeURIComponent(mangaId)}`);
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────

export type ApiSettings = {
  reader_image_quality?: "high" | "low";
  reader_bg?: "black" | "dark" | "white";
  theme_mode?: "light" | "dark" | "system";
};

export async function apiGetSettings(): Promise<ApiSettings> {
  return request("GET", "/settings");
}

export async function apiUpdateSettings(data: ApiSettings): Promise<ApiSettings> {
  return request("PATCH", "/settings", data as Record<string, unknown>);
}

// ─── UPDATES ───────────────────────────────────────────────────────────────

export type ApiPendingUpdate = {
  manga_id: string;
  title: string;
  cover_url: string;
  pending_chapter_id: string;
  pending_chapter_number: number;
  detected_at: string;
};

export async function apiGetPendingUpdates(): Promise<ApiPendingUpdate[]> {
  return request("GET", "/updates/pending");
}

export async function apiCheckUpdate(data: {
  manga_id: string;
  title: string;
  cover_url: string;
  chapter_id: string;
  chapter_number: number;
}): Promise<{ has_new_chapter: boolean; manga_id: string }> {
  return request("POST", "/updates/check", data as Record<string, unknown>);
}

export async function apiDismissUpdate(mangaId: string): Promise<void> {
  await request("DELETE", `/updates/${encodeURIComponent(mangaId)}`);
}

export async function apiClearUpdates(): Promise<void> {
  await request("DELETE", "/updates");
}
