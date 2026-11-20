---
title: 'Pengguna & peran'
description: 'Akun, peran admin, operator, dan penampil, serta izin per server di Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Panel ini mendukung banyak pengguna. Kelola akun di bawah **Pengaturan → Pengguna**.

![Pengguna](/docs/images/settings-users.png)

## Tiga peran

| Peran        | Default di setiap server                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Semuanya: mengelola pengguna, kunci API, file global, penimpaan Docker lanjutan, dan setiap tindakan server.                                     |
| **operator** | Menjalankan dan mengonfigurasi server (mulai/berhenti, konsol, cadangan, dunia, mod, sebagian besar pengaturan), tetapi bukan area khusus admin. |
| **penonton** | Hanya baca. Melihat server dan statusnya, tetapi tidak melakukan perubahan.                                                                      |

Setiap pengguna, termasuk penonton, dapat mengelola [otentikasi dua faktor](/docs/two-factor-authentication/) mereka sendiri, karena melindungi login Anda sendiri bukanlah tindakan manajemen server.

Sebuah peran adalah **default** untuk setiap server. Untuk memberikan hak yang berbeda kepada seseorang di satu server, gunakan izin per-server di bawah ini.

## Izin per-server

Halaman **Izin** (di bilah sisi, atau **Izin Server** di bawah **Pengaturan → Pengguna**) menampilkan tabel: setiap operator dan penonton di sisi kiri, setiap server di bagian atas. Klik sel untuk memutuskan apa yang boleh dilakukan pengguna tersebut di satu server itu. Admin tidak terdaftar karena mereka selalu memiliki segalanya.

![Izin](/docs/images/settings-permissions.png)

Setiap sel adalah sekumpulan izin:

| Izin           | Apa yang diizinkan di server itu                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Lihat**      | Melihat server, statusnya, output konsol, pemain, riwayat, dan statistik.                                          |
| **Daya**       | Memulai, menghentikan, memulai ulang, mematikan, dan membangun ulang server.                                       |
| **Konsol**     | Menjalankan perintah konsol dan tindakan cepat dunia, mengirim obrolan, dan mengelola perintah obrolan.            |
| **Pemain**     | Mengeluarkan, memblokir, memasukkan ke daftar putih, memberi op, dan mengedit catatan pemain.                      |
| **Konten**     | Menginstal dan menghapus mod, plugin, paket, dunia, paket data, dan mengedit inventaris.                           |
| **Cadangan**   | Membuat, memulihkan, mengunduh, dan menghapus cadangan.                                                            |
| **File**       | Menjelajahi, mengedit, mengunggah, dan mengunduh file server, log terarsip, dan bundel log; mengekspor cetak biru. |
| **Pengaturan** | Mengubah pengaturan server, properti, integrasi, ikon, dan meningkatkan versi.                                     |
| **Hapus**      | Menghapus server.                                                                                                  |

![Editor izin](/docs/images/permissions-editor.png)

Di bawah tabel, **Apa yang Dicakup Setiap Izin** membuka setiap izin menjadi apa yang dapat dilakukan seseorang, apa yang tidak termasuk, dan rute panel persis yang dibukanya. Daftar terakhir itu diperiksa terhadap kode yang berjalan oleh rangkaian pengujian.

![Referensi izin](/docs/images/permissions-reference.png)

Di ponsel, tabel ditumpuk menjadi satu kartu per pengguna, dengan satu baris per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Izin di ponsel" width="180">
</p>

Bagaimana bagian-bagiannya saling terkait:

- **Peran adalah default.** Seorang operator dimulai dengan setiap izin di setiap server; seorang penonton dimulai hanya dengan Lihat. Sel dalam teks samar (petunjuknya mengatakan "Default peran") belum pernah diubah.
- **Sebuah sel menimpa peran hanya untuk server itu.** Berikan Penonton Daya dan Konsol di satu server dan mereka dapat menjalankannya, sementara semua server lain tetap hanya baca untuk mereka. Hapus Hapus dari operator di server utama Anda dan mereka tetap memiliki segalanya di sana.
- **Setiap izin mencakup Lihat.** Anda tidak dapat bertindak pada server yang tidak dapat Anda lihat.
- **Matikan semuanya untuk menyembunyikan server.** Server tersebut menghilang dari bilah sisi pengguna, dasbor, cadangan, jadwal, aktivitas, pembaruan, paket mod, status langsung, tugas yang berjalan, dan cetak biru, dan pustaka dunia berhenti menamainya. Tautan langsung, panggilan API, atau soket konsol menjawab "tidak ditemukan", sama seperti server yang tidak ada.
- **Tindakan di seluruh panel masih mengikuti peran.** Membuat server (termasuk mengkloning satu), penyimpanan, pengguna, kunci API, pengaturan global, dan jadwal di seluruh panel bukanlah per-server, jadi penonton dengan izin di beberapa server masih tidak dapat melakukan salah satu dari itu. Operator menyimpan pembuatan server dan jadwal di seluruh panel; penyimpanan, pengguna, kunci API, dan pengaturan global adalah khusus admin.
- **Jadwal mengikuti server.** Mulai ulang, cadangan, atau perintah terjadwal di server memerlukan izin yang cocok di sana (Daya, Cadangan, atau Konsol), apa pun perannya.
- **Cetak biru juga mengikuti server.** Mengekspor server sebagai cetak biru memerlukan File di sana, karena arsip membawa file-filenya. Cetak biru yang diekspor dari server yang tidak dapat dilihat seseorang juga disembunyikan dari mereka.
- **Area khusus admin tetap khusus admin** di setiap server: chatbot, retensi cadangan, dan penimpaan Docker lanjutan.

Setiap perubahan ditulis ke log aktivitas dengan siapa mengubah apa; entri tersebut ditampilkan hanya kepada admin. Menghapus pengguna menghapus baris mereka. Menghapus server tetap ada, jadi server yang disembunyikan dari seseorang tetap tersembunyi dalam riwayat dan cadangan yang disimpan.

Instalasi yang ada terus berfungsi tanpa perubahan: sampai admin mengedit sel, setiap pengguna memiliki persis apa yang diberikan peran mereka sebelumnya.

## Khusus admin, dan mengapa

Beberapa hal sengaja dibatasi untuk admin:

- **Manajemen pengguna, penyimpanan, pengaturan global, kunci API, dan file global.**
- **[API publik](/docs/public-api/)**: mengaktifkan `/api/v1` dan membuat, membatasi cakupan, atau mencabut token Bearer hanya-baca.
- **Penimpaan Docker lanjutan**: nama kontainer kustom, publikasi port tambahan, dan mount bind. Mount bind dapat memetakan jalur host apa pun ke dalam kontainer, dan dikombinasikan dengan akses Docker panel, itu secara efektif adalah root di host. Bidang-bidang ini hanya muncul untuk admin.

Nama kontainer kustom juga tidak dapat berada di namespace `msm-` panel itu sendiri, sehingga kontainer yang diberi nama secara manual tidak akan pernah dapat membayangi server lain dan salah mengarahkan penghentian atau perintah ke instance yang salah.

## Mengelola akun

![Gambar profil](/docs/images/profile-picture.png)

Admin dapat membuat pengguna, mengubah peran, mengatur ulang kata sandi, dan menghapus akun dari tabel Pengguna. Kolom **2FA** menunjukkan apakah setiap pengguna telah mengaktifkan dua faktor; admin dapat mengatur ulang 2FA pengguna lain dengan **Atur Ulang 2FA** di menu tindakan pengguna tersebut (untuk kasus ponsel hilang dan kode cadangan), tetapi tidak pernah menonaktifkan milik mereka sendiri tanpa kata sandi mereka, yang ditangani oleh alur layanan mandiri.

Login yang gagal dibatasi lajunya per akun (baik penghitung per-IP maupun global akun) untuk memperlambat upaya brute-force, dan batas yang sama mencakup langkah kode 2FA sehingga kata sandi yang benar tidak dapat mengatur ulang penghitung sebelum menebak kode. Di depan itu terdapat pembatas permintaan per-IP klien yang lebih kasar pada titik akhir login / 2FA / penyiapan, dapat disetel melalui `RATE_LIMIT_AUTH_PER_15MIN` (default 100; di belakang proxy terbalik, atur `TRUST_PROXY` sehingga mengacu pada IP klien yang sebenarnya).
