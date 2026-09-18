---
title: 'Modpack'
description: 'Halaman Modpack (dan tab Dari modpack di wizard pembuatan) menginstal modpack sebagai server, selalu disematkan ke versi pack yang tepat sehingga restart dapat'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Kembali ke indeks docs](/docs/)

Halaman **Modpacks** (dan tab **Dari modpack** di [wizard pembuatan](/docs/servers/)) menginstal modpack sebagai server, selalu **disematkan ke versi pack yang tepat** sehingga restart tidak akan pernah secara diam-diam memperbarui pack di luar kendali Anda.

![Modpacks](/docs/images/modpacks.png)

## Platform yang didukung

- **CurseForge** - cari atau tempel URL pack. Membutuhkan kunci API CurseForge untuk pencarian dan pack pribadi (tambahkan di bawah Pengaturan → Kunci API).
- **Modrinth** - cari berdasarkan nama.
- **FTB** - Feed The Beast packs.
- **GT New Horizons** - pack ahli 1.7.10, diinstal dari indeks rilis GTNH sendiri. GTNH memilih runtime Java-nya per versi pack (2.8.0+ berjalan pada **Java 25** melalui patch lwjgl3ify yang dibundel, rilis yang lebih lama pada Java 21 atau 17), dan wizard menaikkan RAM dan disk server ke minimum yang masuk akal untuknya.
- **Zip kustom** - bukan pack yang diterbitkan sama sekali: unggah **ekspor modpack CurseForge** (zip dengan `manifest.json` yang dihasilkan aplikasi CurseForge untuk kumpulan mod yang dipilih secara manual) atau **zip jar mod apa pun**. Panel menyelesaikan manifest secara massal melalui API CurseForge (atau mengidentifikasi setiap jar berdasarkan hash/sidik jari/metadata), mempratinjau apa yang cocok, dan menginstal semuanya dalam satu tugas - termasuk konfigurasi `overrides/` pack jika Anda memilihnya. Mod yang penulisnya melarang unduhan otomatis dicantumkan dengan tautan peramban dan slot unggah manual alih-alih menggagalkan instalasi.

## Cara kerja penyematan

Saat Anda memilih pack, panel menyelesaikan versi yang tepat, mencatatnya, dan menginstalnya. Di halaman **Pembaruan**, Anda akan diberitahu kapan versi yang lebih baru tersedia; peningkatan adalah tindakan yang disengaja dan dijaga dengan cadangan pra-pembaruan dan pemulihan. Server yang stabil tidak pernah ditawari beta.

Server yang dibuat pada versi panel yang sangat lama (sebelum 0.9.7) dapat dibiarkan _tidak disematkan_, yang berarti gambar kontainer akan diam-diam menginstal versi pack terbaru setiap kali dimulai. Panel sekarang memperbaiki ini saat boot: ia mengunci masing-masing ke versi yang sebenarnya terinstal (dibaca dari catatan panel sendiri atau manifes instalasi gambar, tidak pernah "terbaru" yang baru diselesaikan) dan mencatat sebuah peristiwa. Jika tidak dapat mengetahui apa yang terinstal, halaman Pengaturan server menampilkan peringatan yang meminta Anda untuk memilih versi secara manual, dan setiap upaya untuk menyimpan konfigurasi modpack yang tidak disematkan akan ditolak mentah-mentah.

## Kebijakan pembaruan

Setiap server memiliki kebijakan pembaruan di **Pengaturan**, dan ketiga opsi tersebut berarti apa adanya:

- **Hanya manual** - tidak ada yang pernah berubah dengan sendirinya, dan server sepenuhnya dikecualikan dari lencana pembaruan dan halaman Pembaruan. Mode "biarkan saya sendiri": ideal untuk pack yang disetel secara manual atau diimpor yang tidak pernah Anda inginkan untuk disentuh.
- **Beri tahu saya** (default) - pemeriksaan harian menampilkan pembaruan yang tersedia sebagai lencana dan di halaman Pembaruan; menerapkannya selalu dengan klik Anda.
- **Pembaruan otomatis** - setelah pemeriksaan harian terjadwal, pembaruan **pack** yang tertunda diterapkan melalui jalur yang dijaga sama seperti peningkatan manual: cadangan pra-pembaruan, pemantauan kesehatan, dan pemulihan otomatis jika versi baru gagal boot. Pembaruan yang akan memindahkan server ke versi Minecraft yang berbeda selalu dilewati dengan sebuah peristiwa - mengonversi dunia secara permanen adalah keputusan yang ditolak oleh panel untuk Anda. Tombol "periksa sekarang" manual hanya memeriksa; mereka tidak pernah memicu pembaruan otomatis.

## Meningkatkan pack

Dari server yang disematkan, Anda dapat meningkatkan ke versi yang lebih baru dalam satu tindakan. Panel mengambil cadangan terlebih dahulu, mengganti versi yang disematkan, membuat ulang kontainer (menyelesaikan ulang Java jika versi baru memerlukan runtime yang berbeda), dan memantau boot pertama, dengan jendela yang cukup besar untuk pack besar seperti GTNH yang mengunduh beberapa gigabyte dan membangun dunia dengan beberapa ratus mod pada awal pertama.
