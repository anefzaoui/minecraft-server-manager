---
title: 'Integrasi'
description: 'Setiap server memiliki integrasinya di bawah grup Pengaturan: Discord, Halaman Status publik, Undangan sekali klik, dan tab Chatbot opsional (hanya admin).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Kembali ke indeks docs](/docs/)

Setiap server memiliki integrasinya di bawah grup **Pengaturan**: **Discord**, **Halaman Status** publik, **Undangan** sekali klik, dan tab **Chatbot** opsional (hanya admin). Halaman ini mencakup Discord; [undangan & halaman status](/docs/invites-and-status-page/) mencakup kedua hal tersebut, dan [chatbot](/docs/chatbot/) memiliki halaman tersendiri.

## Notifikasi Discord

Panel meneruskan peristiwa server ke saluran Discord melalui webhook. Tanpa bot, tanpa OAuth.

### Pengaturan

1. Di Discord: **Pengaturan Server → Integrasi → Webhook → Webhook Baru**. Pilih saluran dan salin URL webhook.
2. Di panel, buka tab **Pengaturan → Discord** server, tempelkan URL ke **URL Webhook**, aktifkan kartu, dan **Simpan**. URL disimpan terenkripsi (di penyimpanan saat diam yang sama dengan kunci API Anda).
3. Gunakan **Kirim Tes** untuk mengonfirmasi bahwa ini berfungsi.

![Integrasi Discord](/docs/images/integrations-discord.png)

Untuk mengganti URL yang tersimpan, tempelkan URL baru dan simpan; biarkan bidang kosong untuk mempertahankan yang ada. URL yang tersimpan ditampilkan tersamar (token disembunyikan).

### Apa yang dikirim

Notifikasi dikelompokkan ke dalam kategori yang dapat dialihkan. Semua aktif secara default.

| Kategori             | Peristiwa                                                    |
| -------------------- | ------------------------------------------------------------ |
| **Mulai / berhenti** | Server dimulai, server berhenti                              |
| **Crash**            | Crash, loop crash terdeteksi, laporan crash baru             |
| **Cadangan**         | Cadangan dibuat, cadangan dipulihkan                         |
| **Pembaruan**        | Pembaruan diterapkan, pembaruan dibatalkan, pembaruan gagal  |
| **Tendang / larang** | Pemain ditendang, pemain dilarang                            |
| **Peringatan**       | Hal-hal yang diam-diam membuat server rusak (lihat di bawah) |

### Kategori Peringatan

`Peringatan` adalah saluran "sesuatu membutuhkan perhatian manusia", untuk kondisi yang sebelumnya hanya terlihat di panel:

| Peristiwa               | Arti                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Kontainer dihentikan karena kehabisan memori.                                                                        |
| `unhealthy`             | Proses berjalan tetapi probe `mc-health` gagal: server hidup tetapi mati.                                            |
| `startup-stalled`       | Masih memulai setelah ~10 menit tanpa "Selesai" di log (dengan diagnosis apa yang harus diperbaiki, jika diketahui). |
| `stop-failed`           | Penghentian yang baik tidak berlaku dan kontainer masih berjalan.                                                    |
| `schedule-failed`       | Restart / cadangan / perintah terjadwal gagal.                                                                       |
| `quota-exceeded`        | Kuota disk mode ketat terlampaui dan server dihentikan.                                                              |
| `offline-after-restart` | Server aktif sebelum panel dimulai ulang, sekarang tidak, dan tidak akan dimulai ulang secara otomatis.              |
| `port-change-failed`    | Perubahan port gagal dan server tidak dapat dikembalikan ke port lamanya, sehingga server mati.                      |
| `auto-restart-gave-up`  | Server yang crash tidak dimulai ulang karena tindakan lain membuatnya sibuk terlalu lama.                            |

### Cara pengiriman bekerja

Jembatan latar belakang memeriksa [log aktivitas](/docs/activity/) setiap 15 detik dan meneruskan baris yang dipetakan. Jika POST webhook gagal sementara, baris tersebut dicoba lagi pada pemeriksaan berikutnya daripada diabaikan; setelah beberapa kali percobaan gagal, baris tersebut dilewati, dan kegagalan pengiriman dicatat paling banyak sekali per jam per server. Setelah panel dimulai ulang, jembatan mengirimkan peristiwa yang belum dikirimkannya, tetapi tidak pernah lebih dari dua jam ke belakang; pada saat pertama kali berjalan, ia mulai dari peristiwa terbaru.
