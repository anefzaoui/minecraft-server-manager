---
title: 'Dunia & file'
description: 'Halaman Dunia mengelola data dunia di seluruh server Anda: ganti dunia aktif, unggah dunia, atau unduh salah satunya.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Kembali ke indeks docs](/docs/)

## Dunia

Halaman **Dunia** mengelola data dunia di seluruh server Anda: ganti dunia yang aktif, unggah dunia, atau unduh salah satunya.

![Dunia](/docs/images/worlds.png)

## Pengelola Berkas

Di bawah bagian **Dunia** server, tab **Berkas** adalah pengelola berkas lengkap di peramban untuk direktori data server tersebut. Cantumkan, baca, edit, buat, ganti nama, pindahkan, salin, hapus, dan unggah berkas: semua yang biasanya Anda lakukan melalui SSH, dari peramban.

![Pengelola Berkas](/docs/images/server-files.png)

Berkas teks dibuka di editor dengan batas 2 MB; berkas yang lebih besar dapat diunduh. Unggahan menerima banyak berkas sekaligus.

### Tetap di dalam kotak pasir

Setiap operasi berkas dibatasi pada direktori data server itu sendiri. Panel menyelesaikan setiap jalur dan menolak apa pun yang akan keluar: traversal `..`, jalur absolut, dan bahkan symlink yang menunjuk ke luar direktori (termasuk yang menggantung yang belum ada). Sebuah mod atau plugin tidak dapat menanam tautan untuk menipu pengelola berkas agar membaca atau menulis di tempat lain di host.

## Mod

Untuk server yang dimodifikasi, tab **Mod** (grupnya sendiri di bilah sisi server) mengelola kumpulan mod: jelajahi dan tambahkan mod, dan lihat apa yang terpasang. Pembaruan mod dan paket muncul di halaman [Pembaruan](/docs/updates/).

### Menambahkan Mod

![Mod](/docs/images/mods.png)

Empat cara masuk, semua dari bilah alat tab Mod:

- **Cari Mod** - cari **Modrinth atau CurseForge** (chip CurseForge muncul setelah kunci API disimpan di Pengaturan → Kunci API), dan di server plugin juga **Hangar** (registri plugin milik PaperMC) dan **SpigotMC** (melalui proxy CDN Spiget) - keduanya tanpa kunci. Semuanya difilter ke pemuat server dan versi Minecraft; server Quilt secara otomatis melihat build yang ditandai fabric juga, karena Quilt menjalankan mod Fabric. Hasil yang sudah ada di server menampilkan lencana **Terpasang**. Jika penulis CurseForge melarang unduhan otomatis - atau sumber daya SpigotMC dihosting di luar situs - panel akan memberitahukannya di muka dan menawarkan jalur **Buka Halaman** + **Unggah jar** alih-alih gagal di tengah instalasi.

  ![Pencarian Hangar](/docs/images/mods-search-hangar.png)

- **Impor zip** - satu tombol, tiga bentuk, terdeteksi otomatis:
  - **Paket mod Modrinth (`.mrpack`)**: setiap berkas yang disematkan dikanonisasi kembali ke proyek Modrinth-nya melalui pencarian hash (sehingga mod yang diimpor mempertahankan nama asli, ikon, dan tetap dapat diperiksa pembaruannya; berkas yang tidak diketahui Modrinth diinstal dari URL paket itu sendiri), diverifikasi terhadap checksum sha512 paket saat mengunduh, dan dipratinjau dengan hasil yang sesuai. Berkas khusus klien dilewati secara terlihat, dan kedua pohon penimpaan (`overrides/`, lalu `server-overrides/` - salinan khusus server menang) dapat diterapkan.

    ![Impor mrpack](/docs/images/mrpack-import.png)

  - **Ekspor paket mod CurseForge** (zip yang dihasilkan aplikasi CurseForge, dengan `manifest.json`): setiap mod yang disematkan diselesaikan secara massal, dipratinjau dengan peringatan (pemuat/MC yang salah untuk server ini, berkas tidak lagi ada di CurseForge, mod yang memerlukan unduhan manual), dan diinstal dengan kemajuan nyata. `overrides/` paket (konfigurasi, skrip) juga dapat diterapkan secara opsional - berkas apa pun yang akan ditimpa akan dicadangkan terlebih dahulu ke `.import-backups/<timestamp>/` di dalam folder server.
  - **Zip jar biasa yang Anda kumpulkan sendiri**: setiap jar diidentifikasi (kecocokan hash Modrinth → sidik jari CurseForge → metadata jar itu sendiri) dan dinilai terhadap server - _cocok / pemuat salah / versi MC salah / sudah terpasang / tidak teridentifikasi_ - sehingga Anda memilih apa yang sebenarnya diperlukan sebelum apa pun terpasang.
- **Tambah berdasarkan tautan** - tempel hampir apa saja: halaman proyek Modrinth, CurseForge, Hangar, atau SpigotMC, repositori GitHub atau URL rilis (cukup `owner/repo` juga berfungsi - instalasi GitHub lebih memilih rilis stabil terbaru dan melewati berkas samping `-sources`/`-javadoc`), slug Modrinth kosong, atau URL `.jar` langsung apa pun. Panel menyelesaikan build yang tepat untuk pemuat dan versi MC server.

  ![Tambah berdasarkan tautan](/docs/images/mods-add-by-link.png)

- **Unggah jar** (dari fallback pencarian atau pemecah unduhan yang tertunda) - jar yang diunggah diidentifikasi dengan cara yang sama, sehingga mereka mempertahankan nama asli, versi, ikon, dan menjadi dapat diperiksa pembaruannya.

Setiap instalasi registri **diverifikasi checksum saat mengunduh**: aliran diperiksa terhadap digest terkuat yang dipublikasikan oleh registri (sha512 → sha256 → sha1 → md5) dan ketidakcocokan akan membatalkan sebelum apa pun mendarat di server.

Seluruh zip (termasuk `.mrpack`) juga dapat **membuat server**: di tab _Dari paket mod_ wizard, unggah dan manifes paket (atau suara mayoritas di antara jar yang teridentifikasi) akan mengisi pemuat, versi Minecraft, dan build pemuat.
