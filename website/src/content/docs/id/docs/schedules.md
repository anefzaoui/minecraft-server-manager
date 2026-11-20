---
title: 'Jadwal'
description: 'Halaman Jadwal mengotomatiskan tugas berulang dengan ekspresi cron. Tanpa cron eksternal, tanpa skrip.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Kembali ke indeks docs](/docs/)

Halaman **Jadwal** mengotomatiskan tugas berulang dengan ekspresi cron. Tanpa cron eksternal, tanpa skrip.

![Jadwal](/docs/images/schedules.png)

## Apa yang bisa dijadwalkan

- **Mulai ulang**: mulai ulang setiap malam untuk menjaga server yang berjalan lama tetap sehat.
- **Berhenti dan mulai**: matikan server semalaman dan hidupkan kembali di pagi hari.
- **Cadangan**: snapshot reguler (ditandai `scheduled` di halaman [Cadangan](/docs/backups/)). Jadwal cadangan juga dapat mengecilkan dunia setelah setiap cadangan ([mengecilkan dunia](/docs/world-shrink/)). Setiap server baru mendapatkan jadwal cadangan harian secara otomatis.
- **Perintah**: jalankan perintah server apa pun sesuai jadwal.
- **Pemeriksaan pembaruan**: segarkan secara berkala apa yang sudah usang. Pemeriksaan terjadwal juga merupakan apa yang menerapkan pembaruan untuk server yang diatur ke [Pembaruan Otomatis](/docs/modpacks/#update-policy).

Setiap jadwal menargetkan server tertentu (atau panel secara global), berjalan pada ekspresi cron-nya sendiri, dan dapat diaktifkan atau dinonaktifkan tanpa menghapusnya. Editor mempratinjau waktu berjalan berikutnya saat Anda mengetik, waktu cron mengikuti zona waktu panel (diatur di **Pengaturan**), dan tabel menunjukkan waktu berjalan berikutnya dari setiap jadwal. Setiap eksekusi dicatat sebagai peristiwa riwayat, begitu juga eksekusi yang gagal.

Panel juga menanamkan jadwal pemeliharaannya sendiri saat pertama kali boot, yang dapat Anda ubah waktunya atau matikan: pemeriksaan pembaruan harian, pemindaian ulang penyimpanan setiap enam jam, pembersihan harian file sementara lama, pemindaian kedaluwarsa larangan setiap 15 menit (menghapus larangan sementara yang telah habis masa berlakunya), dan pengisian kembali metadata konten setiap malam (mengisi nama mod dan ikon yang hilang).

## Saat server sibuk

Cadangan atau mulai terjadwal yang menemukan servernya di tengah tindakan lain (pemulihan, pembersihan cadangan, perubahan port) menunggu dan mencoba lagi setiap menit hingga tindakan tersebut selesai, hingga 30 menit. Mulai yang tertunda dibatalkan jika seseorang memulai atau menghentikan server di antaranya. Mulai ulang atau berhenti terjadwal tidak dicoba lagi: itu dilewati dan berjalan lagi pada waktu berikutnya.
