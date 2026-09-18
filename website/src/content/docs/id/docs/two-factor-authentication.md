---
title: 'Autentikasi dua faktor'
description: 'Autentikasi dua faktor (2FA) menambahkan langkah kedua saat masuk: setelah kata sandi Anda, Anda memasukkan kode singkat dari aplikasi autentikator di ponsel Anda.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Autentikasi dua faktor (2FA) menambahkan langkah kedua saat masuk: setelah kata sandi Anda, Anda memasukkan kode singkat dari aplikasi autentikator di ponsel Anda. Sekalipun seseorang mengetahui kata sandi Anda, mereka tidak dapat masuk tanpa perangkat Anda.

Ini berfungsi dengan otentikator TOTP standar apa pun (Google Authenticator, Authy, 1Password, Microsoft Authenticator, dan lainnya), dan tersedia untuk **setiap** akun, bukan hanya admin. Melindungi login Anda sendiri bukanlah tindakan manajemen server, jadi penonton dan operator juga dapat mengaktifkannya.

## Mengaktifkan 2FA

Buka menu akun (inisial Anda, kanan atas) dan pilih **Autentikasi dua faktor**.

![Menu akun](/docs/images/2fa-user-menu.png)

Anda akan mendapatkan dialog pendaftaran:

![Daftar](/docs/images/2fa-enroll.png)

1. **Pindai kode QR** dengan aplikasi autentikator Anda, atau ketuk **Salin** dan masukkan kunci manual secara manual.
2. Ketik **kode 6 digit** yang sekarang ditampilkan oleh aplikasi Anda.
3. **Konfirmasikan kata sandi Anda.** Mengaktifkan 2FA memeriksa ulang kata sandi Anda, jadi sesi terbuka yang tidak disengaja tidak dapat mengaktifkannya dengan perangkat orang lain.
4. Klik **Aktifkan**.

### Simpan kode cadangan Anda

Saat 2FA diaktifkan, panel akan menampilkan serangkaian **kode cadangan** sekali pakai.

![Kode cadangan](/docs/images/2fa-backup-codes.png)

Setiap kode berfungsi **sekali**, untuk masuk jika Anda kehilangan akses ke aplikasi autentikator Anda. Simpan di tempat yang aman (pengelola kata sandi ideal) karena kode tersebut tidak akan ditampilkan lagi. Anda dapat membuat ulang set baru kapan saja (yang akan membatalkan yang lama).

## Masuk dengan 2FA

Sejak saat itu, masuk memiliki langkah kedua. Setelah nama pengguna dan kata sandi Anda, panel akan meminta kode Anda:

![Masuk 2FA](/docs/images/2fa-login-challenge.png)

Masukkan kode 6 digit saat ini dari aplikasi Anda (atau salah satu kode cadangan Anda) dan Anda masuk. Hingga Anda menyelesaikan langkah ini, sesi **tidak** masuk: sesi tersebut tidak dapat mengakses halaman atau API apa pun.

## Mengelola atau menonaktifkan 2FA

Buka entri **Autentikasi dua faktor** yang sama di menu akun saat diaktifkan. Setelah mengonfirmasi kata sandi Anda, Anda dapat:

- **Buat ulang kode cadangan** - menerbitkan set baru dan menghentikan yang lama.
- **Nonaktifkan 2FA** - menghapusnya dari akun Anda.

Keduanya memeriksa ulang kata sandi Anda saat ini terlebih dahulu.

## Kehilangan ponsel _dan_ kode cadangan Anda?

**Admin** dapat mengatur ulang 2FA pengguna lain dari **Pengaturan → Pengguna** (tombol **Atur Ulang** di kolom 2FA). Itu menghapus 2FA untuk akun sehingga pengguna dapat masuk hanya dengan kata sandi mereka dan mengaturnya kembali. Admin tidak dapat mengatur ulang 2FA _mereka sendiri_ tanpa kata sandi. Mereka melalui penonaktifan normal yang memerlukan kata sandi, sehingga sesi admin yang dibajak tidak dapat menghapus faktor kedua mereka sendiri.

## Baik untuk diketahui

- Kode berbasis waktu dan berputar setiap 30 detik; panel menerima sedikit penyimpangan jam, dan diam-diam pulih jika jam server kemudian dikoreksi.
- Kode tidak dapat diputar ulang - setelah digunakan untuk masuk, kode yang sama tidak akan berfungsi lagi dalam jendelanya.
- Kode yang salah dibatasi lajunya. Pembatas **dibagikan** dengan langkah kata sandi (penguncian per akun ditambah pembatas `RATE_LIMIT_AUTH_PER_15MIN` per IP), jadi memasukkan kata sandi yang benar tidak dapat mengatur ulang penghitung tepat sebelum menebak kode 6 digit.
- Perubahan 2FA (mengaktifkan, menonaktifkan, mengatur ulang, penggunaan kode cadangan) semuanya dicatat dalam [Log Aktivitas](/docs/activity/).
