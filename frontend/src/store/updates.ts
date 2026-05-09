import {
  apiGetPendingUpdates,
  apiCheckUpdate,
  apiDismissUpdate,
  apiClearUpdates,
  KomikamAuthError,
  type ApiPendingUpdate,
} from "@/src/api/komikamApi";
import type { BookmarkItem } from "@/src/store/bookmarks";
import { getChapterList } from "@/src/api/shngmClient";

export type UpdateEntry = {
  mangaId: string;
  title: string;
  coverUrl: string;
  chapterId: string;
  chapterNumber: number;
  detectedAt: number; // epoch ms
};

function fromApi(item: ApiPendingUpdate): UpdateEntry {
  return {
    mangaId:       item.manga_id,
    title:         item.title,
    coverUrl:      item.cover_url,
    chapterId:     item.pending_chapter_id,
    chapterNumber: item.pending_chapter_number,
    detectedAt:    new Date(item.detected_at).getTime(),
  };
}

export async function getPendingUpdates(): Promise<UpdateEntry[]> {
  try {
    const items = await apiGetPendingUpdates();
    return items.map(fromApi);
  } catch (e) {
    if (e instanceof KomikamAuthError) return [];
    throw e;
  }
}

export async function clearPendingUpdates(): Promise<void> {
  await apiClearUpdates();
}

export async function removePendingUpdate(mangaId: string): Promise<void> {
  await apiDismissUpdate(mangaId);
}

function pickLatestChapter(items: {
  chapter_id: string;
  chapter_number?: number | null;
}[]): { chapterId: string; chapterNumber: number } | null {
  if (items.length === 0) return null;
  let best = items[0];
  for (const it of items) {
    const num = typeof it.chapter_number === "number" ? it.chapter_number : 0;
    const bestNum = typeof best.chapter_number === "number" ? best.chapter_number : 0;
    if (num > bestNum) best = it;
  }
  return {
    chapterId: best.chapter_id,
    chapterNumber: typeof best.chapter_number === "number" ? best.chapter_number : 0,
  };
}

export async function checkUpdatesForBookmarks(
  bookmarks: BookmarkItem[],
): Promise<{ updates: UpdateEntry[]; checked: number }> {
  const detected: UpdateEntry[] = [];

  for (const bm of bookmarks) {
    try {
      const res = await getChapterList({
        mangaId: bm.mangaId,
        page: 1,
        pageSize: 10,
        cacheMode: "no-cache",
      });

      const latest = pickLatestChapter(res.data);
      if (!latest) continue;

      const result = await apiCheckUpdate({
        manga_id:       bm.mangaId,
        title:          bm.title,
        cover_url:      bm.coverUrl,
        chapter_id:     latest.chapterId,
        chapter_number: latest.chapterNumber,
      });

      if (result.has_new_chapter) {
        detected.push({
          mangaId:       bm.mangaId,
          title:         bm.title,
          coverUrl:      bm.coverUrl,
          chapterId:     latest.chapterId,
          chapterNumber: latest.chapterNumber,
          detectedAt:    Date.now(),
        });
        
        // Coba jadwalkan notifikasi lokal
        try {
          const { scheduleUpdateNotification } = await import('@/src/utils/notifications');
          await scheduleUpdateNotification(
            'Chapter Baru Tersedia! 🎉',
            `${bm.title} - Chapter ${latest.chapterNumber} sudah rilis.`,
            { mangaId: bm.mangaId, chapterId: latest.chapterId }
          );
        } catch (err) {
          // Abaikan jika notifikasi gagal atau belum diizinkan
        }
      }
    } catch {
      // Gagal cek 1 manga — skip, lanjut manga berikutnya
    }
  }

  return { updates: detected, checked: bookmarks.length };
}
