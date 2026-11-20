---
title: 'Arsitektur'
description: 'Minecraft Server Manager adalah aplikasi Node.js yang dirender server, satu proses.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Kembali ke indeks docs](/docs/)

Minecraft Server Manager adalah aplikasi Node.js yang dirender server, satu proses. Aplikasi ini mengelola
server Minecraft yang berjalan sebagai kontainer Docker menggunakan image
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server), berkomunikasi dengan
daemon Docker melalui API-nya (tidak pernah dengan menjalankan `docker` CLI).

## Bentuk Runtime

- **Express + Handlebars** merender halaman di sisi server. Tidak ada SPA; JS browser di `public/js/`
  adalah peningkatan progresif yang ditulis tangan. Langkah esbuild (`pnpm run build:js`) membundel dan
  meminifikasinya ke `public/dist/js/`; aplikasi menyajikan bundel tersebut saat ada dan sumber mentah
  jika tidak, sehingga menjalankan dev tanpa build tetap berfungsi.
- **`node:sqlite`** (dibangun ke dalam Node; panel memerlukan Node ≥ 24) adalah basis data - sinkron,
  nol modul asli, mode WAL. Pelari migrasi versi kecil menerapkan `src/db/migrations/*` saat boot. Pernyataan yang disiapkan di-cache di `src/db/index.js` dengan kunci teks SQL.
- **`ws`** membawa aliran konsol dan statistik langsung. Keduanya **diperantarai**: satu upstream
  `docker logs --follow` (atau `docker stats`) per server, di-demux sekali dan disebarkan ke setiap
  tab yang terhubung, daripada satu upstream per penampil. Perantara konsol menyimpan buffer putar kecil
  untuk tab yang bergabung terlambat dan menjatuhkan pelanggan yang soketnya tertinggal terlalu jauh daripada
  menghambat aliran bersama.
- **dockerode** adalah satu-satunya cara aplikasi berbicara dengan Docker. Titik akhir terdeteksi secara otomatis per platform
  (pipa bernama Windows vs. soket unix).
- **Semua status persisten berada di bawah satu direktori** (`$DATA_DIR`, default `./data`). Menyalin direktori itu
  memigrasikan seluruh panel.

## Lapisan

Ketergantungan mengalir dalam satu arah:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   parse & validasi input, bentuk respons
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   logika domain (fitur sebenarnya)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   infrastruktur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - satu router per domain (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` memasang yang tingkat atas (`api.js`, API JSON sesi yang juga menampung rute server inti
  dan memasang router domain per server; `index.js`, halaman; `auth`, `account`,
  `tasks`, …). Router memvalidasi dengan zod, memanggil layanan, dan mengembalikan JSON
  atau merender tampilan. Logika bisnis tidak boleh berada di sini. Dua router dipasang di **zona publik
  **, sebelum `requireAuth`: `routes/status.js` (halaman status per server yang dapat dipilih) dan
  `routes/apiV1.js` (`/api/v1`, API JSON hanya-baca yang diautentikasi oleh token Bearer yang dikeluarkan admin
  dari `services/apiTokens.js`, nonaktif kecuali diaktifkan di Pengaturan; lihat `docs/public-api.md`).
- **`services/`** - jantung aplikasi. Setiap layanan memiliki satu domain dan dapat bergantung pada
  infrastruktur dan layanan lainnya.
- **`docker/`** - pembungkus dockerode: `connect` (deteksi titik akhir + kesehatan daemon), `containers`
  (buat/mulai/hentikan/buat ulang dengan mount bind, batas memori/CPU, dan label), `logs`, `stats`,
  `images`, `networks` (penemuan jaringan host), `hostPath` (mengakar ulang path bind di bawah
  `DATA_DIR_HOST`), dan `watcher` yang mengubah peristiwa Docker menjadi riwayat + deteksi crash.
- **`db/`** - pembungkus SQLite dan pelari migrasi.
- **`storage/`** - bootstrap `./data`, **penjaga jalur** (`safeJoin`, tulang punggung keamanan file
  ), dan pengindeks ukuran latar belakang + penegakan kuota.

Lintas-lintas:

- **`config/`** - konfigurasi lingkungan ditambah **katalog bidang**: satu-satunya sumber kebenaran untuk
  pengaturan server. Setiap variabel lingkungan itzg dikatalogkan (label, bantuan, tipe, unit, default,
  validasi, bagian, flag bahaya). Wizard, formulir pengaturan, dan validasi zod semuanya berasal
  dari sana, sehingga mengekspos pengaturan baru adalah perubahan data, bukan pipa UI baru.
- **`events/`** - `recordEvent()` adalah satu titik masuk untuk log riwayat; peristiwa siklus hidup juga
  menangkap kutipan log kontainer ke `data/logs/<id>/events/`.
- **`ws/`** - konsol terautentikasi + WebSocket statistik (cookie sesi diverifikasi saat peningkatan, `Origin`
  diperiksa untuk memblokir peretasan lintas situs), diperantarai per server (lihat "Bentuk Runtime").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` mengembalikan logger
  [Pino](https://getpino.io) per modul; level dari `LOG_LEVEL`, `makeFailureThrottle()` menjaga loop latar belakang yang gagal secara persisten menjadi satu baris log ditambah baris "dipulihkan".
  `src/utils/logSanitize.js` menyensor kunci berbentuk kredensial dan token webhook dari metadata terstruktur; `src/config/logLevel.js` adalah daftar yang diizinkan level bersama (disimpan terpisah untuk menghindari siklus require dengan `config`). `src/instrument.js` adalah celah Sentry yang tidak aktif, dimuat pertama di `src/server.js`. `src/web/middleware/requestLog.js` menulis satu baris log akses per permintaan
  (melewati `/healthz` dan aset statis). ESLint memberlakukan `no-console` di bawah `src/**`, dengan
  `preflight.js`, `instrument.js`, dan `config/index.js` dikecualikan (mereka berjalan sebelum logger ada).
- **Pembatasan Laju** - `src/web/middleware/rateLimit.js` menempatkan `express-rate-limit` di depan `/api`
  (`RATE_LIMIT_API_PER_MIN`, default 1200) dan POST login / 2FA / setup
  (`RATE_LIMIT_AUTH_PER_15MIN`, default 100); `0` menonaktifkan pembatas. Kuncinya pada `req.ip`, jadi
  `TRUST_PROXY` penting di belakang proxy. `/api/v1` memiliki pembatasnya sendiri: batas per klien-IP
  (lima kali anggaran per token) yang berjalan sebelum token diverifikasi, lalu anggaran per token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, default 120) yang dikunci pada id token yang terverifikasi. Terpisah
  penghitung lunak per akun di
  `src/web/middleware/auth.js` menangani penguncian login (per-IP dan global akun, meluruh).
- **Otorisasi**: dua lapisan. Peran global (`requireAuth` → `requireRole` / `requireWrite` di
  `src/web/middleware/auth.js`) mengontrol tindakan di seluruh panel dan merupakan default pada setiap server. Per-server
  izin (`src/services/permissions.js`, sembilan kapabilitas disimpan sebagai daftar JSON per
  `(user, server)` di `user_server_permissions`) menyempurnakan default tersebut untuk satu server; setiap
  rute `/api/servers/:id`, pemasangan sub-router, halaman, WebSocket, dan daftar seluruh armada melewati
  `src/web/middleware/serverAccess.js` (`serverScope`, dipasang pada awalan `/servers/:id` dari API dan router halaman, menyembunyikan server tanpa `view` sebagai 404; `requireCap(cap)` menamai kapabilitas yang dibutuhkan rute). Tulis yang menamai server mereka di badan (jadwal, ekstraksi dunia dan instalasi, ekspor cetak biru) dibuka untuk penampil oleh `requireWrite` hanya untuk server itu, dan setiap rute semacam itu memeriksa kapabilitasnya sendiri. `test/permissions-routes.test.js` menelusuri tumpukan router langsung dan gagal jika rute tulis yang diskalakan server, pemasangan, atau halaman tidak memiliki gerbang.

## Perilaku Domain Utama

- **Modpack selalu disematkan.** Image secara otomatis meningkatkan pack yang tidak disematkan pada setiap restart, jadi
  panel menyelesaikan "terbaru" ke id versi konkret pada saat instalasi dan menyematkannya. Peningkatan adalah
  aliran terorkestrasi eksplisit (`updates/`): pratinjau → cadangan pra-pembaruan → berhenti dengan anggun → menyematkan ulang →
  membuat ulang → monitor kesehatan → gulir balik satu klik.
- **Lapisan mod kustom** dikelola panel: mod yang ditambahkan pengguna masuk ke perpustakaan yang deduplikasi dan
  di-hard-link ke server sehingga bertahan dari pembaruan pack. Menonaktifkan sadar kelas. Karena
  perpustakaan menyimpan setiap build yang telah diunduh, pembaruan mencatat build yang diganti
  (`server_content.previous_*`) dan dapat dikembalikan hanya dari file lokal. Menonaktifkan mod pack
  menulis variabel lingkungan pengecualian pack sebagai gantinya; `packs.applyPack` membawa itu dan sisa
  penyetelan pack (`PACK_TUNING_KEYS`) melintasi perubahan versi pack yang sama, dan menjatuhkannya saat
  pack berubah.
- **Peningkatan versi Minecraft harus diusahakan.** `services/compat.js` memindai mod server -
  diselesaikan dari baris yang diinstal panel, lalu manifes pack CurseForge, lalu berdasarkan hash konten
  terhadap Modrinth/CurseForge - dan membangun matriks dukungan (loader, versi Minecraft) per proyek
  dari `latestFilesIndexes` CurseForge (200 proyek per permintaan) dan daftar versi per proyek Modrinth
  (satu permintaan per proyek, yang menjaga loader dan versi tetap berpasangan). Pemeriksa pembaruan menawarkan hanya versi terbaru YANG DIDUKUNG SETIAP mod, dan tidak menawarkan apa pun sama sekali saat
  jawaban tidak dapat ditetapkan: tidak ada pemindaian, pemindaian untuk versi atau loader yang berbeda, yang tidak pernah
  selesai, atau jar yang tidak dikenali oleh kedua registri. Pemindaian hanya manual, dan kemajuan serta hasil parsialnya berada di `version_compat` (bukan di `services/tasks.js` dalam memori), jadi penyegaran
  atau restart panel melanjutkan alih-alih menggantung pada pemintal; `reconcileScans()` menandai pemindaian yang
  terlantar oleh shutdown pada boot berikutnya.
- **Versi mod loader adalah pin, seperti segalanya.** `services/loaderPin.js` membaca build yang terinstal dari manifes instalasi image itu sendiri (`.forge-manifest.json` dan teman-teman) dan
  menulis pin: variabel itzg loader pada server biasa (`FORGE_VERSION`, …), atau
  `CF_MOD_LOADER_VERSION` pada pack CurseForge Forge atau Fabric, yang menimpa versi yang dinyatakan pack.
  Penginstal CurseForge image mengabaikan penimpaan itu untuk NeoForge, dan pack Modrinth dan FTB tidak memilikinya, jadi loader mereka mengikuti pack. `packs.applyPack` menghapus setiap variabel `CF_` pada pembaruan atau pemulihan pack, yang menjatuhkan penimpaan bersama sisanya. Build yang diketik diperiksa terhadap daftar lengkap registri terlebih dahulu (`services/loaderVersions.js`; Forge berasal dari metadata maven-nya, yang melewati angka; kehilangan diperiksa ulang sekali terhadap registri itu sendiri),
  kemudian perubahan adalah cadangan → pin (di atas env seperti adanya setelah cadangan) → pembangunan ulang.
- **Port** dialokasikan dari skema dasar (game dari `PORT_GAME_START` ke atas, RCON = game +
  `PORT_RCON_OFFSET`, Bedrock dari `PORT_BEDROCK_START`), diuji ketersediaannya, dan dicadangkan di
  DB. "Terambil" adalah gabungan dari semua klaim server (port langsung, ditambah pasangan yang tertunda di bawah),
  setiap port host yang diterbitkan oleh kontainer Docker mana pun (`containers.publishedHostPorts`: pengikatan langsung kontainer yang berjalan ditambah yang dikonfigurasi kontainer yang berhenti, karena probe pengikatan OS dari dalam kontainer panel sendiri hanya melihat ruang jaringan kontainer itu), dan probe OS. Bagian Docker di-cache selama 3 detik dan dibatasi: daftar yang tidak merespons dalam 2,5 detik hanya menjatuhkan bagian Docker, dan inspeksi yang lambat hanya memakan port kontainer itu. Pembuatan server dan
  `servers.changeGamePort` memilih port melalui satu rantai serialisasi yang hanya mencakup pilihan
  dan klaimnya (penulisan baris untuk pembuatan, reservasi dalam memori untuk perubahan port);
  pemilih port BlueMap dan penimpaan port tambahan tidak ada di dalamnya dan tidak
  berkonsultasi dengan Docker. Perubahan port pada server yang ada (`servers.changeGamePort`, di bawah
  kunci operasi server) diterapkan sekaligus, karena Docker memperbaiki pengikatan port saat pembuatan kontainer:
  pasangan baru (RCON selalu game + `PORT_RCON_OFFSET`) diuji dan dicadangkan dalam memori
  (`ports.reserve`, baik pasangan lama maupun baru, dihormati oleh setiap pilihan lain) di bawah kunci port.
  Ditolak (409 `PENDING_CHANGES`) saat pengaturan lain menunggu pembangunan ulang, jadi hanya pernah
  membangun ulang kontainer yang sudah berjalan, pada port baru; dan server yang berjalan hanya diubah
  saat permintaan mengatakan `restart: true` (jika tidak, 409 `NEEDS_CONFIRM`). Image ditarik dan nama kontainer kustom diperiksa sebelum apa pun disentuh. Server yang berjalan dihentikan; kemudian pasangan baru ditulis dengan `pending_recreate = 1` (sehingga crash panel dari sana meninggalkan "pembangunan ulang tertunda" yang jujur
  ), kontainer dihapus, dibangun ulang pada pasangan baru dan dimulai. Jika ada langkah setelah penghentian gagal, `putBackOnOldPort` menulis kembali pasangan lama, membangun ulang (dan memulai ulang, jika sedang berjalan) di atasnya dan mencatat langkah mana yang gagal; riwayat dan peringatan mengatakan jika itu pun gagal, yang membuat server berhenti sampai seseorang memulainya. Kapabilitas `settings` sudah cukup, termasuk server yang berjalan. Non-admin hanya dapat memilih dari `PORT_GAME_START` ke atas.
  (Kolom `port_*_pending` dari migrasi 029 termasuk dalam desain sebelumnya yang belum dirilis dan tidak digunakan; 031 membersihkannya.) Tabrakan kunci menjawab 409 dengan `code: 'BUSY'`, yang diperiksa oleh pemanggil yang mencoba ulang di bawah daripada kata-katanya. Restart otomatis saat crash
  (`watcher.restartAfterCrash`) dan pencadangan atau mulai terjadwal (`scheduler.runTaskWithRetry`)
  yang menemukan server sibuk dengan tindakan lain mencoba lagi setiap 20 detik / 60 detik hingga 30 menit,
  dan pembaruan atau pemulihan pack mencoba ulang langkah-langkah yang terkunci dengan cara yang sama (`opLock.retryWhileBusy`);
  restart saat crash atau mulai terjadwal yang menunggu menyerah setelah seseorang menghentikan, membunuh, atau
  memulai server sejak itu (`events.lifecycleActionSince`), dan restart saat crash juga ketika
  restart otomatis mati atau server hilang. Restart terjadwal, penghentian, dan perintah tidak dicoba ulang, dan jadwal yang eksekusi terakhirnya masih menunggu akan melewati penembakan berikutnya.
- **Kuota Disk** ditegakkan oleh panel karena Docker tidak dapat membatasi penggunaan mount bind: pengindeks
  menyimpan ukuran per direktori dalam cache dan operasi penambahan disk dibatasi berdasarkan itu.
- **Rahasia** (kata sandi RCON, kunci API, rahasia TOTP, URL webhook Discord) dienkripsi saat istirahat dengan AES-256-GCM menggunakan kunci acak khusus di `$DATA_DIR/.secret-key` (mode `0600`,
  dibuat secara otomatis). Ini independen dari `SESSION_SECRET`; kunci turunan `SESSION_SECRET` disimpan sebagai fallback hanya dekripsi untuk nilai yang ditulis sebelum kunci khusus ada, dan
  `src/services/secretsMigration.js` mengenkripsi ulang nilai tersebut di bawah kunci khusus sekali saat boot.
  `.secret-key` yang ada tetapi tidak dapat diurai adalah kesalahan boot yang keras (tidak pernah diam-diam
  dibuat ulang di atasnya). Cetak biru menghapus semua rahasia saat ekspor.
- **`server.properties` dimiliki oleh panel tetapi dibayangi oleh env.** Image itzg menegaskan kembali setiap
  properti yang didukung env pada setiap mulai (`OVERRIDE_SERVER_PROPERTIES` default benar), jadi nilai yang
  diedit langsung oleh panel - Kontrol Dunia PvP/kesulitan, pengalih whitelist, editor File -
  akan diam-diam dikembalikan pada mulai berikutnya kecuali variabel env yang cocok dihapus dan
  kontainer dibuat ulang. Setiap penulisan properti langsung melewati `writeServerProperties()` (seluruh file)
  atau `setServerProperty()` (satu kunci) di `src/services/servers.js`, yang secara atomik menulis ulang
  file, menghapus variabel env di belakang setiap kunci yang diubah (melalui atribut `prop:` pada bidang katalog
  , diperiksa dalam pengujian terhadap definisi properti image itu sendiri), dan menandai
  `pending_recreate`. Kesulitan ditulis ke file serta dikirim melalui RCON, karena server khusus menerapkan ulang properti `difficulty` pada setiap boot. Minecraft itu sendiri menyimpan ulang server.properties dari nilai waktu bootnya saat `whitelist on/off`, yang akan membatalkan pengeditan yang dilakukan saat server berjalan, jadi pengalih whitelist yang berjalan menyimpan file terlebih dahulu dan menulisnya kembali hanya dengan `white-list` yang diubah. Env
  variabel tetap sepenuhnya dapat dikonfigurasi saat pembuatan (wizard menampilkannya dan berlaku sekali); mereka hanya
  melepaskan pin pada saat pertama kali panel mengedit properti yang mendasarinya. MOTD adalah kontrak yang sama: pengeditan file `motd` langsung melepaskannya, jadi penulisan terakhir yang menang.

## Format Data & Kawat

- **`data/panel.db`** - basis data SQLite. Di-snapshot setiap hari melalui `VACUUM INTO` ke
  `data/backups/_panel/` (14 terbaru disimpan); `PRAGMA integrity_check` berjalan saat boot.
- **`data/.session-secret`** - rahasia penandatanganan cookie yang dibuat secara otomatis, dibuat saat pertama kali dijalankan jika
  `SESSION_SECRET` tidak diatur. Menghapusnya akan merotasi rahasia (yang membatalkan sesi).
- **`data/.secret-key`** - kunci enkripsi saat istirahat 32-byte khusus (mode `0600`), dibuat secara otomatis
  saat pertama kali dijalankan. Independen dari `SESSION_SECRET`; menghapusnya membuat setiap kredensial yang disimpan
  tidak dapat didekripsi, jadi itu termasuk dalam cadangan Anda.
- **Cetak Biru (`.mcserver.zip`)** - zip dengan `manifest.json` yang menjelaskan konfigurasi, sumber daya, referensi pack yang disematkan, manifes overlay (URL sumber + sha256), file konfigurasi yang dipilih, dan opsional dunia. Impor mengunduh ulang dan memverifikasi hash setiap mod dan menetapkan port baru.
- **Kontainer Docker** yang dibuat oleh panel diberi nama dan diberi label sehingga watcher dapat menemukannya;
  panel memiliki siklus hidup penuhnya.

## Urutan Boot

1. `require('./instrument')` (celah Sentry) sebelum yang lain, lalu `require('./preflight')`
   untuk gagal dengan jelas pada versi Node yang tidak didukung.
2. Muat konfigurasi; pastikan/buat `.session-secret` **dan** `.secret-key`.
3. `ensureDataRoot()` - buat tata letak `./data`, hapus `tmp/`.
4. Jalankan migrasi DB, lalu `PRAGMA integrity_check` (mencatat dengan keras, menunjuk ke `data/backups/_panel`
   saat gagal).
5. Enkripsi ulang rahasia yang berorientasi `SESSION_SECRET` lama di bawah `.secret-key` (`secretsMigration`).
6. Impor kunci API dari lingkungan sekali (`apiKeys.importFromEnvOnce()`), sematkan setiap server yang masih
   membawa pemilih modpack yang tidak disematkan (`packPins.pinUnpinnedServers()`), tandai pemindaian kompatibilitas versi yang dibiarkan berjalan oleh proses sebelumnya sebagai terganggu
   (`compat.reconcileScans()`), lalu isi cetak biru awal (dilindungi).
7. Mulai server HTTP + WS. Pada pengikatan yang terbuka, cetak PIN `/setup` saat pertama kali dijalankan.
8. Instal penjaga runtime pasca-boot (menangkap kesalahan yang tidak tertangkap; `MSM_EXIT_ON_FATAL=1` membuatnya keluar keras untuk penyebaran yang diawasi).
9. Mulai layanan latar belakang: perantara WS, pengindeks penyimpanan, watcher crash + inventaris, penjadwal, jembatan peristiwa Discord, watcher jangkauan chatbot, dan **timer pemeliharaan harian** (pangkas baris analitik lama, transkrip chatbot, riwayat peristiwa (365 hari) dan baris cache API, lalu snapshot
   `panel.db`).
10. Inisialisasi Docker **di latar belakang**. UI sepenuhnya dapat digunakan saat daemon mati;
    fitur Docker menyala saat menjadi dapat dijangkau. Setelah terhubung, `refreshStatuses({ boot })`
    mengkonsiliasi status yang di-cache, mengeluarkan peristiwa `offline-after-restart` satu kali untuk server yang aktif sebelum panel dimulai ulang dan tidak akan dibawa kembali, dan loop boot memulai
    server `auto_start` ditambah memulihkan server `auto_restart` yang ditemukan crash selama pemadaman
    (menghormati backoff loop crash).

> Urutan instrument-sebelum-preflight adalah pertukaran yang disengaja: ini memungkinkan pengkabelan Sentry di masa mendatang
> menambal runtime terlebih dahulu, dengan mengorbankan pesan yang sedikit kurang ramah pada Node yang sangat kuno.

## Pipeline Build

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM dengan pemisahan kode). `postinstall` menjalankan **hanya CSS**. `public/css/app.css`
dan `public/dist/` adalah artefak build yang diabaikan git; tahap build Dockerfile menjalankan `pnpm run build` penuh
dan menyalin `public/` ke dalam image runtime. Aset statis disajikan
`immutable`/cache panjang untuk file yang diberi sidik jari, cache pendek untuk CSS/JS, dan `no-cache` untuk HTML dan
`/api`.
