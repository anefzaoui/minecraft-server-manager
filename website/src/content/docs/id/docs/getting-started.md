---
title: 'Memulai'
description: 'Saat pertama kali membuka panel, Anda akan diminta untuk membuat akun administrator.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

## Pengaturan awal

Saat pertama kali membuka panel, Anda akan diminta untuk membuat akun administrator. Ini adalah satu-satunya akun yang ada sampai Anda menambahkan yang lain, dan akun ini memiliki kontrol penuh.

Pilih nama pengguna dan kata sandi dengan minimal 8 karakter. Itu saja: Anda masuk dan langsung diarahkan ke dasbor.

> **Instalasi yang terpapar dilindungi PIN.** Jika Anda memulai panel yang terikat ke alamat non-loopback (`PANEL_HOST` selain `127.0.0.1`), halaman pengaturan juga akan meminta **PIN 6 digit**. Panel akan menampilkannya di konsolnya saat startup. Masukkan bersama dengan nama pengguna dan kata sandi Anda. Ini mencegah orang asing yang mencapai port terlebih dahulu mengklaim akun admin. PIN akan hilang setelah akun admin dibuat.

## Masuk

Setelah pengaturan, panel dilindungi oleh layar login. Masukkan nama pengguna dan kata sandi Anda untuk melanjutkan.

![Masuk](/docs/images/login.png)

Jika [otentikasi dua faktor](/docs/two-factor-authentication/) diaktifkan pada akun Anda, Anda akan diminta kode 6 digit dari aplikasi otentikator Anda tepat setelah kata sandi.

## Menjelajahi

Semuanya terhubung ke bilah sisi kiri:

- **Dasbor** - semua server sekilas ([detail](/docs/dashboard/)).
- **Server**, **Modpack**, **Dunia**, **Blueprint** - membuat dan mengelola server dan kontennya.
- **Pembaruan**, **Cadangan**, **Jadwal**, **Penyimpanan**, **Aktivitas** - sisi operasional: apa yang sudah usang, snapshot Anda, otomatisasi, penggunaan disk, dan log audit.
- **Pengaturan** (bawah): pengguna, kunci API, dan konfigurasi panel.

Bilah atas memiliki tombol **Buat Server**, **pengalih tema** (gelap/terang), dan **menu akun** Anda, tempat Anda dapat mengelola [otentikasi dua faktor](/docs/two-factor-authentication/) atau keluar.

## Di ponsel atau tablet

Setiap halaman dirancang terlebih dahulu untuk layar sempit dan melebar dari sana: bilah sisi tersembunyi di balik tombol menu, tabel data ditumpuk menjadi kartu, bilah alat membungkus, dan rel kontrol dunia menyusut menjadi kartu yang Anda buka saat Anda membutuhkannya. Tombol dan chip memiliki ukuran target sentuh yang nyata. Tidak ada yang hanya untuk desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dasbor di ponsel" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Gambaran umum server di ponsel" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsol di ponsel" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Tab mod di ponsel" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Pengaturan di ponsel" width="180">
</p>

## Apa yang Anda butuhkan

Panel berkomunikasi dengan Docker untuk menjalankan server, jadi panel memerlukan akses ke daemon Docker (Docker Desktop atau soket Docker Engine). Ketika Docker dapat dijangkau, ubin Docker di dasbor akan menampilkan **Terhubung** dan versinya. Jika tidak, panel tetap berjalan. Anda hanya tidak dapat memulai server sampai daemon aktif.

## Langkah selanjutnya

- [Buat server pertama Anda →](/docs/servers/)
- [Amankan akun Anda dengan 2FA →](/docs/two-factor-authentication/)
