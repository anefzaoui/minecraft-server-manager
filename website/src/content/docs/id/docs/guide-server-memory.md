---
title: 'Berapa banyak RAM yang dibutuhkan server Minecraft?'
description: 'Berapa banyak RAM yang dibutuhkan server Minecraft untuk vanilla, Paper, mod ringan dan modpack besar, serta berapa banyak yang tersisa untuk mesin.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Jawaban singkat, untuk server yang benar-benar akan dimainkan:

| Apa yang Anda jalankan                         | Tumpukan Java (heap) | Berikan mesin |
| ---------------------------------------------- | -------------------- | ------------- |
| Vanilla atau Paper, hingga 10 pemain           | 2 GB                 | 4 GB          |
| Paper dengan plugin, 10 hingga 30 pemain       | 4 GB                 | 6 GB          |
| Paket mod ringan, 40 hingga 80 mod             | 4 GB                 | 6 GB          |
| Paket besar "kitchen-sink", 150 hingga 300 mod | 6 hingga 8 GB        | 10 GB         |
| GregTech New Horizons dan monster serupa       | 8 hingga 12 GB       | 16 GB         |

Dua angka, bukan satu. Itulah bagian yang dilewati kebanyakan panduan, dan itulah alasan orang membeli server 4 GB, memberikan Java 4 GB, lalu melihatnya mati.

## Tumpukan (heap) dan mesin adalah angka yang berbeda

Tumpukan Java (`-Xmx`) adalah seberapa banyak memori yang dapat digunakan game itu sendiri untuk dunia, entitas, dan data mod. Mesin, atau kontainer, harus menampung tumpukan tersebut **ditambah** semua yang dibutuhkan Java lainnya: metadata kelas, tumpukan thread, pembukuan pengumpul sampah (garbage collector), buffer jaringan, dan JVM itu sendiri. Kelebihan beban itu kira-kira 0,5 hingga 1,5 GB untuk server modifikasi.

Jika tumpukan sama dengan memori mesin, kernel akan mematikan server saat Java mencoba menggunakan kelebihan beban itu. Di Docker, ini muncul sebagai kode keluar 137, dan di log tidak ada sama sekali: prosesnya lenyap begitu saja di tengah kalimat. Orang biasanya menyalahkan mod.

Aturan aman: **tumpukan ditambah 25 persen, dan setidaknya satu gigabyte cadangan.** Tumpukan 8 GB membutuhkan mesin 10 GB.

## Lebih banyak RAM bukan berarti performa lebih baik

Minecraft terikat pada satu utas (single-thread) dalam sebagian besar operasinya. Memberikan paket 40 mod 16 GB tidak membuat chunk dibuat lebih cepat; itu membuat setiap jeda pengumpulan sampah (garbage collection) lebih lama, karena ada lebih banyak yang harus diproses. Server yang tersendat setiap tiga puluh detik sering kali adalah server dengan tumpukan terlalu besar, bukan terlalu kecil.

Tingkatkan tumpukan saat Anda melihat ini, dan bukan sebaliknya:

- `java.lang.OutOfMemoryError: Java heap space` di log.
- Berulang kali "Can't keep up! Is the server overloaded?" dengan jeda pengumpulan sampah di timing.
- Penggunaan memori yang naik ke batas atas dan tetap di sana selama berjam-jam.

## Mengapa server Anda menunjukkan 12 GB terpakai padahal tidak ada yang online

Karena Anda menyuruhnya begitu. Dua pengaturan default berkonspirasi:

1. Gambar Docker umum mengatur tumpukan awal sama dengan maksimum, jadi `-Xms` dan `-Xmx` keduanya adalah angka Anda. Java mengklaimnya di muka daripada bertumbuh ke dalamnya.
2. Set bendera Aikar yang populer menyertakan `-XX:+AlwaysPreTouch`, yang memproses setiap halaman tumpukan itu saat startup sehingga halaman benar-benar dialokasikan. Ini disengaja: menukar boot yang lebih lambat dan angka idle yang besar untuk lebih sedikit jeda nanti.

Diukur pada Paper 1.21.1 dengan tumpukan 2 GB dalam kontainer 4 GB, diambil sampelnya selama tiga menit setelah dunia selesai dimuat:

| Konfigurasi                               | Memori residen |
| ----------------------------------------- | -------------- |
| Tanpa bendera                             | 2,60 GiB       |
| Bendera Aikar                             | 2,59 GiB       |
| Bendera Aikar tanpa `AlwaysPreTouch`      | 1,95 GiB       |
| Bendera Aikar dengan tumpukan awal 512 MB | 1,38 GiB       |
| Tanpa bendera dengan tumpukan awal 512 MB | 1,25 GiB       |

Jadi, server yang "menggunakan" 12 GB saat idle biasanya adalah tumpukan 12 GB yang telah disentuh sebelumnya (pre-touched), bukan kebocoran (leak). Pemantauan Anda membacanya dengan benar; angka itu hanya tidak berarti seperti kelihatannya.

Jika Anda menginginkan angka idle yang akurat, atur tumpukan awal lebih rendah dari maksimum. Anda membayarnya dengan sedikit lebih banyak pengumpulan sampah di awal. Jika Anda lebih suka waktu frame yang datar, biarkan saja dan berhenti melihat grafik.

## Pemain tidak sepenting yang Anda kira

Menggandakan dari 10 menjadi 20 pemain biayanya jauh lebih sedikit daripada menambahkan lima puluh mod. Pemain sebagian besar menambahkan entitas dan chunk yang dimuat, yang skalanya ringan. Mod menambahkan data kelas, registri, fitur pembuatan dunia, dan cache mereka sendiri, yang tidak. Ukur untuk paket terlebih dahulu, lalu tambahkan sekitar 100 hingga 200 MB per pemain reguler di server modifikasi.

Jarak pandang (view distance) adalah tuas besar lainnya. Menurunkan dari 12 menjadi 8 chunk dapat menghemat satu gigabyte pada server yang sibuk dan hampir tidak terlihat dalam permainan.

## Di Minecraft Server Manager

Setiap server memiliki dua bidang terpisah, **Tumpukan Java (Java heap)** dan **Batas memori kontainer (container memory limit)**, justru karena keduanya adalah pertanyaan yang berbeda. Wizard pembuatan mengatur batas kontainer 50 persen di atas tumpukan untuk Anda, dan panel menolak untuk menyimpan server yang batas kontainernya tidak di atas tumpukannya, karena kombinasi itu berakhir dengan kode keluar 137 daripada pesan kesalahan.

Meteran memori pada server menunjukkan apa yang sebenarnya digunakan kontainer, dengan catatan ketika tumpukan diklaim di muka, sehingga tumpukan yang disentuh sebelumnya (pre-touched) tidak terbaca sebagai lepas kendali. Server yang dimatikan kernel karena memori dicatat persis seperti itu dalam riwayat, daripada sebagai crash misterius.

Terkait: [membuat dan mengelola server](/docs/servers/),
[laporan crash](/docs/servers/#crash-reports--mclogs-analysis), [penyimpanan dan kuota](/docs/storage/).
