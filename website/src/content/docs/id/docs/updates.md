---
title: 'Pembaruan'
description: 'Lacak dan terapkan pembaruan untuk versi Minecraft, modpack, mod, dan plugin di setiap server, dengan kebijakan per server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Pembaruan** melacak apa yang sudah usang di seluruh armada Anda di satu tempat:

- Versi **Modpack** ([modpacks](/docs/modpacks/)) dibandingkan dengan Modrinth / CurseForge / indeks rilis GTNH.
- **Konten kustom** yang Anda tambahkan sendiri (mod, datapack, resource pack, plugin), masing-masing dibandingkan dengan sumbernya: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), atau GitHub Releases. Pencarian GitHub menggunakan validasi ulang ETag, sehingga pemeriksaan harian hampir tidak menyentuh batas tarifnya.
- Keusangan **gambar Docker**: ID gambar kontainer setiap server dibandingkan dengan tag yang baru saja ditarik (dide-duplikasi di seluruh server pada tag yang sama), ditawarkan sebagai peningkatan yang hanya dapat dibangun ulang.
- **Penandaan versi mandiri**: untuk server tanpa paket yang dikelola, penandaan `mc_version` eksplisit dibandingkan dengan manifes Mojang, dan variabel lingkungan penandaan pemuat-bangun eksplisit (`PAPER_BUILD`, `FORGE_VERSION`, dan sejenisnya) dibandingkan dengan registri pemuat. Bangunan Paper berasal dari **API Fill v3** PaperMC saat ini (titik akhir v2 lama berhenti menerima versi Minecraft baru). Pada server dengan mod, versi Minecraft yang lebih baru hanya ditawarkan setelah [pemeriksaan versi](#minecraft-version-compatibility) menunjukkan bahwa setiap mod yang terinstal memiliki bangunan untuknya. Server Forge yang ditandai ditawarkan bangunan yang direkomendasikan oleh Forge, tidak pernah bangunan yang lebih tua dari yang ditandai, dan server yang ditandai ke rilis tidak pernah ditawari pra-rilis (yang sudah dalam beta dapat ditawari beta yang lebih baru atau rilis). Menerapkan bangunan pemuat mengambil cadangan pra-pembaruan terlebih dahulu. Memindahkan server Forge atau NeoForge ke versi Minecraft baru akan menghapus nomor bangunan pemuat yang ditandai, karena bangunan dibuat untuk satu versi Minecraft; kata kunci seperti `latest` dipertahankan, karena mengikuti versi dengan sendirinya. Untuk memilih bangunan tertentu sendiri, lihat [mengubah versi pemuat mod](#changing-the-mod-loader-version).

![Pembaruan](/docs/images/updates.png)

## Cara kerja

Panel memeriksa versi yang ditandai dari setiap server terhadap sumber hulu dan mencantumkan apa pun yang memiliki rilis yang lebih baru. Jumlah yang cocok juga muncul di ubin "Pembaruan tersedia" di [dasbor](/docs/dashboard/).

Pemeriksaan berjalan setiap hari pada [jadwal](/docs/schedules/) default dan sesuai permintaan dengan **Periksa Semua Sekarang**. **Abaikan** pada baris menghentikan penawaran versi tertentu itu; yang lebih baru akan ditawarkan lagi. **Kebijakan** pembaruan adalah per server: panel membiarkan semuanya manual (default, yang juga membuat server tidak muncul di halaman ini), hanya memberi tahu Anda, atau menerapkan pembaruan paket itu sendiri ([kebijakan pembaruan](/docs/modpacks/#update-policy)).

## Kompatibilitas versi Minecraft

Versi Minecraft yang lebih baru bukanlah peningkatan jika mod Anda tidak dapat ikut serta. Setiap server memiliki tab **Versi** sendiri (di bawah Mod) yang menjawab pertanyaan itu:

- Versi yang dijalankan server sekarang, dan **versi tertinggi yang dimiliki setiap mod yang terinstal**.
- Satu baris yang dapat dilipat per versi Minecraft mendatang, dengan berapa banyak mod yang siap dan berapa banyak yang belum dipublikasikan. Buka baris untuk melihat mod mana yang akan tertinggal, dan mana yang baik-baik saja.

![Kompatibilitas versi](/docs/images/server-versions.png)

Tekan **Periksa Versi Mendatang** untuk menjalankannya. Tidak ada yang memindai dengan sendirinya: pemeriksaan membaca setiap jar di folder mod server dan menanyakan Modrinth dan CurseForge tentang masing-masing, jadi itu hanya terjadi ketika Anda memintanya. Kemajuan dan hasil parsial ditulis saat berjalan, jadi menutup halaman atau menyegarkan tidak akan kehilangan apa pun, dan pemeriksaan yang terputus oleh restart panel akan mengatakannya dan menawarkan untuk berjalan lagi. Semua yang telah diselesaikan oleh pemeriksaan yang terputus akan disimpan, jadi menjalankannya lagi tidak akan mengulang pekerjaan itu.

Laporan hanya menjelaskan server yang dibuatnya. Ubah versi Minecraft, pemuat, atau mod itu sendiri (tambahkan satu, hapus satu, perbarui satu) dan laporan ditandai usang dan berhenti digunakan, sampai Anda menjalankan pemeriksaan lagi.

Mod diidentifikasi dari daftar file modpack itu sendiri jika ada, dan sebaliknya berdasarkan konten file, dengan cara yang sama peluncur mengenali jar. Dua jenis mod tidak dapat dijawab, dan keduanya tidak ditebak:

- **Tidak dapat diidentifikasi**: jar yang dibuat dengan tangan atau bangunan pribadi yang tidak dikenali oleh registri mana pun.
- **Tidak dapat diperiksa**: mod dari GitHub Releases, Hangar, atau SpigotMC, atau mod yang proyeknya telah dihapus. Ini tidak mempublikasikan daftar versi Minecraft mana yang untuk setiap bangunan.

Selama salah satunya terinstal, panel tidak akan menawarkan pembaruan versi Minecraft satu klik sama sekali, karena tidak dapat secara jujur mengatakan apa yang akan rusak. Menerapkan versi di atas apa yang didukung mod akan ditolak, dan akan menyebutkan mod yang memblokirnya.

Mod yang Anda **nonaktifkan** tidak berperan: server tidak memuatnya, jadi mematikan mod adalah cara nyata untuk melewati pemblokir. Menghidupkan atau mematikan mod menandai laporan untuk diperiksa ulang.

Ini mencakup server yang menjalankan mod: Fabric, Forge, NeoForge, dan Quilt. Server plugin bergaya Paper mempertahankan perilaku rilis terbaru yang biasa dan tidak memiliki tab Versi, karena dua dari registri tempat plugin berasal tidak mempublikasikan apa pun yang dapat dibaca oleh pemeriksaan.

![Versi dibuka, menunjukkan mod mana yang akan tertinggal](/docs/images/server-versions-expanded.png)

Membuka versi akan mencantumkan mod tanpa bangunan untuknya terlebih dahulu (yang menentukan jawabannya) dan menyimpan yang siap di balik klik. Paket besar memuat halaman mod sekaligus, jadi server 300 mod terbuka secepat server lima mod.

## Mengubah versi pemuat mod

Tab **Versi** juga memiliki kartu **Versi Pemuat**. Ini menunjukkan bangunan Forge, NeoForge, Fabric, atau Quilt mana yang terinstal di server dan, jika dapat diubah, pemilih untuk beralih ke yang lain.

- **Server Forge, NeoForge, Fabric, atau Quilt** dapat menjalankan bangunan apa pun yang dipublikasikan. Pemilih mencantumkan bangunan terbaru untuk versi Minecraft server, dengan bangunan Forge yang direkomendasikan dan terbaru diberi label. **Bangunan Lain…** mengambil bangunan lama apa pun berdasarkan nomornya, dan **Default** kembali ke membiarkan server memilih.
- **Modpack Forge atau Fabric CurseForge** menginstal versi pemuat yang dinyatakan oleh manifesnya sendiri, jadi cara biasa untuk mengubahnya adalah dengan memperbarui paket. Ketika paket itu sendiri mencantumkan versi yang salah (mod di dalamnya meminta Forge yang lebih baru daripada yang diinstal paket), kartu dapat menimpanya, dan **Versi Modpack** menghapus penimpaan lagi. Memperbarui paket juga menghapusnya, karena versi baru menyatakan pemuatnya sendiri. Jika versi baru masih mencantumkan yang salah, atur penimpaan lagi.
- **Modpack NeoForge CurseForge, atau modpack Modrinth,** menunjukkan pemuatnya tetapi tidak dapat ditimpa: gambar server hanya menerapkan penimpaan ke paket Forge dan Fabric. Pemuatnya mengikuti versi paket, jadi perbarui paket saja. Pemuat paket FTB juga tidak dapat diubah di sini. Kartunya biasanya tidak muncul, karena penginstal FTB sendiri menyimpan catatan yang tidak dibaca oleh panel.

Panel memeriksa bahwa bangunan tersebut ada sebelum menanyakan apa pun kepada Anda. Bangunan Forge atau NeoForge dibuat untuk satu versi Minecraft, jadi pada server yang mengikuti rilis terbaru, menandai salah satunya juga membuat server tetap pada versi Minecraft yang dijalankannya sekarang (konfirmasi mengatakannya). Memilih **Default** setelahnya menghapus penandaan tetapi mempertahankan versi Minecraft itu. Server yang mengikuti rilis terbaru juga dapat pindah ke gambar Java yang berbeda saat dibangun ulang, yang dibutuhkan versi itu. Server seperti itu yang belum pernah dimulai akan diminta untuk memulai terlebih dahulu, sehingga panel tahu versi tersebut. Forge melewati nomor bangunan (tidak ada 47.4.14 antara 47.4.13 dan 47.4.15), jadi mod yang "membutuhkan 47.4.14 atau di atasnya" dipenuhi oleh bangunan berikutnya, dan penolakan menyebutkannya. Perubahan mengambil cadangan pra-pembaruan, lalu membangun ulang server. Bangunan baru diinstal saat server dimulai berikutnya, dan kartu akan menunjukkannya sampai saat itu.

## Membatalkan pembaruan mod

Setiap bangunan dari mod yang diperbarui tetap ada di pustaka bersama, jadi pembaruan yang merusak sesuatu dapat dibatalkan. Baris mod di tab **Mod** mendapatkan tombol **Kembalikan** yang mengembalikan bangunan sebelumnya. Tidak ada unduhan, jadi ini berfungsi bahkan jika proyek tersebut telah dihapus dari registrinya. Bangunan yang Anda batalkan akan berhenti ditawarkan sampai yang lebih baru muncul.

![Kembalikan mod ke bangunan yang diperbarui darinya](/docs/images/mods-revert.png)

## Menerapkan pembaruan

Pembaruan tidak pernah diam. Ketika Anda memilih untuk meningkatkan paket (atau [mengalihkannya ke versi lain](/docs/modpacks/#changing-the-pack-version), termasuk yang lama), panel:

1. Mengambil **cadangan pra-pembaruan** (sehingga dapat dibatalkan; secara default 10 cadangan pra-pembaruan terakhir per server disimpan, lihat [retensi](/docs/backups/#retention)).
2. Menandai ulang versi baru yang tepat.
3. Membangun ulang server, memecahkan runtime Java jika diperlukan.
4. Memantau boot pertama, dengan anggaran waktu per platform.

Jika tidak berhasil, Anda akan kembali ke cadangan pra-pembaruan. Server yang melacak stabil tidak pernah ditawari beta, dan tautan changelog mengarah ke perbedaan per-versi yang sebenarnya di mana sumbernya menyediakannya. Pembaruan yang gagal juga memicu [peringatan](/docs/integrations/) Discord jika integrasi dikonfigurasi.
