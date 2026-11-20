---
title: 'Peta langsung'
description: 'Aktifkan peta 3D langsung BlueMap dari dunia server dalam satu klik, disajikan hanya melalui login panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Tab **Dunia → Peta** sebuah server menampilkan peta 3D langsung yang dapat diperbesar dari dunia servernya, yang digambar oleh [BlueMap](https://bluemap.bluecolored.de/) (gratis dan sumber terbuka), dengan posisi pemain dan setiap dimensi. Panel menginstalnya, mengonfigurasinya, dan menyajikannya; Anda tidak perlu membuka port atau mengedit file konfigurasi untuknya.

## Menghidupkannya

1. Buka server, lalu **Dunia → Peta**.
2. Tekan **Aktifkan Peta Langsung**. Panel akan menginstal build BlueMap yang cocok dengan loader server dan versi Minecraft dari Modrinth, menerima unduhan sumber daya BlueMap untuk Anda, dan memilih port gratis untuknya.
3. Mulai ulang server (perubahan berlaku pada saat server dimulai berikutnya, dan server ditandai sebagai menunggu satu kali).

BlueMap merender di latar belakang, jadi peta baru membutuhkan beberapa menit untuk menggambar ubin pertamanya. Sampai saat itu, tab akan menyatakan peta belum siap dan akan memeriksa lagi secara mandiri. Setelah siap, **Layar Penuh** akan membuka peta di tab peramban terpisah.

Ini berfungsi pada server dengan loader mod (Fabric, Quilt, Forge, NeoForge) dan pada server plugin (Paper, Purpur, dan keluarga Paper lainnya, Spigot), termasuk server modpack. Server Vanilla tidak memiliki build BlueMap, dan tab akan menyatakan demikian.

## Siapa yang dapat melihatnya

Peta hanya disajikan melalui panel, di balik proses masuknya: siapa pun yang dapat melihat server di panel dapat membuka petanya, dan tidak ada orang lain. Port BlueMap sendiri tidak pernah dimaksudkan untuk dibuka ke internet ([port sekilas](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Menghidupkan atau mematikan peta memerlukan izin **Pengaturan** server ([pengguna & peran](/docs/users-and-roles/#per-server-permissions)).

Ketika panel itu sendiri berjalan di Docker, ia menjangkau BlueMap di dalam kontainer server; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) menjelaskan detail untuk penyiapan reverse-proxy.

## Mematikannya

**Nonaktifkan Peta** akan menghapus jar BlueMap yang diinstal panel dan membebaskan portnya, lagi-lagi mulai dari restart berikutnya. Dunia itu sendiri tidak tersentuh; ubin peta yang dirender tetap berada di folder server hingga Anda menghapusnya di tab **File**.

Terkait: [dunia & file](/docs/worlds-and-files/), [undangan & halaman status](/docs/invites-and-status-page/).
