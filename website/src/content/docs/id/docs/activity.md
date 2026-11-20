---
title: 'Log aktivitas'
description: 'Halaman Aktivitas adalah jejak audit lengkap: catatan kronologis yang dapat dicari dari semua yang terjadi di panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Aktivitas** adalah jejak audit lengkap: catatan kronologis yang dapat dicari dari semua yang terjadi di panel. Filter berdasarkan server atau jenis kejadian, cari ringkasan, dan ekspor hasil filter Anda sebagai CSV atau JSON. Entri yang menangkap log (misalnya, _crash_) akan membukanya di tempat.

![Aktivitas](/docs/images/activity.png)

## Apa yang dicatat

- **Otentikasi**: masuk (termasuk apakah 2FA atau kode cadangan digunakan), penguncian akun, perubahan kata sandi, dan pengaktifan, penonaktifan, atau pengaturan ulang 2FA.
- **Siklus hidup server**: pembuatan, mulai, penghentian, restart, _crash_, restart otomatis, dan kejadian kehabisan memori (_out-of-memory_).
- **Peringatan**: _boot_ tertunda, kegagalan penghentian, jadwal gagal, penghentian kuota, kontainer tidak sehat, mati setelah restart (_offline-after-restart_).
- **Data**: pencadangan dibuat dan dipulihkan, cetak biru diekspor, paket diinstal dan ditingkatkan, perubahan mod dan dunia, serta pengeditan file.
- **Pemain**: tendangan (_kick_), larangan (_ban_), perubahan daftar putih (_whitelist_) dan operator (_op_), serta catatan pemain.
- **Konfigurasi**: perubahan perintah obrolan (_chat-command_), perubahan pengguna dan peran, perubahan izin per server, perubahan port game, dan pengeditan pengaturan.

Setiap entri mencatat siapa yang melakukannya (nama pengguna, atau panel/penjadwal untuk tindakan otomatis), server mana yang terkait, dan kapan. [Dasbor](/docs/dashboard/) menampilkan entri terbaru; halaman ini adalah riwayat lengkap. Operator dan penampil hanya melihat entri untuk server yang dapat mereka lihat (ditambah yang berlaku untuk seluruh panel), dan perubahan izin per server hanya ditampilkan kepada admin. Kejadian siklus hidup dan peringatan juga dapat diteruskan ke Discord (lihat [Integrasi](/docs/integrations/)).

Karena menangkap kejadian yang relevan dengan keamanan (login, perubahan 2FA, perubahan peran dan izin), log aktivitas juga merupakan tempat pertama Anda jika ada sesuatu yang mencurigakan dengan sebuah akun.
