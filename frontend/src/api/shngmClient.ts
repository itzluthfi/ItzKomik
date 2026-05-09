import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  ShngmChapterDetailResponse,
  ShngmChapterListResponse,
  ShngmMangaDetailResponse,
  ShngmMangaListResponse,
} from "./shngmTypes";

const BASE_URL = "https://api.shngm.io";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;
const DEFAULT_CACHE_TTL_MS = 60_000;
const LIST_CACHE_TTL_MS = 5 * 60_000;
const CHAPTER_CACHE_TTL_MS = 2 * 60_000;
const CACHE_PREFIX = "api-cache:v1:";

type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  cacheMode?: "default" | "force" | "no-cache";
};

type CacheEntry<T> = { expiresAt: number; data: T };
type PersistentCacheEntry<T> = { savedAt: number; ttlMs: number; data: T };

const responseCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number) {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function getPersistentCached<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistentCacheEntry<T>;
    const age = Date.now() - parsed.savedAt;
    if (age > parsed.ttlMs) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data;
  } catch {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  }
}

async function setPersistentCached<T>(key: string, data: T, ttlMs: number) {
  const payload: PersistentCacheEntry<T> = { savedAt: Date.now(), ttlMs, data };
  await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(payload));
}

export async function invalidateListCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const targets = keys.filter((k) =>
    k.startsWith(CACHE_PREFIX + BASE_URL + "/v1/manga/list"),
  );
  if (targets.length > 0) {
    await AsyncStorage.multiRemove(targets);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const cacheMode = options?.cacheMode ?? "default";

  if (cacheMode !== "no-cache" && cacheTtlMs > 0) {
    const cached = getCached<T>(url);
    if (cached) return cached;
    if (cacheMode !== "force") {
      const persisted = await getPersistentCached<T>(url);
      if (persisted) {
        setCached(url, persisted, cacheTtlMs);
        return persisted;
      }
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (attempt < retries && isRetryableStatus(res.status)) {
          const backoff = 300 * Math.pow(2, attempt);
          await sleep(backoff);
          continue;
        }
        throw new ApiError(res.status, text || `HTTP ${res.status}`);
      }

      const json = (await res.json()) as T;

      if (cacheMode !== "no-cache" && cacheTtlMs > 0) {
        setCached(url, json, cacheTtlMs);
        await setPersistentCached(url, json, cacheTtlMs);
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNetwork = err instanceof TypeError;
      const retryable = isAbort || isNetwork;

      if (attempt < retries && retryable) {
        const backoff = 300 * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown error");
}

export type MangaFormat = "manhwa" | "manga" | "manhua";

export type FeedType = "project" | "mirror";

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export type MangaListParams = {
  type?: "project" | "mirror";
  page: number;
  pageSize: number;
  isUpdate?: boolean;
  sort?: "latest";
  sortOrder?: "asc" | "desc";
  query?: string;
  format?: "manhwa" | "manga" | "manhua";
  status?: "1" | "2";
  genre?: string;
};

function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function getRecommendedByFormat(
  format: MangaFormat,
  options?: { cacheMode?: FetchOptions["cacheMode"] },
): Promise<ShngmMangaListResponse> {
  const qs = new URLSearchParams();
  qs.set("format", format);
  qs.set("page", "1");
  qs.set("page_size", "10");
  qs.set("is_recommended", "true");
  qs.set("sort", "latest");
  qs.set("sort_order", "desc");

  const url = `${BASE_URL}/v1/manga/list?${qs.toString()}`;
  const json = await fetchJson<ShngmMangaListResponse>(url, {
    cacheTtlMs: LIST_CACHE_TTL_MS,
    cacheMode: options?.cacheMode,
  });
  if (json.retcode !== 0) throw new ApiError(200, json.message || "API error");
  return json;
}

export async function getMangaListByType(
  params: MangaListParams,
  options?: { cacheMode?: FetchOptions["cacheMode"] },
): Promise<ShngmMangaListResponse> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.pageSize));
  if (params.isUpdate) qs.set("is_update", "true");
  if (params.sort) qs.set("sort", params.sort);
  if (params.sortOrder) qs.set("sort_order", params.sortOrder);
  if (params.query) qs.set("query", params.query);
  if (params.format) qs.set("format", params.format);
  if (params.status) qs.set("status", params.status);
  if (params.genre) qs.set("genre", params.genre);

  const url = `${BASE_URL}/v1/manga/list?${qs.toString()}`;
  const json = await fetchJson<ShngmMangaListResponse>(url, {
    cacheTtlMs: LIST_CACHE_TTL_MS,
    cacheMode: options?.cacheMode,
  });
  if (json.retcode !== 0) throw new ApiError(200, json.message || "API error");
  return json;
}

export async function getMangaList(input?: {
  page?: number;
  pageSize?: number;
  cacheMode?: FetchOptions["cacheMode"];
}): Promise<ShngmMangaListResponse> {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 12;

  const url = `${BASE_URL}/v1/manga/list${toQuery({ page, page_size: pageSize })}`;

  const json = await fetchJson<ShngmMangaListResponse>(url, {
    cacheTtlMs: LIST_CACHE_TTL_MS,
    cacheMode: input?.cacheMode,
  });

  // validasi ringan
  if (json.retcode !== 0) {
    throw new ApiError(200, json.message || "API retcode not 0");
  }
  //console.log(json);
  return json;
}
export async function getChapterList(input: {
  mangaId: string;
  page?: number;
  pageSize?: number;
  cacheMode?: FetchOptions["cacheMode"];
}): Promise<ShngmChapterListResponse> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;

  const url =
    `${BASE_URL}/v1/chapter/${encodeURIComponent(input.mangaId)}/list` +
    toQuery({ page, page_size: pageSize });
  const json = await fetchJson<ShngmChapterListResponse>(url, {
    cacheTtlMs: CHAPTER_CACHE_TTL_MS,
    cacheMode: input.cacheMode,
  });
  if (json.retcode !== 0)
    throw new ApiError(200, json.message || "API retcode not 0");

  return json;
}

export async function getChapterDetail(
  chapterId: string,
): Promise<ShngmChapterDetailResponse> {
  const url = `${BASE_URL}/v1/chapter/detail/${encodeURIComponent(chapterId)}`;
  const json = await fetchJson<ShngmChapterDetailResponse>(url, {
    cacheTtlMs: CHAPTER_CACHE_TTL_MS,
  });
  if (json.retcode !== 0)
    throw new ApiError(200, json.message || "API retcode not 0");

  return json;
}

export async function getMangaDetail(
  mangaId: string,
  options?: { cacheMode?: FetchOptions["cacheMode"] },
): Promise<ShngmMangaDetailResponse> {
  const url = `${BASE_URL}/v1/manga/detail/${encodeURIComponent(mangaId)}`;
  const json = await fetchJson<ShngmMangaDetailResponse>(url, {
    cacheTtlMs: LIST_CACHE_TTL_MS,
    cacheMode: options?.cacheMode,
  });
  if (json.retcode !== 0)
    throw new ApiError(200, json.message || "API retcode not 0");

  return json;
}
