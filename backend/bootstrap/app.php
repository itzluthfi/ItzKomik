<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // CORS — wajib ada sebelum auth agar preflight OPTIONS request bisa dibalas
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);

        // Stateless API — Mobile app menggunakan Bearer Token, tidak butuh statefulApi/session
        // $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Kembalikan JSON untuk error autentikasi (bukan redirect ke login page)
        $exceptions->render(function (AuthenticationException $e, Request $request): JsonResponse {
            return response()->json(['message' => 'Unauthenticated. Harap login terlebih dahulu.'], 401);
        });
    })->create();

