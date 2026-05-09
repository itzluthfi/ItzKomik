<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MangaUpdate extends Model
{
    public $timestamps = false;

    protected $table = 'manga_updates';

    protected $fillable = [
        'user_id',
        'manga_id',
        'title',
        'cover_url',
        'last_seen_chapter_id',
        'last_seen_chapter_number',
        'pending_chapter_id',
        'pending_chapter_number',
        'detected_at',
    ];

    protected $casts = [
        'last_seen_chapter_number' => 'float',
        'pending_chapter_number'   => 'float',
        'detected_at'              => 'datetime',
        'checked_at'               => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
