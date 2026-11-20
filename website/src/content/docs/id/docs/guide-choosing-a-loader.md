---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: yang mana?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge atau Quilt: jenis server Minecraft mana yang akan dijalankan, dipilih berdasarkan apa yang dipasang pemain Anda.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Kembali ke indeks docs](/docs/)

Pilih berdasarkan apa yang Anda ingin pemain instal, bukan berdasarkan apa yang terdengar paling cepat.

| Anda ingin                                          | Jalankan ini          | Pemain instal |
| --------------------------------------------------- | --------------------- | ------------- |
| Survival bersama teman, tidak ada yang aneh         | Vanilla               | Tidak ada     |
| Server publik dengan peringkat, klaim, dan moderasi | Paper                 | Tidak ada     |
| Paket mod spesifik dari CurseForge atau Modrinth    | Apa pun yang tertulis | Paketnya      |
| Paket mod modern yang Anda buat sendiri             | Fabric atau NeoForge  | Mod yang sama |
| Paket lama dari era 1.7 hingga 1.12                 | Forge                 | Mod yang sama |

Itulah seluruh keputusan untuk kebanyakan orang. Sisa halaman ini adalah alasannya.

## Plugin dan mod bukanlah hal yang sama

Ini adalah perbedaan di mana segala sesuatu yang lain bergantung.

**Plugin** berjalan hanya di server. Paper, Spigot, dan Bukkit memuatnya. Pemain bergabung dengan klien biasa yang tidak dimodifikasi dan tidak pernah tahu. Apa pun yang pada dasarnya tentang aturan, izin, ekonomi, klaim, minigame, atau moderasi adalah plugin, dan itulah mengapa hampir setiap server publik menjalankan Paper.

**Mod** mengubah permainan itu sendiri: blok baru, dimensi baru, mesin baru. Klien harus memuat mod yang sama dengan server, atau tidak dapat memahami apa yang dikatakan server kepadanya. Siapa pun yang bergabung dengan server modded menginstal paket terlebih dahulu.

Server tidak dapat secara bermakna menjadi keduanya. Proyek hibrida ada yang memasang API plugin ke pemuat mod, dan mereka berfungsi sampai tidak berfungsi, biasanya pada saat terburuk. Jika Anda membutuhkan keduanya, jalankan proxy dengan server modded dan server plugin di belakangnya daripada satu hibrida.

## Sisi plugin

**Paper** adalah jawaban default. Ini adalah fork dari Spigot dengan bertahun-tahun pekerjaan kinerja dan file konfigurasi untuk hampir setiap perilaku yang pernah mengganggu administrator. Plugin Vanilla dari era Bukkit sebagian besar masih berjalan.

**Purpur** adalah fork dari Paper dengan lebih banyak pengaturan, termasuk yang terkait gameplay. Ambil ini jika Anda menginginkan sakelar spesifik itu; jika tidak, Paper.

**Vanilla** layak dijalankan ketika intinya adalah permainan yang tidak berubah. Ini lebih lambat dengan banyak pemain, dan tidak memiliki sistem izin, jadi moderasi dilakukan secara manual.

Paper mengubah beberapa perilaku vanilla secara default demi kinerja. Jika sebuah alat peredam suara dari sebuah video tidak berfungsi di server Anda, itulah alasannya, dan itu biasanya adalah pengaturan.

## Sisi mod

**Fabric** kecil, diperbarui ke versi Minecraft baru dalam beberapa hari, dan membawa sebagian besar mod kinerja modern. Hampir setiap mod Fabric juga menginginkan Fabric API, yang merupakan unduhan terpisah. Jika tujuan Anda adalah server cepat dengan segelintir mod kualitas hidup, inilah pilihannya.

**NeoForge** adalah tempat ekosistem Forge lama sekarang melakukan pekerjaannya untuk versi saat ini. Ini terpisah dari Forge selama 1.20.1, dan sebagian besar paket besar yang dibuat untuk 1.20.2 dan yang lebih baru menargetkannya. Jika Anda memulai paket berat baru hari ini, inilah pilihannya.

**Forge** masih menguasai masa lalu. Apa pun dari era 1.7.10, 1.12.2, dan 1.16.5, yang merupakan banyak paket kesayangan, adalah Forge dan akan selalu begitu. Simpan untuk yang itu.

**Quilt** adalah fork dari Fabric yang menjalankan sebagian besar mod Fabric. Ini ada karena alasan yang baik, tetapi jika Anda tidak punya alasan khusus untuk memilihnya, pilih Fabric.

Mod untuk satu loader tidak berjalan di loader lain. Halaman mod yang mengatakan Fabric berarti Fabric.

## Jika Anda menginstal paket, paket yang memutuskan

Jangan memilih. Paket mencantumkan loader dan versi Minecraft persisnya, dan keduanya harus cocok. "Cukup dekat" bukanlah hal di sini: paket untuk 1.20.1 tidak berjalan di 1.20.4, dan paket NeoForge 1.20.1 tidak berjalan di Forge 1.20.1.

Instal paket berdasarkan ID atau tautannya daripada memilih mod secara manual, dan sematkan versinya. Paket diperbarui, dan pembaruan yang terjadi di bawah kaki Anda di tengah musim adalah cara dunia menjadi rusak.

## Versi Java mana

Persyaratan Minecraft bergerak seiring dengan permainan, dan menjalankan versi yang salah akan menghasilkan `UnsupportedClassVersionError` yang tidak membantu alih-alih pesan yang jelas.

| Versi Minecraft       | Java |
| --------------------- | ---- |
| 1.16.5 dan sebelumnya | 8    |
| 1.17                  | 16   |
| 1.18 dan 1.19         | 17   |
| 1.20 hingga 1.20.4    | 17   |
| 1.20.5 hingga 1.21.x  | 21   |
| 26.1 dan selanjutnya  | 25   |

Paket lama benar-benar membutuhkan Java 8; ini adalah salah satu dari sedikit tempat dalam perangkat lunak di mana versi terbaru adalah yang salah.

## Di Minecraft Server Manager

Wizard pembuatan menanyakan apa yang ingin Anda jalankan dan memilih versi Java dari tabel di atas, sehingga ketidakcocokan tidak pernah terjadi secara tidak sengaja. Vanilla, Paper, dan Purpur ada di tab **Vanilla**; tab **Dari Mod** menerima Fabric, Forge, NeoForge, atau Quilt, dengan versi Minecraft dan build loader (terbaru, atau yang Anda sematkan). Menginstal paket dari CurseForge, Modrinth, atau GT New Horizons menyematkannya ke versi yang tepat. Peningkatan hanya terjadi ketika Anda menerapkannya (atau setelah pemeriksaan harian, jika kebijakan pembaruan server adalah **Otomatis Perbarui**), selalu mengambil cadangan terlebih dahulu, dan dapat dikembalikan.

Peramban mod mengetahui loader mana yang dijalankan server dan memfilter apa yang ditawarkannya, sehingga jar Fabric tidak dapat mendarat di server NeoForge karena kesalahan.

Terkait: [membuat dan mengelola server](/docs/servers/), [modpack](/docs/modpacks/),
[berapa banyak RAM yang dibutuhkan server](/docs/guide-server-memory/).
