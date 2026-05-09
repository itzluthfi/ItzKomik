export type ShngmMeta = {
  request_id: string;
  timestamp: number;
  process_time: string;
  page: number;
  page_size: number;
  total_page: number;
  total_record: number;
};

export type ShngmTaxonomyItem = {
  name: string;
  slug: string;
};

export type ShngmTaxonomy = {
  Artist?: ShngmTaxonomyItem[];
  Author?: ShngmTaxonomyItem[];
  Format?: ShngmTaxonomyItem[];
  Genre?: ShngmTaxonomyItem[];
  Type?: ShngmTaxonomyItem[];
};

export type ShngmManga = {
  manga_id: string;
  title: string;
  alternative_title: string;
  description: string;
  country_id: string;

  cover_image_url: string;
  cover_portrait_url: string;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;

  is_recommended: boolean;
  status: number;

  latest_chapter_id: string;
  latest_chapter_number: number;
  latest_chapter_time: string;

  bookmark_count: number;
  view_count: number;
  user_rate: number;

  rank: number;
  release_year: string;

  taxonomy: ShngmTaxonomy;
};

export type ShngmMangaListResponse = {
  retcode: number;
  message: string;
  meta: ShngmMeta;
  data: ShngmManga[];
  facet: Record<string, unknown>; // facet besar dan dinamis, cukup unknown
};

export type ShngmMangaDetailResponse = {
  retcode: number;
  message: string;
  meta: {
    request_id: string;
    timestamp: number;
    process_time: string;
  };
  data: ShngmManga;
};

export type ShngmChapter = {
  chapter_id: string;
  manga_id: string;
  chapter_title: string;
  chapter_number: number;
  thumbnail_image_url: string;
  view_count: number;
  release_date: string;
};

export type ShngmChapterListResponse = {
  retcode: number;
  message: string;
  meta: ShngmMeta;
  data: ShngmChapter[];
};

export type ShngmChapterDetailData = {
  chapter_id: string;
  manga_id: string;
  chapter_number: number;
  chapter_title: string;

  base_url: string;
  base_url_low: string;

  chapter: {
    title(title: any): unknown;
    path: string;
    data: string[]; // list filename gambar
  };

  thumbnail_image_url: string;
  view_count: number;

  prev_chapter_id: string | null;
  prev_chapter_number: number | null;
  next_chapter_id: string | null;
  next_chapter_number: number | null;

  release_date: string;
  created_at: string;
  updated_at: string;
};

export type ShngmChapterDetailResponse = {
  retcode: number;
  message: string;
  meta: {
    request_id: string;
    timestamp: number;
    process_time: string;
  };
  data: ShngmChapterDetailData;
};


