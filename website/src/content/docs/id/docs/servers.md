---
title: 'Membuat & mengelola server'
description: 'Buat, mulai, hentikan, bangun ulang, dan konfigurasikan server Minecraft di panel: wizard pembuatan, pengaturan, memori, dan port game.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

## Membuat server

Klik **Buat Server** (bilah atas) atau kartu **Buat Server** untuk membuka wizard.

![Buat server](/docs/images/create-wizard.png)

Wizard akan mengisi awal heap Java dan kuota disk dari **Default untuk server baru** di halaman Pengaturan, yang dapat diubah oleh admin kapan saja. Server baru juga mengambil batas CPU-nya dari sana.

![Default untuk server baru](/docs/images/settings-defaults.png)

Anda memilih:

- **Nama** (dan deskripsi, ikon, serta warna aksen opsional). Tag untuk mengorganisir armada Anda ditambahkan nanti, di pengaturan server.
- **Jenis server**: Vanilla, Paper, atau Purpur di tab **Vanilla**. Untuk server yang dimodifikasi, tab **Dari Mod** memilih loader (Fabric, Forge, NeoForge, atau Quilt), versi Minecraft, dan build loader (terbaru, atau yang spesifik), lalu memungkinkan Anda mencari mod.
- **Versi Minecraft**: `LATEST`, snapshot, atau versi spesifik (termasuk beta dan alpha).
- **Port game**: port yang tersedia disarankan. Konsol jarak jauh (RCON) menggunakan port 1000 lebih tinggi (secara default). Anda dapat mengubahnya nanti (lihat [Mengubah port game](#changing-the-game-port)).
- **Sumber daya**: heap Java (batas memori kontainer diatur 50% di atasnya) dan kuota disk.

**Opsi Lanjutan** membuka semua pengaturan lain yang didukung oleh gambar server, ditambah variabel lingkungan tambahan dan (untuk admin) pengaturan Docker lanjutan.

Lebih suka modpack? Tab **Dari Modpack** menginstal paket CurseForge, Modrinth, atau GT New Horizons sebagai gantinya (lihat [Modpack](/docs/modpacks/)), atau mengambil **zip kustom yang Anda unggah**: `.mrpack` Modrinth, ekspor modpack CurseForge (`manifest.json`), atau zip apa pun berisi file mod. Manifest (atau suara mayoritas di antara jar yang teridentifikasi) mengisi loader dan versi Minecraft, dan setiap mod diinstal dalam satu tugas. Anda juga dapat memulai dari [Blueprint](/docs/blueprints/) yang disimpan di tab **Dari Blueprint**.

Panel secara otomatis memilih runtime Java yang sesuai untuk versi Anda, menarik gambar, membuat kontainer, dan memulainya, semuanya dari satu formulir.

## Daftar server

Halaman **Server** mencantumkan seluruh armada Anda dengan status dan statistik cepat.

![Daftar server](/docs/images/servers-list.png)

## Server tunggal

![Pemain](/docs/images/players.png)

Membuka server memberi Anda ruang kerja bertab:

- **Ringkasan**: alamat untuk dibagikan dengan pemain, deskripsi, penggunaan langsung, dan siapa yang sedang online.
- **Konsol**: aliran log langsung dan input perintah, obrolan dalam game, dan [perintah obrolan](/docs/console-and-chat/).
- **Pemain**: daftar pemain, ditambah inventaris dan statistik.
- **Mod**: daftar mod yang terinstal, [peramban mod](/docs/modpacks/), dan pembaruan konten. Di server yang dimodifikasi, sub-tab **Versi**-nya memeriksa versi Minecraft mendatang mana yang memiliki build untuk mod Anda ([pembaruan](/docs/updates/#minecraft-version-compatibility)).
- **Dunia**: [dunia, peta langsung, dan pengelola file](/docs/worlds-and-files/).
- **Cadangan**: [snapshot dan pemulihan](/docs/backups/) untuk server ini.
- **Pemantauan**: riwayat per server dan metrik langsung, termasuk laporan crash (lihat di bawah).
- **Pengaturan**: **Konfigurasi** (semua tentang cara server berjalan), ditambah [integrasi](/docs/integrations/) (Discord, Halaman Status, Undangan, dan, untuk admin, Chatbot).

Kontrol mulai, berhenti, dan mulai ulang berada di header di atas setiap tab. Apa yang dapat Anda lakukan di setiap tab bergantung pada [izin Anda di server tersebut](/docs/users-and-roles/#per-server-permissions): misalnya, sub-tab **File** memerlukan izin File, dan mengirim perintah konsol memerlukan Konsol.

![Ringkasan server](/docs/images/server-overview.png)

Rel **Kontrol Dunia** berjalan di setiap tab: jam dalam game, cuaca, gamerule umum sebagai chip toggle, dan "Tampilkan semua aturan dunia" untuk sisanya.

![Kontrol dunia](/docs/images/world-controls.png)

**Pemantauan → Langsung** menampilkan TPS dan milidetik per tick, kartu kesehatan dan stabilitas dengan crash (24 jam terakhir dan 7 hari), pembunuhan kehabisan memori, dan mulai ulang otomatis, serta ukuran per dunia.

![Pemantauan langsung](/docs/images/monitoring-live.png)

## Pengaturan server

**Pengaturan → Konfigurasi** adalah permukaan konfigurasi lengkap: nama, deskripsi, MOTD, ikon, warna dan tag, sumber daya, port game, kebijakan pembaruan, mulai saat boot panel dan mulai ulang otomatis saat crash, setiap variabel lingkungan yang didukung oleh gambar server, pengaturan Docker lanjutan, dan ekspor blueprint, salin, bangun ulang, dan hapus. Perubahan yang hanya berlaku setelah server dibangun ulang disimpan segera dan menunggu: tombol **Terapkan Perubahan** muncul di header server, dan perubahan tersebut juga diterapkan saat server dimulai berikutnya.

**Mulai ulang otomatis saat crash** memulai kembali server yang crash, menunggu lebih lama di antara setiap percobaan (5, 10, lalu 20 detik) dan berhenti setelah 3 percobaan dalam 10 menit. Ini melewati crash yang dikenali panel sebagai masalah penyiapan (EULA, Java yang salah, dunia dari versi yang lebih baru, port yang digunakan, kehabisan memori, kunci CurseForge yang hilang), karena itu memerlukan perbaikan terlebih dahulu. Jika tindakan lain sedang sibuk dengan server (cadangan, pemulihan, perubahan port), ia menunggu hingga 30 menit, dan menyerah segera setelah seseorang menghentikan atau memulai server sendiri.

Perubahan pengaturan langsung selalu berlaku di seluruh mulai ulang. Perubahan PvP atau kesulitan yang dibuat dengan rel **Kontrol Dunia**, pengalihan daftar putih di tab **Pemain**, atau pengeditan `server.properties` di editor **File** menghapus variabel lingkungan yang cocok (jika ada yang diatur) dan menandai server untuk dibangun ulang, sehingga nilai di disk menang daripada ditegaskan kembali oleh gambar kontainer pada mulai ulang berikutnya.

![Pengaturan server](/docs/images/server-settings.png)

**Tentang pengukur memori.** "RAM (heap Java)" diberikan ke Java sebagai heap awal dan maksimumnya, dan Java mengisi heap yang diberikan di muka dalam menit pertama, dengan atau tanpa preset flag Aikar / MeowIce. Jadi pengukur memori menetap di sekitar ukuran heap dan tetap di sana bahkan ketika tidak ada yang bermain; tanda pada pengukur menandai di mana heap berada di bawah batas kontainer, dan catatan di bawahnya menyatakan demikian. Jika Anda lebih suka melihat memori mengikuti penggunaan nyata, berikan heap awal yang lebih kecil ke server dengan **Heap Awal** di kartu Sumber Daya pada **Pengaturan → Konfigurasi** (atau di bawah **Opsi Lanjutan** di wizard), misalnya 512 MB: pada heap 2 GB yang membawa penggunaan idle dari 2,6 GB menjadi sekitar 1,3 GB dalam pengukuran kami. Java juga membutuhkan memori di luar heap (sekitar 0,5 GB pada vanilla, 1,5 hingga 2 GB pada modpack besar), yang merupakan tempat ruang kepala batas kontainer diperuntukkan. Lihat README "Dua batas memori" untuk angka-angkanya.

> **Pengaturan Docker Lanjutan** (nama kontainer, jaringan Docker, pemetaan port tambahan, dan pengikatan volume tambahan) **hanya untuk admin**, karena bind mount ditambah akses Docker panel secara efektif adalah root pada host. Lihat [Pengguna & peran](/docs/users-and-roles/).

### Mengubah port game

Kartu **Port Game** di **Pengaturan → Konfigurasi** memindahkan server ke port lain kapan saja, dengan tombol **Simpan Port** sendiri. **Gunakan Port Bebas Berikutnya** memilih yang terendah yang tersedia, dan kartu memeriksa port apa pun yang Anda masukkan sebelum Anda menyimpannya. RCON selalu mengikuti pada 1000 di atas port game (offset default). Admin dapat memilih port apa pun mulai dari 1024 ke atas; semua orang memilih dari port game pertama (25565 secara default) ke atas. Menyimpan menerapkan perubahan segera: server yang dihentikan hanya pindah, dan server yang berjalan meminta terlebih dahulu, lalu memulai ulang pada port baru (dunia disimpan terlebih dahulu, dan pemain terhubung kembali pada port baru). Jika server tidak dapat dimulai pada port baru, ia kembali ke port lama. Perubahan ditolak saat perubahan lain menunggu **Terapkan Perubahan**, jadi terapkan perubahan tersebut terlebih dahulu. Mengubah port memerlukan izin Pengaturan pada server tersebut.

![Kartu Port Game](/docs/images/server-port.png)

![Prompt sebelum server yang berjalan dimulai ulang pada port barunya](/docs/images/port-restart.png)

## Laporan crash & analisis mclo.gs

Laporan crash (`crash-reports/*.txt` dan file JVM `hs_err_pid*.log`) diambil secara otomatis, diurai menjadi ringkasan satu baris dengan pengecualian dan mod yang dicurigai, dan terdaftar di bawah **Pemantauan → Riwayat**:

![Kartu laporan crash](/docs/images/crash-mclogs-card.png)

Setiap kartu laporan menawarkan penampil bawaan (dengan bagian yang dapat dilipat dan pengecualian yang disorot), salin-stack-trace, dan unduh, ditambah dua tindakan [mclo.gs](https://mclo.gs):

- **Bagikan ke mclo.gs** mempublikasikan laporan sebagai paste publik dan menyalin tautannya: hal yang persis diminta oleh penulis mod dan Discord dukungan. Tautan diingat pada laporan, jadi tidak ada yang pernah diunggah dua kali.
- **Analisis** menjalankan wawasan otomatis mclo.gs pada paste: masalah yang diketahui dengan perbaikan yang disarankan (dependensi yang hilang, ketidakcocokan versi, konflik mod umum), dirender langsung di panel.

![Wawasan mclo.gs](/docs/images/crash-insights.png)

Kedua tindakan tersebut berada di balik konfirmasi eksplisit, karena paste bersifat publik: laporan crash dapat menyertakan nama pemain dan daftar mod lengkap Anda. Panel tidak pernah mengunggah apa pun dengan sendirinya.
