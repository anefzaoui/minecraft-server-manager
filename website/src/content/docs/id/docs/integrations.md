---
title: 'Integrasi'
description: 'Setiap server memiliki integrasinya di bawah grup Pengaturan: Discord, Halaman Status publik, Undangan sekali klik, dan tab Chatbot opsional.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Kembali ke indeks docs](/docs/)

Setiap server memiliki integrasinya di bawah grup **Pengaturan**: **Discord**, **Halaman Status** publik, **Undangan** sekali klik, dan tab **Chatbot** opsional. Halaman ini mencakup Discord (yang lain memiliki dokumentasi dan alat bantu pengaturan sendiri di panel).

## Notifikasi Discord

Panel meneruskan peristiwa server ke saluran Discord melalui webhook. Tanpa bot, tanpa OAuth.

### Pengaturan

1. Di Discord: **Pengaturan Server → Integrasi → Webhook → Webhook Baru**. Pilih saluran dan salin URL webhook.
2. Di panel, buka tab **Pengaturan → Discord** server, tempel URL ke **URL Webhook**, aktifkan kartu, dan **Simpan**. URL disimpan terenkripsi (di penyimpanan saat diam yang sama dengan kunci API Anda).
3. Gunakan **Kirim tes** untuk mengonfirmasi bahwa itu berfungsi.

![Integrasi Discord](/docs/images/integrations-discord.png)

Untuk mengganti URL yang tersimpan, tempelkan yang baru dan simpan; biarkan bidang kosong untuk mempertahankan yang saat ini. URL yang tersimpan ditampilkan tersamarkan (token disembunyikan).

### Apa yang dikirim

Notifikasi dikelompokkan ke dalam kategori yang dapat dialihkan. Semuanya aktif secara default.

| Kategori             | Peristiwa                                                     |
| -------------------- | ------------------------------------------------------------- |
| **Mulai / berhenti** | Server dimulai, server berhenti                               |
| **Kerusakan**        | Kerusakan, loop kerusakan terdeteksi, laporan kerusakan baru  |
| **Cadangan**         | Cadangan dibuat, cadangan dipulihkan                          |
| **Pembaruan**        | Pembaruan diterapkan, pembaruan dikembalikan, pembaruan gagal |
| **Tendang / larang** | Pemain ditendang, pemain dilarang                             |
| **Peringatan**       | Hal-hal yang diam-diam membuat server rusak (lihat di bawah)  |

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
| `offline-after-restart` | Server aktif sebelum panel dimulai ulang, sekarang tidak aktif, dan tidak akan dimulai ulang secara otomatis.        |
| `crash-report`          | Laporan kerusakan baru ditangkap dan diurai.                                                                         |
| `update-failed`         | Peningkatan yang dijaga tidak sehat.                                                                                 |

### Cara pengiriman bekerja

Jembatan latar belakang memeriksa [log aktivitas](/docs/activity/) setiap 15 detik dan meneruskan baris yang dipetakan. Jika POST webhook gagal sementara, baris tersebut dicoba lagi pada pemeriksaan berikutnya daripada dijatuhkan; webhook yang tidak dapat dijangkau secara permanen akan dibisukan (satu baris log per jam) setelah beberapa upaya. Jembatan tidak pernah memutar ulang peristiwa dari sebelum panel dimulai.
