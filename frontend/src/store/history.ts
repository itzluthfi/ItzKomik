import {
  apiGetHistory,
  apiUpsertHistory,
  apiDeleteHistory,
  apiClearHistory,
  KomikamAuthError,
  type ApiHistory,
} from "@/src/api/komikamApi";

export type ReadingProgress = {
  mangaId: string;
  chapterId: string;
  chapterNumber: number;
  pageIndex: number;
  totalPages: number;
  updatedAt: number; // epoch ms (converted from API string)
  mangaTitle?: string;
  coverUrl?: string;
};

function fromApi(item: ApiHistory): ReadingProgress {
  return {
    mangaId:       item.manga_id,
    chapterId:     item.chapter_id,
    chapterNumber: item.chapter_number,
    pageIndex:     item.page_index,
    totalPages:    item.total_pages,
    updatedAt:     new Date(item.updated_at).getTime(),
    mangaTitle:    item.manga_title ?? undefined,
    coverUrl:      item.cover_url ?? undefined,
  };
}

export async function upsertProgress(p: ReadingProgress): Promise<void> {
  await apiUpsertHistory(p.mangaId, {
    chapter_id:     p.chapterId,
    chapter_number: p.chapterNumber,
    page_index:     p.pageIndex,
    total_pages:    p.totalPages,
    manga_title:    p.mangaTitle ?? null,
    cover_url:      p.coverUrl ?? null,
  });
}

export async function getAllHistory(limit?: number): Promise<ReadingProgress[]> {
  try {
    const items = await apiGetHistory();
    const mapped = items.map(fromApi);
    return typeof limit === "number" ? mapped.slice(0, limit) : mapped;
  } catch (e) {
    if (e instanceof KomikamAuthError) return []; // belum login = kosong, bukan error
    throw e;
  }
}

export async function getAllProgress(): Promise<ReadingProgress[]> {
  try {
    return getAllHistory();
  } catch (e) {
    if (e instanceof KomikamAuthError) return [];
    throw e;
  }
}

export async function getLatestProgressByManga(
  mangaId: string,
): Promise<ReadingProgress | null> {
  try {
    const all = await getAllHistory();
    return all.find((x) => x.mangaId === mangaId) ?? null;
  } catch (e) {
    if (e instanceof KomikamAuthError) return null;
    throw e;
  }
}

export async function clearHistory(): Promise<void> {
  await apiClearHistory();
}

export async function replaceHistory(items: ReadingProgress[]): Promise<void> {
  // Gunakan satu per satu upsert karena tidak ada bulk endpoint
  await apiClearHistory();
  for (const item of items) {
    await upsertProgress(item);
  }
}

import AsyncStorage from "@react-native-async-storage/async-storage";

const READ_CHAPTERS_KEY = "read_chapters:";

export async function markChapterAsReadLocal(mangaId: string, chapterId: string): Promise<void> {
  try {
    const key = READ_CHAPTERS_KEY + mangaId;
    const existing = await AsyncStorage.getItem(key);
    const list: string[] = existing ? JSON.parse(existing) : [];
    if (!list.includes(chapterId)) {
      list.push(chapterId);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    console.error("Failed to save read chapter", e);
  }
}

export async function getReadChaptersLocal(mangaId: string): Promise<string[]> {
  try {
    const key = READ_CHAPTERS_KEY + mangaId;
    const existing = await AsyncStorage.getItem(key);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error("Failed to get read chapters", e);
    return [];
  }
}
