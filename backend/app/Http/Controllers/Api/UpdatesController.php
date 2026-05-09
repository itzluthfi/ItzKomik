<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MangaUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UpdatesController extends Controller
{
    /**
     * GET /api/updates/pending
     * Daftar manga yang punya chapter baru (pending != null), terbaru dulu.
     */
    public function pending(Request $request): JsonResponse
    {
        $items = MangaUpdate::where('user_id', $request->user()->id)
            ->whereNotNull('pending_chapter_id')
            ->orderByDesc('detected_at')
            ->get();

        return response()->json($items);
    }

    /**
     * POST /api/updates/check
     * App mengirim data chapter terbaru yang sudah dicek.
     * Backend menyimpan last_seen dan menentukan apakah ada update.
     */
    public function check(Request $request): JsonResponse
    {
        $data = $request->validate([
            'manga_id'       => ['required', 'string', 'max:100'],
            'title'          => ['required', 'string', 'max:255'],
            'cover_url'      => ['required', 'string'],
            'chapter_id'     => ['required', 'string', 'max:100'],
            'chapter_number' => ['required', 'numeric'],
        ]);

        $userId   = $request->user()->id;
        $existing = MangaUpdate::where('user_id', $userId)
            ->where('manga_id', $data['manga_id'])
            ->first();

        $hasNewChapter = false;

        if (! $existing) {
            // Pertama kali cek — simpan sebagai last_seen, belum ada update
            MangaUpdate::create([
                'user_id'                  => $userId,
                'manga_id'                 => $data['manga_id'],
                'title'                    => $data['title'],
                'cover_url'                => $data['cover_url'],
                'last_seen_chapter_id'     => $data['chapter_id'],
                'last_seen_chapter_number' => $data['chapter_number'],
                'pending_chapter_id'       => null,
                'pending_chapter_number'   => null,
                'detected_at'              => null,
                'checked_at'               => now(),
            ]);
        } elseif ($data['chapter_number'] > $existing->last_seen_chapter_number) {
            // Ada chapter baru!
            $hasNewChapter = true;
            $existing->update([
                'title'                    => $data['title'],
                'cover_url'                => $data['cover_url'],
                'last_seen_chapter_id'     => $data['chapter_id'],
                'last_seen_chapter_number' => $data['chapter_number'],
                'pending_chapter_id'       => $data['chapter_id'],
                'pending_chapter_number'   => $data['chapter_number'],
                'detected_at'              => now(),
                'checked_at'               => now(),
            ]);
        } else {
            // Tidak ada chapter baru, update waktu pengecekan saja
            $existing->update(['checked_at' => now()]);
        }

        return response()->json([
            'has_new_chapter' => $hasNewChapter,
            'manga_id'        => $data['manga_id'],
        ]);
    }

    /**
     * DELETE /api/updates/{mangaId}
     * Hapus pending update untuk manga tertentu (sudah dibaca).
     */
    public function dismiss(Request $request, string $mangaId): JsonResponse
    {
        MangaUpdate::where('user_id', $request->user()->id)
            ->where('manga_id', $mangaId)
            ->update([
                'pending_chapter_id'     => null,
                'pending_chapter_number' => null,
                'detected_at'            => null,
            ]);

        return response()->json(['message' => 'Update ditandai telah dibaca.']);
    }

    /**
     * DELETE /api/updates
     * Clear semua pending updates user.
     */
    public function clearAll(Request $request): JsonResponse
    {
        MangaUpdate::where('user_id', $request->user()->id)
            ->update([
                'pending_chapter_id'     => null,
                'pending_chapter_number' => null,
                'detected_at'            => null,
            ]);

        return response()->json(['message' => 'Semua update dibersihkan.']);
    }
}
