<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReadingHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HistoryController extends Controller
{
    /**
     * GET /api/history
     * Ambil semua reading history milik user, terbaru dulu.
     */
    public function index(Request $request): JsonResponse
    {
        $items = ReadingHistory::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->get();

        return response()->json($items);
    }

    /**
     * PUT /api/history/{mangaId}
     * Upsert progress membaca untuk 1 manga.
     */
    public function upsert(Request $request, string $mangaId): JsonResponse
    {
        $data = $request->validate([
            'chapter_id'     => ['required', 'string', 'max:100'],
            'chapter_number' => ['required', 'numeric'],
            'page_index'     => ['required', 'integer', 'min:0'],
            'total_pages'    => ['required', 'integer', 'min:0'],
            'manga_title'    => ['nullable', 'string', 'max:255'],
            'cover_url'      => ['nullable', 'string'],
        ]);

        $history = ReadingHistory::updateOrCreate(
            ['user_id' => $request->user()->id, 'manga_id' => $mangaId],
            array_merge($data, ['updated_at' => now()])
        );

        return response()->json($history);
    }

    /**
     * DELETE /api/history/{mangaId}
     * Hapus 1 item dari history.
     */
    public function destroy(Request $request, string $mangaId): JsonResponse
    {
        ReadingHistory::where('user_id', $request->user()->id)
            ->where('manga_id', $mangaId)
            ->delete();

        return response()->json(['message' => 'Dihapus.']);
    }

    /**
     * DELETE /api/history
     * Hapus seluruh history user.
     */
    public function clear(Request $request): JsonResponse
    {
        ReadingHistory::where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => 'History dibersihkan.']);
    }
}
