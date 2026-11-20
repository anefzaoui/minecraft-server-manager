---
title: 'Dasbor'
description: 'Dasbor adalah basis utama Anda: setiap server, status langsungnya, dan umpan aktivitas yang sedang berlangsung.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Dasbor adalah basis utama Anda: setiap server, status langsungnya, dan umpan terkini tentang apa yang telah terjadi.

![Dasbor](/docs/images/dashboard.png)

## Ubin ringkasan

Di bagian atas:

- **Server online**: berapa banyak server Anda yang sedang berjalan, dari jumlah total.
- **Pemain terhubung**: jumlah total pemain di semua server yang berjalan.
- **Pembaruan tersedia**: berapa banyak server, paket, atau mod yang memiliki versi lebih baru ([lihat Pembaruan](/docs/updates/)).
- **Docker**: apakah panel dapat menjangkau daemon Docker, dan versinya.

Baris kedua menambahkan **Memori yang dialokasikan** (dan berapa banyak yang digunakan), **Penyimpanan yang digunakan** di semua folder data server, **Kesehatan · 24 jam** (kerusakan, penghentian karena kehabisan memori, dan mulai ulang otomatis dalam sehari terakhir), dan **Pembaruan** yang dibagi menjadi pembaruan mod dan tingkat server. Di bawahnya, **Server berdasarkan Status** menghitung server Anda dalam setiap keadaan, dan **Tinjauan Sumber Daya** memetakan bagian memori dan CPU setiap server.

## Kartu server

Setiap server ditampilkan sebagai kartu dengan statusnya (Berjalan, Memulai, Berhenti, Rusak, dan keadaan di antaranya seperti Tidak Sehat atau Terhenti), jenis dan versi Minecraft, port game-nya, dan tag-nya. Setiap kartu menampilkan penggunaan **pemain** dan **disk** terhadap kuota; server yang berjalan juga menampilkan **CPU** dan **memori** langsung, yang diperbarui terus menerus.

Klik kartu untuk membuka server tersebut. Kartu kosong **Buat Server** dan tombol **Buat Server** di bilah atas keduanya memulai [wizard pembuatan](/docs/servers/).

Anda dapat mencari server Anda (berdasarkan nama, jenis, versi, atau tag), mengurutkannya berdasarkan status, nama, ukuran, terakhir dimulai, atau dibuat, dan beralih antara tata letak kisi dan daftar dengan tombol alih di sebelah kanan.

## Aktivitas terbaru

Umpan di bagian bawah menampilkan entri terbaru dari jejak audit panel yang dapat dibaca manusia: login, pencadangan, ekspor cetak biru, pemeriksaan pembaruan, perubahan perintah obrolan, server mulai dan berhenti, dan banyak lagi. Setiap entri ditandai dengan server yang menjadi miliknya (atau panel itu sendiri) dan berapa lama yang lalu itu terjadi. **Lihat Semua** membuka riwayat lengkap di halaman [Aktivitas](/docs/activity/).
