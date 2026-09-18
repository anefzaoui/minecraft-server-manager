---
title: 'Dasbor'
description: 'Dasbor adalah basis utama Anda: setiap server, status langsungnya, dan umpan aktivitas yang sedang berlangsung.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Dasbor adalah basis utama Anda: setiap server, status langsungnya, dan umpan aktivitas yang sedang berlangsung.

![Dasbor](/docs/images/dashboard.png)

## Ubin ringkasan

Di bagian atas:

- **Server online** - berapa banyak server Anda yang sedang berjalan.
- **Pemain terhubung** - jumlah total pemain di semua server yang berjalan.
- **Pembaruan tersedia** - berapa banyak server, paket, atau mod yang memiliki versi lebih baru ([lihat Pembaruan](/docs/updates/)).
- **Docker** - apakah panel dapat menjangkau daemon Docker, dan versinya.

## Kartu server

Setiap server ditampilkan sebagai kartu dengan statusnya (Berjalan, Memulai, Berhenti, Gagal), jenis dan versi Minecraft, serta port gamenya. Untuk server yang berjalan, Anda juga mendapatkan penggunaan **pemain**, **CPU**, **memori**, dan **disk** secara langsung, yang diperbarui terus menerus.

Klik kartu untuk membuka server tersebut. Kartu kosong **Buat server** dan tombol **Buat Server** di bilah atas keduanya memulai [panduan pembuatan](/docs/servers/).

Anda dapat mencari dan mengurutkan server Anda, serta beralih antara tata letak kisi dan daftar dengan tombol alih di sebelah kanan.

## Aktivitas terbaru

Umpan di bagian bawah adalah jejak audit langsung yang dapat dibaca manusia: login, pencadangan, ekspor cetak biru, pemeriksaan pembaruan, perubahan perintah obrolan, server mulai dan berhenti, dan banyak lagi. Setiap entri ditandai dengan server yang dimilikinya (atau panel itu sendiri) dan berapa lama yang lalu itu terjadi. Riwayat lengkap ada di halaman [Aktivitas](/docs/activity/).
