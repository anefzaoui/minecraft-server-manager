---
title: 'Penyimpanan'
description: 'Lihat ke mana ruang disk terbuang, batasi setiap folder server dengan kuota disk, dan bersihkan apa yang tidak lagi Anda perlukan.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Penyimpanan** menunjukkan ke mana disk Anda digunakan: penggunaan berdasarkan kategori, setiap server terhadap kuotanya, file terbesar, dan bagaimana total penggunaan cenderung dalam pemindaian terakhir. Halaman ini hanya untuk admin.

![Penyimpanan](/docs/images/storage.png)

## Kuota disk diberlakukan oleh panel

Docker tidak dapat membatasi penggunaan disk dari bind mount, jadi panel yang melakukannya. Sebuah pengindeks ukuran latar belakang memindai folder data (setiap 15 menit, setelah perubahan, atau saat Anda menekan **Pindai Ulang Sekarang**), menyimpan jejak setiap server, dan memberlakukan kuota disk yang Anda tetapkan per server. Tindakan yang akan membuat folder server (dunia, mod, konfigurasi, log, dan semua yang ada di dalamnya) melebihi kuotanya, seperti menginstal mod atau dunia atau mengunggah file, diblokir sampai ruang dibebaskan atau kuota dinaikkan, daripada membiarkan satu server memenuhi host Anda.

Atur kuota server di [pengaturannya](/docs/servers/#server-settings). Mengaktifkan **Hentikan Server Saat Melebihi Kuota** di sana juga akan menghentikan server yang sedang berjalan setelah foldernya tumbuh lebih dari 10% di atas kuota, dan mencatatnya dalam riwayat server. Server modifikasi bisa berukuran besar, jadi berikan ruang yang cukup. [Cadangan](/docs/backups/) disimpan secara terpisah dan tidak dihitung terhadap kuota.

## Pembersihan

Kartu **Pembersihan Satu Klik** membebaskan ruang yang dapat diklaim kembali dengan aman oleh panel: file sementara yang lebih tua dari satu jam, file pustaka yatim piatu, dan log arsip serta laporan crash yang lebih tua dari 30 hari. Masing-masing menunjukkan berapa banyak yang dibebaskan dan membuka pratinjau sebelum ada yang dihapus. Daftar **Berdasarkan Kategori** dan **File Terbesar** langsung terhubung ke manajer file, sehingga Anda dapat menemukan apa lagi yang perlu dipangkas sebelum kehabisan ruang.
