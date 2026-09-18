---
title: 'Mengecilkan dunia'
description: 'Seiring waktu sebuah dunia akan meluas: setiap tempat yang pernah dijelajahi pemain, baik berjalan kaki, terbang, atau'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Seiring waktu, sebuah dunia akan meluas: setiap tempat yang pernah dilalui pemain, diterbangkan, atau dibawa oleh Ender pearl meninggalkan _chunk_ yang dihasilkan di disk, bahkan jika tidak ada yang pernah kembali. **Perkecil dunia** menghapus _chunk_ yang hampir tidak pernah dihuni oleh siapa pun, sehingga dunia memakan lebih sedikit ruang. Minecraft akan membangun kembali area yang dihapus dari benih dunia pada saat seseorang melakukan perjalanan ke sana lagi, jadi ini aman untuk tanah yang tidak digunakan oleh siapa pun, tetapi apa pun yang dibangun pemain di tempat yang hampir tidak pernah mereka singgahi akan ikut hilang, itulah sebabnya Anda harus mengambil cadangan terlebih dahulu (cadangan adalah cara untuk membatalkan).

## Apa yang dianggap "jarang dikunjungi"

Setiap _chunk_ mencatat berapa lama pemain menghabiskan waktu di dalamnya (Minecraft menyebutnya `InhabitedTime`). Perkecil dunia menghapus _chunk_ apa pun di bawah **30 detik** total waktu pemain secara default; dialog perkecil memungkinkan Anda mengubah ambang batas tersebut (1 detik hingga 1 jam) dan berapa banyak _chunk_ di sekitar titik spawn yang akan dipertahankan (default 8, `0` menonaktifkan perlindungan spawn).

Apa yang selalu dipertahankan:

- Area di sekitar **titik spawn** dunia (dibaca dari `level.dat`) di _overworld_. Nether, End, dan dimensi kustom tidak memiliki area spawn.
- _Chunk_ apa pun yang waktu kunjungannya tidak dapat dibaca, misalnya dunia yang disimpan dengan format kompresi yang tidak dapat didekode oleh panel (LZ4). Pratinjau dan hasil akan memberi tahu Anda berapa banyak _chunk_ semacam itu yang dilewati.

Setiap dimensi dunia tercakup: folder saudara gaya Bukkit (`world_nether`, `world_the_end`) serta tata letak vanilla dan Forge/Fabric (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Ketika sebuah _chunk_ dihapus, entitas dan titik minat penduduk desa ikut hilang bersamanya, sehingga _chunk_ yang diregenerasi tidak mewarisi mob, kereta tambang, atau tempat kerja yang sudah usang.

## Melakukannya dari tab Dunia

1. Ambil cadangan dari tab **Cadangan**. Mengecilkan dari tab Dunia tidak mengambil cadangan untuk Anda.
2. Buka **Dunia → Dunia**, temukan dunia, dan klik ikon perkecil.
3. Klik **Pratinjau** untuk melihat perkiraan berapa banyak _chunk_ (dan berapa megabyte) yang akan dihapus. Belum ada yang diubah; pratinjau berfungsi saat server berjalan.
4. Klik **Perkecil Dunia**. Mengecilkan mengedit file dunia secara langsung, jadi server harus dihentikan: hentikan terlebih dahulu, atau centang opsi untuk menghentikannya, mengecilkannya, dan memulainya lagi dalam satu langkah (server akan dimulai lagi bahkan jika perkecilan gagal). Kemajuan ditampilkan di baki tugas.

![Perkecil dunia](/docs/images/world-shrink.png)

## Melakukannya sebagai bagian dari cadangan

Pada tab **Cadangan**, centang **"Juga perkecil dunia setelahnya"** sebelum **Cadangkan Sekarang**. Arsip cadangan ditulis terlebih dahulu (arsip itu adalah cara Anda membatalkan), kemudian dunia diperkecil, tetapi hanya jika server dihentikan. Jika server berjalan, cadangan tetap berjalan dan perkecilan dilewati dengan sebuah catatan.

Cadangan terjadwal memiliki opsi yang sama: di editor jadwal, pilih tugas **Cadangan** dan centang **"Perkecil dunia setelah setiap cadangan"**. Pasangkan dengan jadwal **Hentikan server** beberapa menit sebelumnya jika Anda ingin berjalan tanpa pengawasan.
