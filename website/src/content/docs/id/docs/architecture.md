---
title: 'Arsitektur'
description: 'Minecraft Server Manager adalah aplikasi Node.js yang dirender server, satu proses.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Minecraft Server Manager adalah aplikasi Node.js yang dirender server, satu proses. Aplikasi ini mengelola
server Minecraft yang berjalan sebagai kontainer Docker menggunakan image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), berkomunikasi dengan
daemon Docker melalui API-nya (tidak pernah melalui `docker` CLI).

## Bentuk Runtime

- **Express + Handlebars** merender halaman di sisi server. Tidak ada SPA; JavaScript browser di `public/js/`
  adalah peningkatan progresif yang ditulis tangan. Langkah esbuild (`pnpm run build:js`) menggabungkan dan
  meminimalisirnya ke `public/dist/js/`; aplikasi menyajikan bundel tersebut saat ada dan sumber mentah
  jika tidak, jadi menjalankan pengembangan tanpa build tetap berfungsi.
- **`node:sqlite`** (terintegrasi di Node; panel memerlukan Node ≥ 24) adalah basis data - sinkron,
  nol modul asli, mode WAL. Pelari migrasi versi kecil menerapkan `src/db/migrations/*` saat boot. Pernyataan yang disiapkan di-cache di `src/db/index.js` dengan kunci teks SQL.
- **`ws`** membawa aliran konsol dan statistik langsung. Keduanya **diperantarai**: satu upstream
  `docker logs --follow` (atau `docker stats`) per server, di-demux sekali dan disalurkan ke setiap
  tab yang terhubung, daripada satu upstream per penampil. Perantara konsol menyimpan buffer putar kecil untuk tab yang bergabung terlambat dan menjatuhkan pelanggan yang soketnya tertinggal terlalu jauh daripada menghentikan aliran bersama.
- **dockerode** adalah satu-satunya cara aplikasi berkomunikasi dengan Docker. Titik akhir terdeteksi secara otomatis per platform
  (pipa bernama Windows vs. soket unix).
- **Semua status persisten berada di bawah satu direktori** (`$DATA_DIR`, default `./data`). Menyalin direktori itu
  memigrasikan seluruh panel.

## Lapisan

Ketergantungan mengalir dalam satu arah:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & validate input, shape responses
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   domain logic (the actual features)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastructure
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - satu router per domain (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), dipasang di `web/app.js`. Router memvalidasi dengan zod, memanggil layanan, dan mengembalikan JSON
  atau merender tampilan. Logika bisnis tidak seharusnya berada di sini. Dua router dipasang di **zona publik
  **, sebelum `requireAuth`: `routes/status.js` (halaman status HTML per server yang dapat diaktifkan) dan
  `routes/apiV1.js` (`/api/v1`, API JSON hanya baca yang diautentikasi oleh token Bearer yang dikeluarkan admin
  dari `services/apiTokens.js`, nonaktif kecuali diaktifkan di Pengaturan; lihat `docs/public-api.md`).
- **`services/`** - inti dari aplikasi. Setiap layanan memiliki satu domain dan dapat bergantung pada
  infrastruktur dan layanan lainnya.
- **`docker/`** - pembungkus dockerode: `connect` (deteksi titik akhir + kesehatan daemon), `containers`
  (buat/mulai/hentikan/buat ulang dengan mount bind, batas memori/CPU, dan label), `logs`, `stats`,
  `images`, dan `watcher` yang mengubah peristiwa Docker menjadi riwayat + deteksi crash.
- **`db/`** - pembungkus SQLite dan pelari migrasi.
- **`storage/`** - bootstrap `./data`, **penjaga jalur** (`safeJoin`, tulang punggung keamanan file), dan pengindeks ukuran latar belakang + penegakan kuota.

Lintas-potongan:

- **`config/`** - konfigurasi lingkungan ditambah **katalog bidang**: satu-satunya sumber kebenaran untuk
  pengaturan server. Setiap variabel lingkungan itzg dikatalogkan (label, bantuan, tipe, unit, default,
  validasi, bagian, bendera bahaya). Wizard, formulir pengaturan, dan validasi zod semuanya berasal
  darinya, jadi mengekspos pengaturan baru adalah perubahan data, bukan pipa UI baru.
- **`events/`** - `recordEvent()` adalah satu-satunya titik masuk untuk log riwayat; peristiwa siklus hidup juga
  menangkap kutipan log kontainer ke `data/logs/<id>/events/`.
- **`ws/`** - konsol terautentikasi + WebSocket statistik (cookie sesi diverifikasi saat peningkatan, `Origin`
  diperiksa untuk memblokir perampokan lintas situs), diperantarai per server (lihat "Bentuk Runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` mengembalikan logger
  [Pino](https://getpino.io) per modul; level dari `LOG_LEVEL`, `makeFailureThrottle()` menjaga loop latar belakang yang gagal secara persisten menjadi satu baris log ditambah baris "dipulihkan".
  `src/utils/logSanitize.js` menyensor kunci berbentuk kredensial dan token webhook dari metadata terstruktur; `src/config/logLevel.js` adalah daftar izin level bersama (disimpan terpisah untuk menghindari siklus require dengan `config`). `src/instrument.js` adalah jahitan Sentry yang tidak aktif, dimuat pertama di
  `src/server.js`. `src/web/middleware/requestLog.js` menulis satu baris log akses per permintaan
  (melewati `/healthz` dan aset statis). ESLint memberlakukan `no-console` di bawah `src/**`, dengan
  `preflight.js`, `instrument.js`, dan `config/index.js` dikecualikan (mereka berjalan sebelum logger ada).
- **Pembatasan Laju** - `src/web/middleware/rateLimit.js` menempatkan `express-rate-limit` di depan `/api`
  (`RATE_LIMIT_API_PER_MIN`, default 1200) dan POST login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, default 100); `0` menonaktifkan pembatas. Kuncinya pada `req.ip`, jadi
  `TRUST_PROXY` penting di belakang proxy. `/api/v1` memiliki pembatas per-tokennya sendiri
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, default 120), dikunci pada hash token Bearer dengan fallback IP. Penghitung lunak per akun terpisah di
  `src/web/middleware/auth.js` menangani penguncian login (per-IP dan global akun, meluruh).

## Perilaku Domain Utama

- **Modpack selalu disematkan.** Gambar secara otomatis meningkatkan paket yang tidak disematkan pada setiap restart, jadi
  panel menyelesaikan "terbaru" ke ID versi konkret pada saat instalasi dan menyematkannya. Peningkatan adalah alur terorkestrasi eksplisit (`updates/`): pratinjau → cadangan pra-pembaruan → berhenti dengan anggun → menyematkan ulang → membuat ulang → monitor kesehatan → gulir balik satu klik.
- **Lapisan mod kustom** dikelola panel: mod yang ditambahkan pengguna masuk ke pustaka yang diduplikasi dan
  ditautkan keras ke server sehingga mereka bertahan dari pembaruan paket. Menonaktifkan sadar kelas.
- **Port** dialokasikan dari skema dasar (game dari `PORT_GAME_START` ke atas, RCON = game +
  `PORT_RCON_OFFSET`, Bedrock dari `PORT_BEDROCK_START`), diselidiki ketersediaannya, dan dicadangkan di
  DB.
- **Kuota disk** ditegakkan oleh panel karena Docker tidak dapat membatasi penggunaan mount bind: pengindeks
  menyimpan ukuran per direktori dan operasi pertumbuhan disk dibatasi olehnya.
- **Rahasia** (kata sandi RCON, kunci API, rahasia TOTP, URL webhook Discord) dienkripsi saat istirahat
  dengan AES-256-GCM menggunakan kunci acak khusus di `$DATA_DIR/.secret-key` (mode `0600`,
  dibuat secara otomatis). Ini independen dari `SESSION_SECRET`; kunci turunan `SESSION_SECRET` disimpan sebagai
  fallback hanya dekripsi untuk nilai yang ditulis sebelum kunci khusus ada, dan
  `src/services/secretsMigration.js` mengenkripsi ulang nilai tersebut di bawah kunci khusus sekali saat boot.
  `.secret-key` yang ada tetapi tidak dapat diurai adalah kesalahan boot yang keras (tidak pernah diam-diam
  dibuat ulang di atasnya). Cetak biru menghapus semua rahasia saat ekspor.

## Format Data & Kawat

- **`data/panel.db`** - basis data SQLite. Di-snapshot setiap hari melalui `VACUUM INTO` ke
  `data/backups/_panel/` (14 terbaru disimpan); `PRAGMA integrity_check` berjalan saat boot.
- **`data/.session-secret`** - rahasia penandatanganan cookie yang dibuat secara otomatis, dibuat saat pertama kali dijalankan jika
  `SESSION_SECRET` tidak diatur. Menghapusnya akan memutar rahasia (yang membatalkan sesi).
- **`data/.secret-key`** - kunci enkripsi saat istirahat 32-byte khusus (mode `0600`), dibuat secara otomatis
  saat pertama kali dijalankan. Independen dari `SESSION_SECRET`; menghapusnya membuat setiap kredensial yang disimpan
  tidak dapat didekripsi, jadi itu termasuk dalam cadangan Anda.
- **Cetak Biru (`.mcserver.zip`)** - zip dengan `manifest.json` yang menjelaskan konfigurasi, sumber daya, referensi paket yang disematkan, manifes overlay (URL sumber + sha256), file konfigurasi yang dipilih, dan
  opsional dunia. Impor mengunduh ulang dan memverifikasi hash setiap mod dan menetapkan port baru.
- **Kontainer Docker** yang dibuat oleh panel diberi nama dan diberi label sehingga pengamat dapat menemukannya;
  panel memiliki siklus hidup penuhnya.

## Urutan Boot

1. `require('./instrument')` (jahitan Sentry) sebelum yang lain, lalu `require('./preflight')`
   untuk gagal dengan jelas pada versi Node yang tidak didukung.
2. Muat konfigurasi; pastikan/buat `.session-secret` **dan** `.secret-key`.
3. `ensureDataRoot()` - buat tata letak `./data`, hapus `tmp/`.
4. Jalankan migrasi DB, lalu `PRAGMA integrity_check` (mencatat dengan keras, menunjuk ke `data/backups/_panel`
   saat gagal).
5. Enkripsi ulang rahasia yang diindeks `SESSION_SECRET` lama di bawah `.secret-key` (`secretsMigration`).
6. Benih cetak biru awal (dilindungi).
7. Mulai server HTTP + WS. Pada bind yang terbuka, cetak PIN `/setup` saat pertama kali dijalankan.
8. Instal penjaga runtime pasca-boot (menangkap kesalahan yang tidak tertangkap; `MSM_EXIT_ON_FATAL=1` membuatnya
   keluar keras untuk penyebaran yang diawasi).
9. Mulai layanan latar belakang: perantara WS, pengindeks penyimpanan, pengamat crash + inventaris, penjadwal,
   jembatan acara Discord, dan **timer pemeliharaan harian** (pangkas baris analitik lama + snapshot
   `panel.db`).
10. Inisialisasi Docker **di latar belakang**. UI sepenuhnya dapat digunakan saat daemon mati;
    Fitur Docker menyala saat dapat dijangkau. Setelah terhubung, `refreshStatuses({ boot })`
    mendasarkan ulang status yang di-cache, mengeluarkan peristiwa `offline-after-restart` satu kali untuk server yang aktif sebelum panel dimulai ulang dan tidak akan diaktifkan kembali, dan loop boot memulai
    server `auto_start` ditambah memulihkan server `auto_restart` yang ditemukan crash selama pemadaman
    (menghormati penundaan loop crash).

> Urutan instrument-sebelum-preflight adalah pertukaran yang disengaja: ini memungkinkan tambalan pengkabelan Sentry di masa mendatang
> untuk menambal runtime terlebih dahulu, dengan biaya pesan yang sedikit kurang ramah pada Node yang benar-benar kuno.

## Pipeline Build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM dengan pemisahan kode). `postinstall` menjalankan **hanya CSS**. `public/css/app.css`
dan `public/dist/` adalah artefak build yang diabaikan git; tahap build Dockerfile menjalankan `pnpm run build` penuh
dan menyalin `public/` ke dalam gambar runtime. Aset statis disajikan
`immutable`/cache-panjang untuk file yang diberi sidik jari, cache-pendek untuk CSS/JS, dan `no-cache` untuk HTML dan
`/api`.
