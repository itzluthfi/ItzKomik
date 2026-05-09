# Komikam

Aplikasi baca komik/manga modern berbasis **React Native (Expo)** dengan **Laravel REST API & MySQL** di sisi backend. Proyek ini menggunakan arsitektur monorepo sederhana yang memisahkan frontend dan backend pada folder masing-masing.

## Struktur Proyek

```text
komikam/
├── frontend/   ← Aplikasi React Native / Expo (Klien)
└── backend/    ← Laravel REST API (Server)
```

---

## 1. Frontend (`/frontend`)

**Tech stack:** React Native, Expo, TypeScript, Expo Router, AsyncStorage

### Cara Menjalankan Frontend

```bash
cd frontend
npm install
npx expo start
```

> **Troubleshooting Koneksi ke HP Asli:**
> Jika saat scan barcode Expo menggunakan HP tidak bisa terhubung (loading terus-menerus), hal ini biasanya karena diblokir oleh Windows Firewall atau konfigurasi jaringan WiFi.
> **Solusi tercepat:** Matikan server (`Ctrl + C` di terminal) lalu jalankan ulang dengan menggunakan mode **Tunnel** berikut:
> ```bash
> npx expo start --tunnel
> ```
> *(Tunggu beberapa saat dan scan barcode baru yang muncul).*

### Konfigurasi URL API
Aplikasi frontend akan secara otomatis mendeteksi URL backend berdasarkan platform yang digunakan (iOS/Web akan memakai `localhost`, Android Emulator otomatis menggunakan `10.0.2.2`).

Jika kamu mengetes di **perangkat asli (Physical Device)**, kamu wajib mengatur `.env.local` di folder `frontend/` menggunakan IP komputer lokal kamu:

```env
# .env.local
# Ganti dengan IP LAN komputer kamu, misal:
EXPO_PUBLIC_KOMIKAM_API_URL=http://192.168.1.xxx:8000
```
*(Ingat untuk me-restart Expo server `npx expo start` setelah mengubah file `.env.local`)*

---

## 2. Backend (`/backend`)

**Tech stack:** Laravel 11.x / 13, PHP 8.3, MySQL, Laravel Sanctum (Autentikasi Token)

### Cara Menjalankan Backend

```bash
cd backend
composer install

# Siapkan file .env
cp .env.example .env
php artisan key:generate

# Konfigurasi database MySQL di .env
# DB_DATABASE=komikam_api
# DB_USERNAME=root
# DB_PASSWORD=

# Migrasi tabel ke database
php artisan migrate

# Jalankan server
# Menggunakan --host=0.0.0.0 agar bisa diakses emulator dan perangkat di jaringan LAN yang sama
php artisan serve --host=0.0.0.0 --port=8000
```

### Konfigurasi CORS
Backend ini telah dikonfigurasi agar menerima Cross-Origin Resource Sharing (CORS) dari klien manapun saat fase development.

---

## Fitur Utama & API Endpoints

Aplikasi ini menggunakan **dua sumber API berbeda**:
1. **API Eksternal (Shngm API)** untuk mengambil konten komik.
2. **Backend Internal (Laravel API)** untuk menyimpan data user (autentikasi, histori, dsb).

### Sumber Data Komik (External API)
Aplikasi klien (Frontend) mengambil data komik dan chapter langsung dari API eksternal (`https://api.shngm.io`). Logika pemanggilan API ini diatur pada file `frontend/src/api/shngmClient.ts`.
Beberapa endpoint yang digunakan antara lain:
- `GET /v1/manga/list` : Mengambil daftar komik/manga.
- `GET /v1/manga/detail/{mangaId}` : Mengambil informasi detail komik.
- `GET /v1/chapter/{mangaId}/list` : Mengambil daftar chapter.
- `GET /v1/chapter/detail/{chapterId}` : Mengambil detail halaman gambar chapter untuk dibaca.

### Autentikasi Backend Internal
Autentikasi menggunakan **Laravel Sanctum (Bearer Token)**. Token ini akan disimpan secara otomatis di aplikasi klien ketika berhasil login atau registrasi.

### Autentikasi
| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/auth/register` | Daftar akun baru (membutuhkan `name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Login akun, mengembalikan Token dan data user |
| `POST` | `/api/auth/logout` | Logout dan menghapus Token dari server *(Protected)* |
| `GET`  | `/api/auth/me` | Mengambil data user yang sedang login *(Protected)* |

### Histori Bacaan (Reading History)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET`  | `/api/history` | Menampilkan seluruh history manga user *(Protected)* |
| `PUT`  | `/api/history/{mangaId}` | Menyimpan / memperbarui progress chapter & halaman terakhir *(Protected)* |
| `DELETE`| `/api/history/{mangaId}` | Menghapus history manga tertentu *(Protected)* |
| `DELETE`| `/api/history` | Menghapus semua history bacaan user *(Protected)* |

### Bookmarks
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET`  | `/api/bookmarks` | Menampilkan semua manga yang di-bookmark *(Protected)* |
| `GET`  | `/api/bookmarks/{mangaId}` | Cek status apakah manga di-bookmark *(Protected)* |
| `POST` | `/api/bookmarks` | Toggle bookmark (simpan/hapus) *(Protected)* |
| `DELETE`| `/api/bookmarks/{mangaId}` | Menghapus bookmark dari ID tertentu *(Protected)* |

### Pengaturan (Settings)
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET`  | `/api/settings` | Mengambil pengaturan aplikasi *(Protected)* |
| `PATCH`| `/api/settings` | Memperbarui pengaturan (misal: mode baca, kualitas gambar) *(Protected)* |

### Update Notifikasi Chapter Baru
| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET`  | `/api/updates/pending` | Mengambil notifikasi chapter baru *(Protected)* |
| `POST` | `/api/updates/check` | Mengecek ketersediaan update chapter terbaru *(Protected)* |
| `DELETE`| `/api/updates/{mangaId}` | Menutup / Dismiss notifikasi update untuk manga *(Protected)* |
| `DELETE`| `/api/updates` | Membersihkan semua notifikasi update *(Protected)* |

> **Catatan Mode Offline (Frontend):** 
> Aplikasi menggunakan penanganan *graceful fallback*. Jika ada kendala koneksi atau user belum melakukan login, maka data seperti `history` atau `bookmarks` akan mengembalikan array kosong `[]` (tidak membuat aplikasi *crash*).
