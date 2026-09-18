---
title: 'Cadangan'
description: 'Halaman Cadangan menampilkan setiap snapshot di seluruh armada Anda, beserta ukuran, alasan, dan usia.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Pencadangan** menampilkan setiap snapshot di seluruh armada Anda, beserta ukuran, alasan, dan usia.

![Pencadangan](/docs/images/backups.png)

## Membuat pencadangan

Dari tab **Pencadangan** sebuah server (atau melalui [jadwal](/docs/schedules/)) Anda dapat mengambil snapshot seluruh direktori server dalam satu klik. Panel akan menenangkan dunia terlebih dahulu (`save-off` → `save-all`), mengompresi data, lalu mengaktifkan kembali penyimpanan (`save-on`), sehingga pencadangan konsisten bahkan pada server yang sedang berjalan. Kompresi berjalan di thread pekerja latar belakang sehingga tidak menghentikan panel. Setiap pencadangan dapat disertai catatan.

Setiap arsip **diperiksa integritasnya** saat ditulis: panel membuka kembali zip dan membaca direktorinya. Arsip yang rusak atau tidak dapat dibuka akan dihapus dan panggilan pencadangan akan gagal saat itu juga, daripada masalahnya muncul berbulan-bulan kemudian ketika pemulihan adalah satu-satunya hal antara Anda dan kehilangan data. Arsip dengan entri nol (server yang belum pernah dimulai) diizinkan tetapi ditandai pada kejadian tersebut.

Centang **"Juga perkecil dunia sesudahnya"** (pada tab Pencadangan, atau dalam jadwal pencadangan) untuk menghapus potongan yang jarang dikunjungi setelah arsip berhasil ditulis (lihat **[Mengecilkan dunia](/docs/world-shrink/)**). Pengecilan hanya berjalan saat server dihentikan; pada server yang berjalan, pencadangan tetap terjadi dan pengecilan dilewati.

![Pencadangan server](/docs/images/server-backups.png)

## Alasan pencadangan

Pencadangan ditandai berdasarkan alasan pembuatannya:

- **manual** - Anda mengklik tombolnya.
- **terjadwal** - dibuat oleh [jadwal](/docs/schedules/). Setiap server baru juga secara otomatis diberi pencadangan terjadwal harian (diacak antara pukul 02:00 dan 05:59), sehingga server memiliki cakupan otomatis sejak hari pertama, bukan hanya sebelum pembaruan.
- **pra-pembaruan** - diambil secara otomatis sebelum peningkatan paket, sehingga peningkatan selalu dapat dibatalkan.
- **pra-pemulihan** - diambil secara otomatis tepat sebelum pemulihan atau pengaturan ulang dunia, sebagai jaring pengaman jika pemulihan tidak sesuai keinginan Anda.

## Retensi

Retensi dibatasi **per server, per alasan**: yang terbaru di setiap grup akan disimpan, yang lama akan dihapus secara otomatis setelah setiap pencadangan berhasil:

| Alasan        | Disimpan |
| ------------- | -------- |
| terjadwal     | 10       |
| pra-pembaruan | 10       |
| manual        | 20       |
| pra-pemulihan | 5        |

`pra-pemulihan` memiliki wadah kecilnya sendiri tepat agar pencadangan keamanan otomatis tidak pernah dapat menghapus pencadangan `manual` yang Anda simpan secara sengaja.

Dua batas opsional berlaku di atas jumlah per alasan, keduanya mati secara default: **usia maksimum** (pencadangan yang lebih tua dari N hari akan dihapus, apa pun alasannya) dan **ukuran total maksimum** per server (pencadangan tertua akan dihapus hingga totalnya pas, dimulai dari yang `pra-pemulihan`). Pencadangan terbaru server tidak pernah dihapus oleh batas apa pun. Semua ini dapat diubah secara global di halaman Pengaturan, dan ditimpa per server di tab Pencadangannya.

Pencadangan dapat **diganti namanya** dari daftar pencadangan (tombol ganti nama di setiap baris). Arsip di disk dan catatan panel bergerak bersama, sehingga pengunduhan, pemulihan, dan retensi terus berfungsi dengan nama baru.

![Mengganti nama pencadangan](/docs/images/backup-rename.png)

> Retensi dibatasi secara otomatis, tetapi arsip modded yang besar tetap dihitung terhadap [kuota disk](/docs/storage/) server, jadi pantau totalnya untuk paket besar.

## Memulihkan

Memulihkan pencadangan akan menghentikan server (memverifikasi bahwa kontainer benar-benar berhenti sebelum menyentuh file apa pun), mengambil pencadangan keamanan `pra-pemulihan`, mengganti **seluruh direktori server** dengan snapshot, dan membiarkannya berhenti agar Anda dapat memulai kembali. Karena peningkatan paket selalu mengambil pencadangan `pra-pembaruan` terlebih dahulu, Anda selalu dapat membatalkan peningkatan yang buruk.

## Basis data panel itu sendiri

Pencadangan server hanya mencakup direktori dunia per server. Basis data panel itu sendiri (`panel.db`, berisi pengguna, peran, rahasia 2FA, jadwal, pin paket, dan riwayat) di-snapshot secara terpisah pada timer pemeliharaan harian:

- `VACUUM INTO` menulis salinan yang konsisten dan terfragmentasi ke `data/backups/_panel/`; **14** yang terbaru disimpan.
- Saat boot, panel menjalankan `PRAGMA integrity_check` dan mencatat dengan keras jika gagal, mengarahkan Anda ke `data/backups/_panel` untuk salinan yang baik terbaru.

Cadangkan seluruh pohon `data/` (juga berisi `.secret-key`, kunci enkripsi saat istirahat) dan Anda telah mencadangkan semuanya.
