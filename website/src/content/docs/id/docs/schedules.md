---
title: 'Jadwal'
description: 'Halaman Jadwal mengotomatiskan tugas berulang dengan ekspresi cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Jadwal** mengotomatiskan tugas berulang dengan ekspresi cron. Tanpa cron eksternal, tanpa skrip.

![Jadwal](/docs/images/schedules.png)

## Apa yang bisa dijadwalkan

- **Mulai ulang** - mulai ulang setiap malam untuk menjaga server yang berjalan lama tetap sehat.
- **Cadangan** - snapshot reguler (ditandai `scheduled` di halaman [Cadangan](/docs/backups/)).
- **Perintah** - jalankan perintah server apa pun sesuai jadwal.
- **Pemeriksaan pembaruan** - segarkan secara berkala apa yang sudah usang.

Setiap jadwal menargetkan server tertentu (atau panel secara global), berjalan pada ekspresi cron-nya sendiri, dan dapat diaktifkan atau dinonaktifkan tanpa menghapusnya. Waktu terakhir dijalankan ditampilkan sehingga Anda dapat mengonfirmasi bahwa jadwal tersebut berfungsi.
