<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookmarkController;
use App\Http\Controllers\Api\HistoryController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UpdatesController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Komikam API Routes
|--------------------------------------------------------------------------
| Base URL: /api
|
| Auth endpoints (publik):
|   POST   /api/auth/register
|   POST   /api/auth/login
|
| Protected endpoints (butuh: Authorization: Bearer {token}):
|   POST   /api/auth/logout
|   GET    /api/auth/me
|
|   GET    /api/history
|   PUT    /api/history/{mangaId}
|   DELETE /api/history/{mangaId}
|   DELETE /api/history
|
|   GET    /api/bookmarks
|   GET    /api/bookmarks/{mangaId}
|   POST   /api/bookmarks
|   DELETE /api/bookmarks/{mangaId}
|
|   GET    /api/settings
|   PATCH  /api/settings
|
|   GET    /api/updates/pending
|   POST   /api/updates/check
|   DELETE /api/updates/{mangaId}
|   DELETE /api/updates
*/

// ── Auth (Publik) ──────────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
});

// ── Protected (Butuh Token Sanctum) ───────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me',      [AuthController::class, 'me']);
    });

    // Reading History
    Route::prefix('history')->group(function () {
        Route::get('/',             [HistoryController::class, 'index']);
        Route::put('{mangaId}',     [HistoryController::class, 'upsert']);
        Route::delete('{mangaId}',  [HistoryController::class, 'destroy']);
        Route::delete('/',          [HistoryController::class, 'clear']);
    });

    // Bookmarks
    Route::prefix('bookmarks')->group(function () {
        Route::get('/',            [BookmarkController::class, 'index']);
        Route::get('{mangaId}',    [BookmarkController::class, 'check']);
        Route::post('/',           [BookmarkController::class, 'store']);
        Route::delete('{mangaId}', [BookmarkController::class, 'destroy']);
    });

    // Settings
    Route::prefix('settings')->group(function () {
        Route::get('/',   [SettingsController::class, 'index']);
        Route::patch('/', [SettingsController::class, 'update']);
    });

    // Updates / Notifikasi Chapter Baru
    Route::prefix('updates')->group(function () {
        Route::get('pending',      [UpdatesController::class, 'pending']);
        Route::post('check',       [UpdatesController::class, 'check']);
        Route::delete('{mangaId}', [UpdatesController::class, 'dismiss']);
        Route::delete('/',         [UpdatesController::class, 'clearAll']);
    });
});
