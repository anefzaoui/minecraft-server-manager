---
title: 'Cadangan'
description: 'Halaman Cadangan menampilkan setiap snapshot di seluruh armada Anda, beserta ukuran, alasan, dan usia, dapat difilter berdasarkan server dan alasan.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Pencadangan** menampilkan setiap snapshot di seluruh armada Anda, beserta ukuran, alasan, dan usia, dapat difilter berdasarkan server dan alasan.

![Pencadangan](/docs/images/backups.png)

## Membuat pencadangan

Dari tab **Pencadangan** server (atau melalui [jadwal](/docs/schedules/)) Anda dapat membuat snapshot seluruh direktori server dalam satu klik. Panel akan menghentikan dunia terlebih dahulu (`save-off` → `save-all`), mengompresi data, lalu mengaktifkan kembali penyimpanan (`save-on`), sehingga pencadangan konsisten bahkan pada server yang sedang berjalan. Kompresi berjalan di utas pekerja latar belakang sehingga tidak menghentikan panel. Pencadangan yang dimulai melalui API dapat menyertakan catatan.

Setiap arsip **diperiksa integritasnya** saat ditulis: panel membuka kembali zip dan membaca direktorinya. Arsip yang rusak atau tidak dapat dibuka akan dihapus dan panggilan pencadangan akan gagal saat itu juga, daripada masalahnya muncul berbulan-bulan kemudian ketika pemulihan adalah satu-satunya hal yang memisahkan Anda dari kehilangan data. Arsip dengan entri nol (server yang belum pernah dimulai) diizinkan tetapi ditandai pada kejadian tersebut.

Centang **"Juga perkecil dunia setelahnya"** (di tab Pencadangan, atau dalam jadwal pencadangan) untuk menghapus chunk yang jarang dikunjungi setelah arsip ditulis dengan aman (lihat **[Mengecilkan dunia](/docs/world-shrink/)**). Pengecilan hanya berjalan saat server dihentikan; pada server yang berjalan, pencadangan tetap terjadi dan pengecilan dilewati.

![Pencadangan server](/docs/images/server-backups.png)

## Alasan pencadangan

Pencadangan ditandai berdasarkan alasan pembuatannya:

- **manual**: Anda mengklik **Cadangkan Sekarang**. Mengganti dunia aktif server dengan yang dari pustaka juga akan membuat cadangan `manual` terlebih dahulu.
- **terjadwal**: dibuat oleh [jadwal](/docs/schedules/). Setiap server baru juga secara otomatis diberi cadangan terjadwal harian (diacak antara pukul 02:00 dan 05:59), sehingga server memiliki cakupan otomatis sejak hari pertama, bukan hanya sebelum pembaruan.
- **pra-pembaruan**: dibuat secara otomatis sebelum peningkatan paket atau perubahan versi Minecraft, sehingga peningkatan selalu dapat dibatalkan.
- **pra-pemulihan**: dibuat secara otomatis tepat sebelum pemulihan atau pengaturan ulang dunia, sebagai jaring pengaman jika pemulihan tidak sesuai keinginan Anda.

## Retensi

Retensi dibatasi **per server, per alasan**: yang terbaru di setiap grup akan disimpan, yang lama akan dihapus secara otomatis setelah setiap pencadangan berhasil:

| Alasan        | Disimpan secara default |
| ------------- | ----------------------- |
| terjadwal     | 10                      |
| pra-pembaruan | 10                      |
| manual        | 20                      |
| pra-pemulihan | 5                       |

`pra-pemulihan` (disebut cadangan keamanan di panel) memiliki wadah kecilnya sendiri justru agar cadangan keamanan otomatis tidak pernah menggantikan cadangan `manual` yang Anda simpan dengan sengaja.

Dua batas opsional berlaku di atas jumlah per alasan, keduanya nonaktif secara default: **usia maksimum** (cadangan yang lebih tua dari N hari akan dihapus, apa pun alasannya) dan **ukuran total maksimum** per server (yang tertua akan dihapus hingga totalnya pas: cadangan keamanan terlebih dahulu, lalu yang terjadwal, lalu sisanya). Cadangan terbaru server tidak pernah dihapus oleh kedua batas tersebut.

### Mengubahnya

Admin mengatur kebijakan seluruh panel di kartu **Retensi Pencadangan** pada halaman **Pengaturan** (**Isi Bawaan** memasukkan default di atas kembali ke formulir, siap untuk disimpan). Server dapat berbeda pada salah satu dari enam nilai: buka tab **Pencadangan** dan perluas **Retensi untuk Server Ini**. Setiap bidang di sana kosong kecuali server tersebut mengaturnya, dan bidang kosong mengikuti nilai seluruh panel (ditampilkan di dalamnya). Jadi, server dapat, misalnya, menyimpan 3 cadangan terjadwal dan menggunakan nilai seluruh panel untuk yang lainnya; mengosongkan bidang mengembalikannya ke nilai seluruh panel.

![Kartu Retensi Pencadangan di Pengaturan](/docs/images/settings-retention.png)

![Retensi untuk Server Ini di tab Pencadangan server](/docs/images/server-retention.png)

Menyimpan tidak pernah menghapus apa pun dengan sendirinya. Jika batas baru akan meninggalkan cadangan yang ada di atas batas, panel akan mencantumkan, per server, berapa banyak cadangan dari setiap jenis yang akan hilang, berapa banyak ruang yang dibebaskan, dan berapa usia yang tertua. Ini juga mengatakan kapan server sudah melebihi batasnya sebelum perubahan ini (misalnya setelah **Dari Pencadangan Berikutnya** sebelumnya), karena menerapkan sekarang memangkas semua yang melebihi batas, bukan hanya apa yang ditambahkan oleh edit ini. Kemudian ia bertanya bagaimana menerapkannya:

- **Hapus Sekarang** menghapus persis cadangan yang baru saja dicantumkan, tidak lebih: cadangan yang dibuat di antaranya menunggu pemangkasan berikutnya. Dari halaman Pengaturan, server yang sedang dalam proses pemulihan, pencadangan, atau tindakan serupa akan dilewati dan dipangkas setelah pencadangan berikutnya; di tab Pencadangan server itu sendiri, Anda diminta untuk mencoba lagi setelah tindakan tersebut selesai. Saat cadangan lama server sedang dihapus (biasanya detik), tindakan lain pada server tersebut harus menunggu: pencadangan terjadwal atau mulai yang terjadi saat itu akan mencoba lagi setiap menit hingga berhasil (hingga 30 menit), server yang macet akan dimulai ulang dalam waktu sekitar 20 detik setelah selesai (hingga 30 menit), dan pemulihan atau penghentian terjadwal yang bertabrakan dengannya akan dilewati hingga waktu berikutnya.
- **Dari Pencadangan Berikutnya** menyimpannya untuk saat ini; setiap server memangkas cadangannya pada saat ia membuat yang berikutnya, seperti yang selalu dilakukannya.

![Dialog yang mencantumkan apa yang akan dihapus oleh batas baru](/docs/images/retention-preview.png)

Cadangan yang sedang dipulihkan tidak pernah dihapus saat pemulihan berjalan: retensi membiarkannya saja (dan tidak menghapus cadangan lain untuk memberi ruang baginya), dan menghapusnya secara manual ditolak sampai pemulihan selesai.

Pengaturan yang sama tersedia untuk skrip sebagai endpoint API admin: `GET`/`POST /api/backups/retention` dan `/api/servers/:id/backups/retention`. Nilai seluruh panel tidak bisa `null`. Untuk server, nilai `null` (atau `""`) menghapus kunci tersebut, sehingga kembali mengikuti nilai seluruh panel, dan `{ "reset": true }` menghapus semuanya. Di bawah kedua jalur tersebut, `POST …/preview` melaporkan apa yang akan dihapus oleh perubahan tanpa menghapusnya (`backups`, `bytes`, `servers`, `ids` dan rincian per server `byServer`), dan `POST …/apply` menerapkan kebijakan yang disimpan sekarang dan menjawab `{ deleted, skipped }` seluruh panel (`skipped` menghitung server yang sibuk) atau `{ deleted }` untuk satu server. Kirim `POST` pratinjau `{ "token": "..." }` (disimpan selama 10 menit) atau `{ "ids": [...] }` untuk menghapus hanya yang itu; tanpa keduanya, semua yang melebihi batas akan hilang. Penerapan per server pada server yang sibuk akan menjawab 409.

Pencadangan dapat **diganti namanya** dari daftar cadangan (tombol ganti nama pada setiap baris). Arsip di disk dan catatan panel bergerak bersama, sehingga unduhan, pemulihan, dan retensi terus bekerja dengan nama baru.

![Mengganti nama cadangan](/docs/images/backup-rename.png)

> Retensi dibatasi secara otomatis, tetapi arsip modded besar masih dihitung terhadap [kuota disk](/docs/storage/) server Anda, jadi perhatikan totalnya untuk paket besar.

## Pemulihan

Memulihkan cadangan akan menghentikan server (memverifikasi bahwa kontainer benar-benar berhenti sebelum menyentuh file apa pun), membuat cadangan keamanan `pra-pemulihan`, mengganti **seluruh direktori server** dengan snapshot, dan membiarkannya berhenti agar Anda dapat memulai kembali. Arsip dibongkar ke samping terlebih dahulu dan baru ditukar setelah sepenuhnya diekstrak, sehingga pemulihan yang gagal di tengah jalan membiarkan file saat ini tidak tersentuh. Karena peningkatan paket selalu membuat cadangan `pra-pembaruan` terlebih dahulu, Anda selalu dapat mengembalikan peningkatan yang buruk.

## Basis data panel itu sendiri

Cadangan server hanya mencakup folder server itu sendiri. Basis data panel itu sendiri (`panel.db`, berisi pengguna, peran, rahasia 2FA, jadwal, pin paket, dan riwayat) di-snapshot secara terpisah pada timer pemeliharaan harian:

- `VACUUM INTO` menulis salinan yang konsisten dan terfragmentasi ke `backups/_panel/` di folder data; **14** yang terbaru disimpan.
- Saat boot, panel menjalankan `PRAGMA integrity_check` dan mencatat dengan keras jika gagal, mengarahkan Anda ke `backups/_panel` untuk salinan baik terbaru.

Cadangkan seluruh folder data (ini juga berisi `.secret-key`, kunci enkripsi saat istirahat) dan Anda telah mencadangkan semuanya.
