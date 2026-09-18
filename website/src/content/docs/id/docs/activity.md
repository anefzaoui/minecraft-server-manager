---
title: 'Log aktivitas'
description: 'Halaman Aktivitas adalah jejak audit lengkap: catatan kronologis yang dapat dicari dari semua yang terjadi di panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Aktivitas** adalah jejak audit lengkap: catatan kronologis yang dapat dicari dari semua yang terjadi di panel.

![Aktivitas](/docs/images/activity.png)

## Apa yang dicatat

- **Otentikasi** - masuk (termasuk apakah 2FA atau kode cadangan digunakan), dan 2FA diaktifkan, dinonaktifkan, atau direset.
- **Siklus hidup server** - pembuatan, mulai, berhenti, mulai ulang, crash, dan kejadian kehabisan memori.
- **Peringatan** - boot tertunda, kegagalan berhenti, jadwal gagal, berhenti karena kuota, kontainer tidak sehat, offline-setelah-mulai ulang.
- **Data** - pencadangan dibuat dan dipulihkan, cetak biru diekspor, instalasi dan peningkatan paket.
- **Konfigurasi** - perubahan perintah obrolan, perubahan peran, dan pengeditan pengaturan.

Setiap entri mencatat siapa yang melakukannya (nama pengguna, atau panel/penjadwal untuk tindakan otomatis), server mana yang terkait, dan kapan. [Dasbor](/docs/dashboard/) menampilkan entri terbaru; halaman ini adalah riwayat lengkap. Kejadian siklus hidup dan peringatan juga dapat diteruskan ke Discord (lihat [Integrasi](/docs/integrations/)).

Karena menangkap kejadian yang relevan dengan keamanan (login, perubahan 2FA, perubahan peran), log aktivitas juga merupakan tempat pertama Anda jika ada yang terlihat tidak beres dengan sebuah akun.
