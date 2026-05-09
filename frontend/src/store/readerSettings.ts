import {
  apiGetSettings,
  apiUpdateSettings,
  type ApiSettings,
} from "@/src/api/komikamApi";

export type ImageQuality = "high" | "low";
export type ReaderBg = "black" | "dark" | "white";

export type ReaderSettings = {
  imageQuality: ImageQuality;
  readerBg: ReaderBg;
};

const DEFAULT_SETTINGS: ReaderSettings = {
  imageQuality: "high",
  readerBg: "black",
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  try {
    const s = await apiGetSettings();
    return {
      imageQuality: (s.reader_image_quality as ImageQuality) ?? DEFAULT_SETTINGS.imageQuality,
      readerBg:     (s.reader_bg as ReaderBg) ?? DEFAULT_SETTINGS.readerBg,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setReaderSettings(
  s: Partial<ReaderSettings>,
): Promise<ReaderSettings> {
  const payload: ApiSettings = {};
  if (s.imageQuality !== undefined) payload.reader_image_quality = s.imageQuality;
  if (s.readerBg !== undefined) payload.reader_bg = s.readerBg;

  try {
    const updated = await apiUpdateSettings(payload);
    return {
      imageQuality: (updated.reader_image_quality as ImageQuality) ?? DEFAULT_SETTINGS.imageQuality,
      readerBg:     (updated.reader_bg as ReaderBg) ?? DEFAULT_SETTINGS.readerBg,
    };
  } catch {
    return getReaderSettings();
  }
}
