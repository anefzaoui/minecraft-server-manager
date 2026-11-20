---
title: 'Server Minecraft Anda tidak mau mulai'
description: 'Server Minecraft yang tidak mau mulai, diperbaiki berdasarkan urutan kemungkinan: log, versi Java, memori, EULA dan port, serta mod.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Kembali ke indeks docs](/docs/)

Kerjakan daftar ini. Urutannya berdasarkan seberapa sering masing-masing menjadi jawaban, dan empat yang pertama mencakup sebagian besar.

## 1. Baca dua puluh baris terakhir, bukan yang pertama

Gulir ke **akhir** log. Jejak tumpukan Java dicetak dari dalam ke luar, jadi bagian atas dari dinding teks adalah bagian yang paling tidak menarik. Yang Anda inginkan adalah baris `Caused by:` terakhir dan apa pun yang mengikutinya. Baris tunggal itu biasanya menyebutkan masalahnya.

Dua bentuk memberi tahu Anda di mana Anda berada:

- `Exception in thread "main"` atau jalur laporan kerusakan di dekat akhir berarti game itu sendiri gagal.
- Log berhenti begitu saja di tengah baris, tanpa pengecualian sama sekali, berarti sesuatu menghentikan proses dari luar. Lompat ke poin 3.

## 2. UnsupportedClassVersionError berarti Java yang salah

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

File kelas 52 adalah Java 8, 60 adalah 16, 61 adalah 17, 65 adalah 21, 69 adalah 25. Pesan tersebut berarti server membutuhkan Java yang lebih baru daripada yang sedang berjalan; sebaliknya, paket lama pada Java baru, biasanya gagal dengan kesalahan mixin atau refleksi.

| Versi Minecraft       | Java |
| --------------------- | ---- |
| 1.16.5 dan sebelumnya | 8    |
| 1.17                  | 16   |
| 1.18 dan 1.19         | 17   |
| 1.20 hingga 1.20.4    | 17   |
| 1.20.5 hingga 1.21.x  | 21   |
| 26.1 dan setelahnya   | 25   |

Paket lama benar-benar membutuhkan Java 8. Yang lebih baru tidak lebih baik di sini.

## 3. Kode keluar 137 adalah kernel, bukan mod

Log berhenti di tengah kalimat, tidak ada laporan kerusakan, dan kontainer melaporkan 137. Itu adalah pembunuhan karena kehabisan memori: proses meminta memori yang tidak dimiliki mesin, sehingga dihentikan.

Hampir selalu heap Java diatur ke jumlah yang sama dengan memori mesin. Heap membutuhkan memori mesin **dikurangi** overhead JVM itu sendiri, yaitu 0,5 hingga 1,5 GB pada server yang dimodifikasi. Turunkan heap, atau naikkan mesin. [Berapa banyak RAM yang dibutuhkan server](/docs/guide-server-memory/) memiliki angkanya.

## 4. EULA dan port

Dua klasik dengan perbaikan satu baris:

- `You need to agree to the EULA in order to run the server.` Atur `eula=true`, di `eula.txt` atau dengan variabel lingkungan yang digunakan penyiapan Anda.
- `Address already in use` atau `FAILED TO BIND TO PORT`. Sesuatu yang lain menahan 25565, seringkali salinan server yang sama sebelumnya yang tidak pernah berhenti sepenuhnya. Temukan dan hentikan daripada mengubah port, atau Anda akan memiliki dua.

## 5. Mod kehilangan dependensinya

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Mod Fabric sebagian besar membutuhkan Fabric API sebagai file terpisah. Mod Forge dan NeoForge mencantumkan dependensinya dalam kesalahan itu sendiri. Instal versi yang disebutkan, bukan yang terbaru: "membutuhkan 0.91.x" berarti baris itu, dan 0.92 akan gagal dalam pemeriksaan yang sama.

Terkadang dependensi yang hilang adalah loader itu sendiri:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Perbaikannya adalah build loader yang lebih baru, bukan mod yang berbeda. "47.4.14 atau di atasnya" berarti build apa pun dari sana ke atas, dan Forge tidak menerbitkan setiap nomor, jadi build yang akan diinstal mungkin yang berikutnya. Pada modpack, perbarui paket terlebih dahulu: paket yang versi loadernya terlalu tua untuk modnya adalah bug yang harus diperbaiki oleh penulisnya.

## 6. Mod untuk loader atau versi yang salah

Jar untuk loader yang berbeda tidak gagal dengan sopan. Harapkan kesalahan mixin, `NoClassDefFoundError`, atau kerusakan di dalam kelas yang belum pernah Anda dengar. Periksa halaman jar: loader dan versi Minecraft keduanya harus cocok persis. 1.20.1 dan 1.20.4 adalah game yang berbeda sejauh menyangkut mod.

## 7. Dunia dari versi yang lebih baru

```
This world was created by a newer version of Minecraft
```

Dunia ditingkatkan maju dan tidak pernah mundur. Pulihkan cadangan dari sebelum pembaruan, atau jalankan versi yang diharapkan dunia. Tidak ada jalur penurunan versi yang menjaga chunk tetap utuh.

## Saat crash setelah berjalan baik selama berminggu-minggu

Pertanyaan berbeda, biasanya jawaban berbeda:

- **Crash saat beban**, dengan waktu menunjukkan jeda panjang: pengumpulan sampah, jadi lihat ukuran heap sebelum mod.
- **Crash pada titik yang sama di dunia**: chunk rusak atau entitas rusak. Laporan kerusakan biasanya menyebutkan koordinat.
- **Crash tepat setelah pembaruan**: mod yang diperbarui adalah tersangka, bahkan jika jejak menunjuk ke tempat lain. Kembalikan dan lihat.
- **Crash saat restart, sebelumnya baik-baik saja**: periksa disk. Disk yang penuh menghasilkan kesalahan yang spektakuler dan menyesatkan.

## Mendapatkan bantuan yang benar-benar membantu

Posting **seluruh log**, bukan baris terakhir, dan sebutkan apa yang Anda ubah sebelum rusak. Tempelkan di tempat yang dirancang untuk itu, seperti [mclo.gs](https://mclo.gs), daripada ke dalam obrolan. Sertakan versi Minecraft, loader, paket dan versinya, dan berapa banyak heap yang dimiliki server. Laporan dengan empat fakta tersebut akan dijawab dalam satu balasan; tanpanya akan memakan waktu lima.

## Di Minecraft Server Manager

Kerusakan terdeteksi dari keluarnya kontainer itu sendiri, jadi server yang mati pada pukul tiga pagi dicatat dengan kutipan lognya daripada ditemukan keesokan harinya. Tersangka biasa di halaman ini (EULA, Java yang salah, dunia dari versi yang lebih baru, port sudah terpakai, Java kehabisan memori) dikenali dalam log tersebut dan disebutkan dalam entri riwayat dengan apa yang harus dilakukan tentangnya, dan restart otomatis membiarkan hal-hal itu, karena memulai ulang tidak akan memperbaikinya. Laporan kerusakan diurai saat tiba: pengecualian disorot, tumpukan dapat diciutkan, dan mod yang muncul dalam jejak terdaftar sebagai tersangka.

Laporan apa pun dapat dibagikan ke mclo.gs dari kartunya saat Anda membutuhkan bantuan (setelah konfirmasi, karena tempelan itu publik), dan menu **Unduh** konsol memiliki setiap file log sebagai satu zip, jadi "posting seluruh log" adalah unduhan daripada proyek arkeologi. Pembunuhan karena kehabisan memori dicatat sebagai pembunuhan karena kehabisan memori, yang menghemat satu jam biasa menyalahkan mod. Jika sesuatu yang lain benar-benar membutuhkan port, kartu **Game Port** di **Pengaturan → Konfigurasi** memindahkan server ke yang gratis.

Loader yang terlalu tua diubah dari tab **Versi** server, yang memeriksa apakah build ada dan mengambil cadangan sebelum membangun kembali server ([mengubah versi mod loader](/docs/updates/#changing-the-mod-loader-version)).

Terkait: [berapa banyak RAM yang dibutuhkan server](/docs/guide-server-memory/), [memilih loader](/docs/guide-choosing-a-loader/), [membuat dan mengelola server](/docs/servers/).
