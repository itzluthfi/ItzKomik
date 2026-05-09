import {
  apiGetBookmarks,
  apiCheckBookmark,
  apiToggleBookmark,
  apiDeleteBookmark,
  KomikamAuthError,
  type ApiBookmark,
} from "@/src/api/komikamApi";

export type BookmarkItem = {
  mangaId: string;
  title: string;
  coverUrl: string;
  updatedAt: number; // epoch ms
};

function fromApi(item: ApiBookmark): BookmarkItem {
  return {
    mangaId:   item.manga_id,
    title:     item.title,
    coverUrl:  item.cover_url,
    updatedAt: new Date(item.created_at).getTime(),
  };
}

export async function getBookmarks(): Promise<BookmarkItem[]> {
  try {
    const items = await apiGetBookmarks();
    return items.map(fromApi);
  } catch (e) {
    if (e instanceof KomikamAuthError) return [];
    throw e;
  }
}

export async function isBookmarked(mangaId: string): Promise<boolean> {
  try {
    const res = await apiCheckBookmark(mangaId);
    return res.bookmarked;
  } catch (e) {
    if (e instanceof KomikamAuthError) return false;
    throw e;
  }
}

export async function addBookmark(
  item: Omit<BookmarkItem, "updatedAt">,
): Promise<void> {
  await apiToggleBookmark({
    manga_id:  item.mangaId,
    title:     item.title,
    cover_url: item.coverUrl,
  });
}

export async function removeBookmark(mangaId: string): Promise<void> {
  await apiDeleteBookmark(mangaId);
}

export async function toggleBookmark(
  item: Omit<BookmarkItem, "updatedAt">,
): Promise<boolean> {
  const res = await apiToggleBookmark({
    manga_id:  item.mangaId,
    title:     item.title,
    cover_url: item.coverUrl,
  });
  return res.bookmarked;
}

export async function clearBookmarks(): Promise<void> {
  const items = await getBookmarks();
  await Promise.all(items.map((b) => apiDeleteBookmark(b.mangaId)));
}

export async function replaceBookmarks(items: BookmarkItem[]): Promise<void> {
  await clearBookmarks();
  for (const item of items) {
    await addBookmark(item);
  }
}
