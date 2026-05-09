<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    private const ALLOWED_KEYS = [
        'reader_image_quality',
        'reader_bg',
        'theme_mode',
    ];

    /**
     * GET /api/settings
     * Ambil semua settings user sebagai key-value object.
     */
    public function index(Request $request): JsonResponse
    {
        $rows = DB::table('user_settings')
            ->where('user_id', $request->user()->id)
            ->get(['key', 'value']);

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row->key] = json_decode($row->value, true) ?? $row->value;
        }

        return response()->json($settings);
    }

    /**
     * PATCH /api/settings
     * Update satu atau lebih setting. Key harus ada di ALLOWED_KEYS.
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reader_image_quality' => ['sometimes', 'string', 'in:high,low'],
            'reader_bg'            => ['sometimes', 'string', 'in:black,dark,white'],
            'theme_mode'           => ['sometimes', 'string', 'in:light,dark,system'],
        ]);

        $userId = $request->user()->id;

        foreach ($data as $key => $value) {
            DB::table('user_settings')->upsert(
                [
                    'user_id'    => $userId,
                    'key'        => $key,
                    'value'      => json_encode($value),
                    'updated_at' => now(),
                ],
                ['user_id', 'key'],
                ['value', 'updated_at']
            );
        }

        // Return all settings after update
        $rows = DB::table('user_settings')
            ->where('user_id', $userId)
            ->get(['key', 'value']);

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row->key] = json_decode($row->value, true) ?? $row->value;
        }

        return response()->json($settings);
    }
}
