---
title: 'Dunia & Berkas'
description: 'Pustaka dunia, unggahan dan penukaran dunia, tab mod dan plugin, serta pengelola berkas di peramban.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

## Dunia

Halaman **Dunia** adalah perpustakaan dunia: setiap dunia yang tersimpan di satu tempat. **Unggah Dunia** mengambil arsip `.zip` atau `.tar` dan menemukan dunia di dalamnya secara otomatis, **Simpan ke Pustaka** membuat cuplikan dunia server yang sedang berjalan (berfungsi saat server berjalan), dan setiap dunia pustaka dapat diunduh atau diinstal ke server mana pun dengan **Instal ke…**. Menginstal akan mengganti dunia server (server harus dihentikan, dan dunianya saat ini akan dicadangkan terlebih dahulu) atau menambahkannya bersamaan, untuk diaktifkan nanti. Pemeriksaan kompatibilitas dijalankan sebelum setiap instalasi.

Tab **Dunia → Dunia** milik server mencantumkan dunia di server tersebut. Dari sana Anda dapat mengaktifkan dunia lain (dengan server dihentikan), mengunduh, menduplikasi, mengganti nama, atau [mengecilkan](/docs/world-shrink/) dunia, menyalinnya ke server lain, menghapus yang tidak aktif, dan mengatur ulang dunia aktif dengan seed baru, yang disimpan, atau kustom (cadangan keamanan ditawarkan terlebih dahulu). Pustaka yang sama berada di bawah, dengan **Instal di Sini**.

![Dunia](/docs/images/worlds.png)

## Manajer file

Di bawah bagian **Dunia** server, tab **File** adalah manajer file lengkap di peramban untuk direktori data server tersebut. Cantumkan, baca, edit, ganti nama, pindahkan, salin, hapus, dan unggah file, buat folder, dan cari teks file di bawah folder dengan **Temukan di File**: semua yang biasanya Anda lakukan melalui SSH, dari peramban.

![Manajer file](/docs/images/server-files.png)

File teks dibuka di editor dengan batas 8 MB; file yang lebih besar dapat diunduh. Unggahan menerima hingga 20 file sekaligus.

### Tetap di dalam sandbox

Setiap operasi file dibatasi pada direktori data server itu sendiri. Panel menyelesaikan setiap jalur dan menolak apa pun yang akan keluar: traversal `..`, jalur absolut, dan bahkan symlink yang menunjuk ke luar direktori (termasuk yang menggantung yang belum ada). Mod atau plugin tidak dapat menanam tautan untuk menipu manajer file agar membaca atau menulis di tempat lain di host.

## Mod

Untuk server modded dan plugin, tab **Mod** (grupnya sendiri di bilah sisi server) mengelola set mod: jelajahi dan tambahkan mod, dan lihat apa yang terinstal. Dari baris setiap mod yang terinstal, Anda dapat memperbaruinya (atau mengabaikan pembaruan itu), [mengembalikannya](/docs/updates/#undoing-a-mod-update), menonaktifkannya, atau menghapusnya, dan **Perbarui Semua** menerapkan setiap pembaruan yang tersedia dengan satu restart. Pembaruan mod dan paket juga muncul di halaman [Pembaruan](/docs/updates/).

### Menambahkan mod

![Mod](/docs/images/mods.png)

Empat cara masuk, semuanya dari bilah alat tab Mod:

- **Cari Mod**: cari **Modrinth atau CurseForge** (chip CurseForge muncul setelah kunci API disimpan di bawah **Pengaturan → Kunci API**), dan di server plugin juga **Hangar** (registri plugin PaperMC sendiri) dan **SpigotMC** (melalui proxy CDN Spiget), keduanya tanpa kunci. Tab **Datapack** mencari datapack Modrinth. Semuanya difilter ke pemuat dan versi Minecraft server (kotak centang juga menampilkan build yang tidak terdaftar sebagai kompatibel, dengan risiko Anda sendiri); server Quilt secara otomatis melihat build berlabel fabric juga, karena Quilt menjalankan mod fabric. Hasil yang sudah ada di server menampilkan lencana **Terinstal**. Jika penulis CurseForge melarang unduhan otomatis (atau sumber daya SpigotMC dihosting di luar situs), panel akan memberitahukannya di depan dan menawarkan jalur **Buka CurseForge** (atau **Buka SpigotMC**) + **Unggah Jar** alih-alih gagal di tengah instalasi.

  ![Pencarian Hangar](/docs/images/mods-search-hangar.png)

- **Impor Zip**: satu tombol, tiga bentuk, terdeteksi otomatis:
  - **Modpack Modrinth (`.mrpack`)**: setiap file yang disematkan dikanonisasi kembali ke proyek Modrinth-nya melalui pencarian hash (sehingga mod yang diimpor mempertahankan nama asli, ikon, dan tetap dapat diperiksa pembaruannya; file yang tidak diketahui Modrinth diinstal dari URL paket itu sendiri), diverifikasi terhadap checksum sha512 paket saat mengunduh, dan dipratinjau dengan hasil yang sesuai. File khusus klien dilewati dengan jelas, dan kedua pohon penimpaan (`overrides/`, lalu `server-overrides/`; salinan khusus server menang) dapat diterapkan.

    ![Impor mrpack](/docs/images/mrpack-import.png)

  - **Ekspor modpack CurseForge** (zip yang dihasilkan aplikasi CurseForge, dengan `manifest.json`): setiap mod yang disematkan diselesaikan secara massal, dipratinjau dengan peringatan (pemuat/MC salah untuk server ini, file tidak lagi ada di CurseForge, mod yang memerlukan unduhan manual), dan diinstal dengan kemajuan nyata. `overrides/` paket (konfigurasi, skrip) dapat diterapkan secara opsional juga; file apa pun yang akan ditimpa akan dicadangkan terlebih dahulu ke `.import-backups/<timestamp>/` di dalam folder server.
  - **Zip jar biasa** yang Anda kumpulkan sendiri: setiap jar diidentifikasi (kecocokan hash Modrinth → sidik jari CurseForge → metadata jar itu sendiri) dan dinilai terhadap server (_cocok / pemuat salah / versi MC salah / sudah terinstal / tidak teridentifikasi_), sehingga Anda memilih apa yang sebenarnya termasuk sebelum apa pun diinstal.
- **Tambahkan berdasarkan URL**: tempel hampir apa saja: halaman proyek Modrinth, CurseForge, Hangar, atau SpigotMC, URL repositori atau rilis GitHub (cukup `owner/repo` juga berfungsi; instalasi GitHub lebih memilih rilis stabil terbaru dan melewati jar sampingan `-sources`/`-javadoc`), slug Modrinth biasa, atau URL `.jar` langsung apa pun. Panel menyelesaikan build yang tepat untuk pemuat dan versi MC server.

  ![Tambahkan berdasarkan tautan](/docs/images/mods-add-by-link.png)

- **Unggah Jar** (dari fallback pencarian atau pemecah unduhan yang tertunda): jar yang diunggah diidentifikasi dengan cara yang sama, sehingga mereka mempertahankan nama asli, versi, ikon, dan menjadi dapat diperiksa pembaruannya.

Setiap instalasi registri **diverifikasi checksum saat mengunduh**: aliran diperiksa terhadap digest terkuat yang dipublikasikan registri (sha512 → sha256 → sha1 → md5) dan ketidakcocokan akan dibatalkan sebelum apa pun mendarat di server.

Seluruh zip (`.mrpack` termasuk) juga dapat **membuat server**: di tab **Dari Modpack** di wizard, unggah dan manifes paket (atau suara mayoritas di antara jar yang teridentifikasi) akan mengisi pemuat, versi Minecraft, dan build pemuat.
