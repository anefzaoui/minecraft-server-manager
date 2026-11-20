---
title: 'Memulai'
description: 'Instal Minecraft Server Manager dan selesaikan penyiapan pertama: pemeriksaan sistem, zona waktu Anda, dan akun admin.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

## Pengaturan Awal

Saat pertama kali membuka panel, Anda akan dipandu melalui wizard pengaturan singkat:

1.  **Pemeriksaan Sistem** memastikan Docker dapat dijangkau, Node.js cukup baru, dan folder data dapat ditulis. Jika Docker belum berjalan, Anda masih bisa melanjutkan; pembuatan dan memulai server akan menunggu hingga Docker berjalan.
2.  **Buat Akun Admin Anda**. Ini adalah satu-satunya akun yang ada sampai Anda menambahkan yang lain, dan akun ini memiliki kontrol penuh. Pilih nama pengguna (2 hingga 32 karakter) dan kata sandi minimal 8 karakter. Anda akan langsung masuk setelah akun dibuat.
3.  **Konfigurasi Panel** (opsional): domain publik untuk ditampilkan kepada pemain di alamat koneksi, kunci API CurseForge, dan zona waktu Anda. Semuanya dapat diubah nanti di **Pengaturan**.

Langkah terakhir menawarkan **Buat Server** atau **Buka Dasbor**.

![Langkah Pemeriksaan Sistem pada pengaturan awal](/docs/images/setup-system-check.png)

> **Instalasi yang Terbuka Dilindungi PIN.** Jika Anda memulai panel yang terikat ke alamat non-loopback (`PANEL_HOST` selain `127.0.0.1`), halaman pengaturan juga akan meminta **PIN 6 digit**. Panel akan mencetaknya ke konsolnya saat startup. Masukkan PIN tersebut bersama dengan nama pengguna dan kata sandi Anda. Ini mencegah orang asing yang mencapai port terlebih dahulu mengklaim akun admin. PIN akan hilang setelah akun admin dibuat.

## Masuk

Setelah pengaturan, panel dilindungi oleh layar masuk. Masukkan nama pengguna dan kata sandi Anda untuk melanjutkan.

![Masuk](/docs/images/login.png)

Jika [otentikasi dua faktor](/docs/two-factor-authentication/) diaktifkan pada akun Anda, Anda akan diminta kode 6 digit dari aplikasi autentikator Anda tepat setelah kata sandi.

## Menjelajahi Antarmuka

Semuanya tertata di bilah sisi kiri:

- **Dasbor** - semua server dalam sekejap ([detail](/docs/dashboard/)).
- **Server**, **Modpack**, **Dunia**, **Blueprint** - membuat dan mengelola server serta kontennya.
- **Pembaruan**, **Cadangan**, **Jadwal**, **Penyimpanan**, **Aktivitas** - sisi operasional: apa yang kedaluwarsa, snapshot Anda, otomatisasi, penggunaan disk, dan log audit.
- **Izin** (bawah, hanya admin): apa yang boleh dilakukan setiap pengguna di setiap server ([detail](/docs/users-and-roles/#per-server-permissions)).
- **Pengaturan** (bawah, hanya admin): kunci API, konfigurasi panel, default untuk server baru, [retensi cadangan](/docs/backups/#retention), pengguna, keamanan masuk, dan API publik.

Di bawah itu, bilah sisi mencantumkan server Anda. Membuka salah satunya akan menampilkan tabnya sendiri: **Ringkasan**, **Konsol**, **Pemain**, **Mod**, **Dunia**, **Cadangan**, **Pemantauan**, dan **Pengaturan**, sebagian besar dengan sub-tab terkait (misalnya, **Pengaturan → Konfigurasi** berisi pengaturan server dan port gamenya). Lihat [Satu Server](/docs/servers/#a-single-server).

Bilah atas memiliki tombol **Buat Server**, **pengalih tema** (gelap/terang), dan **menu akun** Anda, tempat Anda dapat mengubah gambar profil, mengelola [otentikasi dua faktor](/docs/two-factor-authentication/), atau keluar.

## Di Ponsel atau Tablet

Setiap halaman dirancang terlebih dahulu untuk layar sempit dan melebar dari sana: bilah sisi tersembunyi di balik tombol menu, tabel data ditumpuk menjadi kartu, bilah alat membungkus, dan rel kontrol dunia menyusut menjadi kartu yang Anda buka saat dibutuhkan. Tombol dan chip memiliki ukuran target sentuh yang nyata. Tidak ada yang khusus desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dasbor di ponsel" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Ringkasan server di ponsel" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsol di ponsel" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Tab Mod di ponsel" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Kompatibilitas versi di ponsel" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Pengaturan di ponsel" width="180">
</p>

## Apa yang Anda Butuhkan

Panel berkomunikasi dengan Docker untuk menjalankan server, jadi panel memerlukan akses ke daemon Docker (Docker Desktop atau soket Docker Engine). Saat Docker dapat dijangkau, ubin Docker di dasbor akan menampilkan **Terhubung** dan versinya. Jika tidak, panel tetap berjalan. Anda hanya tidak dapat memulai server sampai daemon aktif.

## Langkah Selanjutnya

- [Buat server pertama Anda →](/docs/servers/)
- [Amankan akun Anda dengan 2FA →](/docs/two-factor-authentication/)
