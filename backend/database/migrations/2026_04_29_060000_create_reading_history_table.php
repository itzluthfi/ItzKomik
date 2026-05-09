<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reading_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('manga_id', 100);
            $table->string('chapter_id', 100);
            $table->decimal('chapter_number', 8, 1);
            $table->unsignedInteger('page_index')->default(0);
            $table->unsignedInteger('total_pages')->default(0);
            $table->string('manga_title')->nullable();
            $table->text('cover_url')->nullable();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->unique(['user_id', 'manga_id'], 'uq_history_user_manga');
            $table->index(['user_id', 'updated_at'], 'idx_history_user_updated');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reading_history');
    }
};
