<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReadingHistory extends Model
{
    public $timestamps = false;

    protected $table = 'reading_history';

    protected $fillable = [
        'user_id',
        'manga_id',
        'chapter_id',
        'chapter_number',
        'page_index',
        'total_pages',
        'manga_title',
        'cover_url',
    ];

    protected $casts = [
        'chapter_number' => 'float',
        'page_index'     => 'integer',
        'total_pages'    => 'integer',
        'updated_at'     => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
