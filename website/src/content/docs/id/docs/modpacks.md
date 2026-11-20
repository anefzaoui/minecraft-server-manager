---
title: 'Modpack'
description: 'Instal modpack CurseForge, Modrinth, FTB, dan GT New Horizons sebagai server, selalu disematkan ke versi pack yang tepat.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Kembali ke indeks docs](/docs/)

Halaman **Modpacks** (dan tab **Dari Modpack** di [wizard pembuatan](/docs/servers/)) menginstal modpack sebagai server, selalu **disematkan ke versi pack yang tepat** sehingga restart tidak akan pernah dapat meningkatkan pack secara diam-diam di luar kendali Anda.

![Modpacks](/docs/images/modpacks.png)

## Platform yang Didukung

- **CurseForge**: cari berdasarkan nama. Membutuhkan kunci API CurseForge (tambahkan di bawah **Pengaturan → Kunci API**).
- **Modrinth**: cari berdasarkan nama.
- **FTB**: Feed The Beast pack, hanya melalui API (ID pack numerik ditambah ID versi eksplisit). Panel belum memeriksa pembaruan pack FTB.
- **GT New Horizons**: pack ahli 1.7.10, diinstal dari indeks rilis GTNH sendiri. GTNH memilih runtime Java-nya per versi pack (2.8.0+ berjalan pada **Java 25** melalui patch lwjgl3ify yang dibundel, rilis yang lebih lama pada Java 21 atau 17), dan wizard menaikkan RAM dan disk server ke minimum yang masuk akal untuknya.
- **Zip kustom**: sama sekali bukan pack yang diterbitkan. Unggah **ekspor modpack CurseForge** (zip dengan `manifest.json` yang dihasilkan aplikasi CurseForge untuk kumpulan mod yang dipilih secara manual), **`.mrpack` Modrinth**, atau **zip jar mod apa pun**. Panel menyelesaikan manifest secara massal (atau mengidentifikasi setiap jar berdasarkan hash/sidik jari/metadata), mempratinjau apa yang cocok, dan menginstal semuanya dalam satu tugas, termasuk konfigurasi `overrides/` pack jika Anda memilihnya. Mod yang penulisnya tidak mengizinkan unduhan otomatis terdaftar dengan tautan peramban dan slot unggah manual alih-alih menggagalkan instalasi.

## Cara kerja penyematan

Saat Anda memilih pack, panel menyelesaikan versi yang tepat, mencatatnya, dan menginstalnya. Di halaman **Pembaruan** Anda akan diberitahu kapan versi yang lebih baru tersedia (kecuali jika [kebijakan pembaruan](#update-policy) server adalah **Hanya Manual**); peningkatan adalah tindakan yang disengaja dan dijaga dengan cadangan pra-pembaruan dan pemulihan. Server yang melacak versi stabil tidak pernah ditawari versi beta. Tab **Versi** server sendiri menjawab separuh pertanyaan lainnya: versi Minecraft masa depan apa yang dapat diikuti oleh mod yang sebenarnya dimilikinya ([pembaruan](/docs/updates/#minecraft-version-compatibility)).

Versi pemuat mod juga disertakan dengan pack: server menginstal build Forge, NeoForge, atau Fabric yang dideklarasikan oleh pack. Jika pack CurseForge Forge atau Fabric mendeklarasikan versi yang terlalu lama untuk modnya sendiri, tab **Versi** dapat menggantinya sampai pack diperbaiki; pembaruan pack menghapus penggantian, karena versi baru mendeklarasikan versinya sendiri ([mengubah versi pemuat mod](/docs/updates/#changing-the-mod-loader-version)).

Server yang dibuat pada versi panel yang sangat lama (sebelum 0.9.7) dapat dibiarkan _tidak disematkan_, yang berarti gambar kontainer akan secara diam-diam menginstal versi pack terbaru setiap kali dimulai. Panel sekarang memperbaiki ini saat boot: ia mengunci masing-masing ke versi yang sebenarnya diinstal (dibaca dari catatan panel sendiri atau manifes instalasi gambar, tidak pernah "terbaru" yang baru diselesaikan) dan mencatat sebuah peristiwa. Jika tidak dapat mengetahui apa yang diinstal, halaman Pengaturan server menampilkan peringatan dengan tombol **Pilih Versi…** (pack CurseForge, Modrinth, dan GTNH) yang membuka [pemilih versi](#changing-the-pack-version), dan setiap upaya untuk menyimpan konfigurasi modpack yang tidak disematkan ditolak mentah-mentah.

## Kebijakan Pembaruan

Setiap server memiliki kartu **Kebijakan Pembaruan** di tab **Pengaturan → Konfigurasi**, dan ketiga opsi tersebut berarti apa adanya:

- **Hanya Manual** (default): tidak ada yang pernah berubah dengan sendirinya, dan server sepenuhnya dikecualikan dari lencana pembaruan dan halaman Pembaruan. Mode "biarkan saya sendiri": ideal untuk pack yang disetel secara manual atau diimpor yang tidak pernah Anda inginkan untuk diubah. Ini tidak mengunci versi: [**Ubah Versi…**](#changing-the-pack-version) berfungsi di bawah setiap kebijakan. Untuk diberitahu tentang versi baru dan menerapkannya dengan satu klik, pilih **Beri Tahu Saya**.
- **Beri Tahu Saya**: pemeriksaan harian menampilkan pembaruan yang tersedia sebagai lencana dan di halaman Pembaruan; menerapkannya selalu dengan klik Anda.
- **Pembaruan Otomatis**: setelah pemeriksaan harian terjadwal, pembaruan **pack** yang tertunda diterapkan melalui jalur yang sama seperti peningkatan manual: cadangan pra-pembaruan, pemantauan kesehatan, dan pemulihan otomatis jika versi baru gagal boot. Pembaruan yang akan memindahkan server ke versi Minecraft yang berbeda selalu dilewati dengan sebuah peristiwa: mengonversi dunia secara permanen adalah keputusan yang tidak akan dibuat oleh panel untuk Anda. Tombol **Periksa Sekarang** manual hanya memeriksa; mereka tidak pernah memicu pembaruan otomatis.

## Meningkatkan pack

Dari server yang disematkan, Anda dapat meningkatkan ke versi yang lebih baru dalam satu tindakan. Panel mengambil cadangan terlebih dahulu, mengganti versi yang disematkan, membangun kembali server (menyelesaikan ulang Java jika versi baru memerlukan runtime yang berbeda), dan memantau boot pertama, dengan jendela yang cukup besar untuk pack besar seperti GTNH yang mengunduh beberapa gigabyte dan membangun dunia dengan beberapa ratus mod saat pertama kali dimulai.

## Mengubah versi pack

Untuk menjalankan versi tertentu, yang lebih baru atau lebih lama, gunakan **Ubah Versi…** pada kartu pack di tab **Ringkasan** server. Di halaman **Modpacks**, membuka kartu pack yang terinstal memberikan pilihan yang sama: pilih versi di dropdown dan klik **Beralih ke Versi Ini**. Keduanya memerlukan izin **Konten** server, dan keduanya tersedia untuk pack CurseForge, Modrinth, dan GTNH (pack FTB belum memiliki daftar versi). Daftar menampilkan 25 versi terbaru untuk CurseForge dan Modrinth, dan setiap rilis GTNH.

Pergantian melalui jalur yang sama seperti peningkatan: cadangan pra-pembaruan, pin baru, pembangunan kembali, dan boot pertama yang diawasi, dengan pemulihan satu klik jika server tidak sehat. Mod kustom Anda dibawa serta, begitu juga mod pack yang Anda nonaktifkan, bersama dengan pengaturan instalasi pack lainnya (mod yang dipaksa masuk, file yang harus diabaikan, proyek tambahan). Menginstal pack yang berbeda memulai pengaturan tersebut dari awal, karena pengaturan tersebut hanya masuk akal untuk pack yang dibuatnya.

Setiap versi terdaftar dengan versi Minecraft yang dijalankannya, dibandingkan dengan versi yang terakhir disimpan oleh dunia Anda:

- **Versi Minecraft yang sama**: beralih setelah konfirmasi normal. Kembali ke versi pack yang lebih lama dapat menjatuhkan blok dan item dari mod yang tidak dimiliki versi tersebut, jadi cadangan tetap ada di tab Cadangan di kedua kasus.
- **Versi Minecraft yang lebih baru**: diizinkan setelah konfirmasi yang memperingatkan bahwa dunia dikonversi secara permanen. Cadangan yang diambil terlebih dahulu adalah satu-satunya cara kembali ke dunia lama.
- **Versi Minecraft yang lebih lama**: tidak tersedia. Minecraft tidak dapat memuat dunia pada versi yang lebih lama daripada yang terakhir menyimpannya, jadi panel menolak daripada meninggalkan server yang mogok saat boot.
