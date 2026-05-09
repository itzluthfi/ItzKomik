<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bookmark;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookmarkController extends Controller
{
    /**
     * GET /api/bookmarks
     * Daftar semua bookmark milik user, terbaru dulu.
     */
    public function index(Request $request): JsonResponse
    {
        $items = Bookmark::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($items);
    }

    /**
     * GET /api/bookmarks/{mangaId}
     * Cek apakah manga sudah di-bookmark.
     */
    public function check(Request $request, string $mangaId): JsonResponse
    {
        $exists = Bookmark::where('user_id', $request->user()->id)
            ->where('manga_id', $mangaId)
            ->exists();

        return response()->json(['bookmarked' => $exists]);
    }

    /**
     * POST /api/bookmarks
     * Tambah atau toggle bookmark.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'manga_id'  => ['required', 'string', 'max:100'],
            'title'     => ['required', 'string', 'max:255'],
            'cover_url' => ['required', 'string'],
        ]);

        $userId = $request->user()->id;

        $existing = Bookmark::where('user_id', $userId)
            ->where('manga_id', $data['manga_id'])
            ->first();

        if ($existing) {
            $existing->delete();
            return response()->json(['bookmarked' => false, 'message' => 'Bookmark dihapus.']);
        }

        Bookmark::create(array_merge($data, [
            'user_id'    => $userId,
            'created_at' => now(),
        ]));

        return response()->json(['bookmarked' => true, 'message' => 'Bookmark ditambahkan.'], 201);
    }

    /**
     * DELETE /api/bookmarks/{mangaId}
     * Hapus bookmark spesifik.
     */
    public function destroy(Request $request, string $mangaId): JsonResponse
    {
        Bookmark::where('user_id', $request->user()->id)
            ->where('manga_id', $mangaId)
            ->delete();

        return response()->json(['message' => 'Bookmark dihapus.']);
    }
}
