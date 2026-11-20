---
title: 'Undangan & halaman status'
description: 'Undang teman ke server dengan alamat, versi, dan modpack klien, serta bagikan halaman status publik yang hanya menampilkan apa yang Anda pilih.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Dua tab di bawah grup **Pengaturan** server membantu pemain menemukannya dan bergabung: **Undangan** menulis semua yang dibutuhkan teman untuk terhubung, dan **Halaman Status** menerbitkan halaman publik kecil yang menunjukkan apakah server aktif. Keduanya memerlukan izin **Pengaturan** server ([pengguna & peran](/docs/users-and-roles/#per-server-permissions)).

## Undangan

**Pengaturan → Undangan** memiliki kartu **Undang Teman**:

- **Alamat untuk dibagikan** mencantumkan alamat mesin di jaringan lokal Anda dengan port game server, alamat publik Anda saat panel mendeteksinya (pemain di luar jaringan Anda hanya dapat mengaksesnya melalui penerusan port), dan **Alamat Kustom…** untuk domain atau alamat yang Anda siapkan sendiri, seperti `play.example.com:25565`.
- **Teks Undangan** adalah pesan siap tempel dengan nama server, alamat yang Anda pilih, serta versi dan jenis Minecraft-nya. **Salin Teks Undangan** menyalinnya ke clipboard. Saat daftar putih aktif, teks tersebut meminta teman untuk nama pengguna Minecraft mereka, dan kartu mengingatkan Anda untuk menambahkan setiap teman di tab **Pemain** sebelum mereka bergabung.
- **Apa yang dibutuhkan teman** menyatakan apa yang ada di sisi pemain: tidak ada selain versi Minecraft yang tepat untuk server vanilla atau plugin (Paper dan sejenisnya), atau mod server untuk yang dimodifikasi.

### Modpack klien

Pada server yang dimodifikasi, kartu ini juga menawarkan **Unduh Modpack Klien (.mrpack)**. Teman mengimpornya ke Prism Launcher atau Aplikasi Modrinth, yang menginstal versi Minecraft dan pemuat mod server, mengunduh mod, dan menambahkan server ke daftar multipemain mereka dengan alamat yang Anda pilih.

File tersebut dibuat dari mod yang Anda tambahkan sendiri ke server (lapisan mod kustom) yang berasal dari Modrinth. Mod dari sumber lain terdaftar di kartu, sehingga teman dapat menambahkan file tersebut ke folder `mods` mereka secara manual. Pada server yang dibuat dari modpack, teman harus menginstal paket tersebut, pada versi yang dijalankan server, di peluncur mereka; tab **Tinjauan** menunjukkan versinya.

### Bermain melalui internet

**Bermain melalui internet (penerusan port)** di bagian bawah kartu menjelaskan sisi router: teruskan port game server (TCP dan UDP) ke mesin yang menjalankan panel, lalu bagikan alamat publik Anda dengan port tersebut. Jika penyedia internet Anda menggunakan CGNAT, penerusan port tidak dapat berfungsi, dan layanan terowongan (misalnya playit.gg) adalah solusinya. Panel tidak membuka port router dengan sendirinya. Hanya port game yang boleh diakses internet; jaga agar port panel sendiri dan port RCON tetap tertutup ([port sekilas](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Halaman Status

**Pengaturan → Halaman Status** mengaktifkan halaman publik untuk satu server, nonaktif secara default:

1. Aktifkan kartu.
2. Pilih **Alamat Halaman**: halaman tersebut berada di `/status/<alamat>` pada panel Anda, dan alamatnya adalah 3 hingga 40 huruf kecil, angka, atau tanda hubung, unik di seluruh server Anda.
3. Tekan **Simpan**. **Buka Halaman** dan **Salin Tautan** kemudian memberi Anda tautan untuk dibagikan.

Siapa pun yang memiliki tautan akan melihat nama server, MOTD-nya, versi, apakah sedang berjalan, jumlah pemain dan waktu aktifnya, dan tidak ada lagi. Halaman tersebut tidak memiliki tautan ke panel dan tidak memerlukan masuk. Halaman tersebut membaca status memori panel, sehingga pengunjung tidak pernah menyebabkan pekerjaan pada daemon Docker.

Mematikan halaman akan menyimpan alamatnya, sehingga mengaktifkannya kembali akan memulihkan tautan yang sama. Untuk halaman atau bot Anda sendiri, [API publik](/docs/public-api/) mengembalikan jenis status yang sama dalam format JSON.

Terkait: [Notifikasi Discord](/docs/integrations/), [peta langsung](/docs/live-map/), [membuat dan mengelola server](/docs/servers/).
