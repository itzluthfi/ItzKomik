<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manga_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('manga_id', 100);
            $table->string('title');
            $table->text('cover_url');
            $table->string('last_seen_chapter_id', 100);
            $table->decimal('last_seen_chapter_number', 8, 1);
            $table->string('pending_chapter_id', 100)->nullable();
            $table->decimal('pending_chapter_number', 8, 1)->nullable();
            $table->timestamp('detected_at')->nullable();
            $table->timestamp('checked_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['user_id', 'manga_id'], 'uq_updates_user_manga');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manga_updates');
    }
};
