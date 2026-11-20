---
title: 'Cadangan server Minecraft yang benar-benar bisa dipulihkan'
description: 'Cara membuat cadangan server Minecraft yang benar-benar bisa dipulihkan: salinan yang konsisten, disimpan di tempat lain, dan diuji setidaknya sekali.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Sebagian besar server memiliki cadangan. Lebih sedikit lagi yang memiliki cadangan yang berfungsi, dan perbedaannya baru diketahui di hari terburuk. Tiga hal membedakannya: salinan konsisten, salinan berada di tempat lain, dan seseorang telah memulihkannya setidaknya sekali.

## Salin dunia saat tidak sedang ditulis

Server yang berjalan terus menerus menulis file wilayah. Menyalinnya di tengah penulisan akan menghasilkan file yang setengah lama dan setengah baru, yang entah gagal dimuat atau dimuat dengan lubang di tanah tempat markas seseorang dulu berada. Tidak ada yang memperingatkan Anda, karena penyalinan berhasil.

Ada dua cara yang benar untuk membuat salinan:

1. **Hentikan server**, salin, mulai lagi. Sederhana, jujur, dan tidak populer karena waktu henti.
2. **Perintahkan game untuk berhenti menulis terlebih dahulu.** Jalankan `save-off`, lalu `save-all flush`, tunggu hingga selesai, salin, lalu `save-on`. Dunia menjadi lengkap dan tenang selama durasi penyalinan.

Jangan pernah melewatkan langsung ke penyalinan. Snapshot di tingkat sistem file atau volume hanya baik jika benar-benar atomik, dan `cp -r` saat pemain sedang menempatkan blok bukanlah itu.

## Cadangkan lebih dari sekadar dunia

Memulihkan dunia saja akan memberi Anda medan dan kehilangan server. Anda juga menginginkan:

- `server.properties`, dan apa pun yang mengatur aturan.
- Jar mod atau plugin, pada versi yang tepat yang sedang berjalan. Dunia tidak akan dimuat tanpa mod yang membuat bloknya.
- Data pemain, termasuk `whitelist.json`, `ops.json`, dan folder statistik serta kemajuan.
- Versi paket, jika berasal dari paket. Menuliskannya dihitung.

Pemeriksaan kewarasan tercepat pada cadangan apa pun: bisakah Anda membangun kembali server ini di mesin baru hanya dari arsip? Jika jawabannya memerlukan kalimat yang dimulai dengan "dan kemudian saya akan menginstal ulang", itu bukan cadangan yang lengkap.

## Satu salinan di disk yang sama bukanlah cadangan

Cadangan yang berada di mesin yang dilindunginya hanya mencakup satu kegagalan: Anda menghapus sesuatu.
Ini tidak mencakup kegagalan disk, penangguhan akun oleh penyedia, atau kesalahan yang menghapus seluruh direktori.

Tetap sederhana daripada sempurna:

- Satu salinan lokal, untuk kasus umum, yaitu seseorang merusak atau pembaruan yang buruk.
- Satu salinan di tempat lain. Mesin lain, penyimpanan objek, atau NAS rumah yang menarik setiap malam melalui SSH.
- Cukup riwayat untuk bertahan dari masalah yang tidak Anda sadari segera. Kerusakan sering ditemukan berhari-hari kemudian, dan jika Anda menyimpan cadangan selama tiga hari, Anda sudah menimpa yang baik.

Tujuh salinan harian ditambah empat salinan mingguan mencakup hampir setiap insiden nyata dan hanya membutuhkan sedikit ruang.

## Uji pemulihan sebelum Anda membutuhkannya

Pilih cadangan, pulihkan ke server cadangan, dan bergabunglah. Itulah seluruh pengujiannya, membutuhkan lima belas menit, dan ini menangkap semua kegagalan klasik: arsip yang kehilangan folder mod, dunia yang membutuhkan versi yang tidak lagi Anda jalankan, izin yang membuat file tidak dapat dibaca, unggahan terpotong.

Lakukan sekali saat Anda menyiapkan cadangan, dan sekali lagi setelah perubahan besar pada server.

## Ukuran, dan cara menjaganya tetap masuk akal

Dunia tumbuh karena pemain menjelajah. Dunia di mana seseorang terbang sepuluh ribu blok dalam garis lurus membawa setiap bagian di sepanjang garis itu selamanya, dan sebagian besar bagian itu tidak akan pernah dikunjungi lagi.

Tiga tuas, berdasarkan urutan seberapa banyak yang dikembalikan:

1. **Pangkas bagian yang tidak dikunjungi.** Alat yang memangkas berdasarkan waktu terakhir disentuh biasanya menghapus sebagian besar dunia yang banyak dilalui tanpa efek yang terlihat dalam permainan.
2. **Kompres dengan benar.** File wilayah terkompresi dengan baik; arsipnya tidak mendapat manfaat dari sesuatu yang eksotis.
3. **Jangan simpan setiap salinan per jam selama setahun.** Retensi mengalahkan kompresi.

## Di Minecraft Server Manager

Cadangan mengambil jalur `save-off`, flush, salin, `save-on`, dan penghentian atau mulai ulang yang diminta di tengah cadangan ditolak hingga penyalinan selesai daripada bersaing dengannya. Arsip mencakup seluruh direktori server, jadi mod, konfigurasi, dan data pemain ikut bersama dunia.

Cadangan dapat berjalan sesuai jadwal bersama dengan mulai ulang dan perintah, dan setiap server baru dimulai dengan jadwal cadangan harian. Hitungan retensi masing-masing secara terpisah, jadi sepuluh salinan terjadwal yang menumpuk dengan sendirinya tidak dapat menggantikan yang Anda ambil secara manual sebelum perubahan berisiko, dan batas usia dan ukuran berlaku di atasnya. Admin mengubah semuanya di halaman Pengaturan, atau per server di tab Cadangannya. Pemulihan mengambil cadangan baru terlebih dahulu, jadi pemulihan ke titik waktu yang salah itu sendiri dapat dibatalkan. Dunia dapat diperkecil sendiri atau sebagai bagian dari cadangan, yang merupakan tuas yang paling penting untuk ukuran.

Seluruh panel, termasuk setiap cadangan, berada di bawah satu direktori. Menyalin direktori itu ke tempat lain adalah setengah cerita di luar mesin, dan itu sengaja menjadi satu-satunya hal yang perlu Anda salin.

Terkait: [cadangan di panel](/docs/backups/), [jadwal](/docs/schedules/),
[memperkecil dunia](/docs/world-shrink/), [memindahkan server ke host lain](/docs/guide-moving-a-server/).
