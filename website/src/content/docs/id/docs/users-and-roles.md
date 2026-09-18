---
title: 'Pengguna & peran'
description: 'Panel ini mendukung banyak pengguna.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Kembali ke indeks docs](/docs/)

Panel ini mendukung banyak pengguna. Kelola akun di bawah **Pengaturan → Pengguna**.

![Pengguna](/docs/images/settings-users.png)

## Tiga peran

| Peran        | Dapat melakukan                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Semuanya: mengelola pengguna, kunci API, file global, penimpaan Docker lanjutan, dan setiap tindakan server.                                     |
| **operator** | Menjalankan dan mengonfigurasi server (mulai/berhenti, konsol, cadangan, dunia, mod, sebagian besar pengaturan), tetapi bukan area khusus admin. |
| **penonton** | Hanya baca. Melihat server dan statusnya, tetapi tidak melakukan perubahan apa pun.                                                              |

Setiap pengguna, termasuk penonton, dapat mengelola [otentikasi dua faktor](/docs/two-factor-authentication/) mereka sendiri, karena melindungi login Anda sendiri bukanlah tindakan manajemen server.

## Khusus admin, dan mengapa

Beberapa hal sengaja dibatasi untuk admin:

- **Manajemen pengguna, kunci API, dan file global.**
- **[API publik](/docs/public-api/)** - mengaktifkan `/api/v1` dan membuat, membatasi cakupan, atau mencabut token Bearer hanya-baca.
- **Penimpaan Docker lanjutan** - nama kontainer kustom, publikasi port tambahan, dan bind mount. Bind mount dapat memetakan jalur host apa pun ke dalam kontainer, dan dikombinasikan dengan akses Docker panel, itu secara efektif sama dengan root di host. Bidang-bidang ini hanya muncul untuk admin.

Nama kontainer kustom juga tidak dapat berada dalam namespace `msm-` panel itu sendiri, sehingga kontainer yang diberi nama secara manual tidak akan pernah dapat membayangi server lain dan mengarahkan perintah stop atau perintah ke instance yang salah.

## Mengelola akun

![Gambar profil](/docs/images/profile-picture.png)

Admin dapat membuat pengguna, mengubah peran, mengatur ulang kata sandi, dan menghapus akun dari tabel Pengguna. Kolom **2FA** menunjukkan apakah setiap pengguna telah mengaktifkan otentikasi dua faktor; admin dapat **mengatur ulang** 2FA pengguna lain (untuk kasus kehilangan ponsel dan kode cadangan), tetapi tidak pernah menonaktifkan 2FA mereka sendiri tanpa kata sandi mereka, yang ditangani oleh alur swalayan.

Login yang gagal dibatasi lajunya per akun (baik penghitung per-IP maupun penghitung global akun) untuk memperlambat upaya brute-force, dan batas yang sama mencakup langkah kode 2FA sehingga kata sandi yang benar tidak dapat mengatur ulang penghitung sebelum menebak kode. Di depannya terdapat pembatas permintaan per-IP klien yang lebih kasar pada endpoint login / 2FA / penyiapan, yang dapat disetel melalui `RATE_LIMIT_AUTH_PER_15MIN` (default 100; di belakang reverse proxy, setel `TRUST_PROXY` agar mengacu pada IP klien yang sebenarnya).
