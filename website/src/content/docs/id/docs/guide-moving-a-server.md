---
title: 'Memindahkan server Minecraft ke host lain'
description: 'Memindahkan dunia itu mudah. Memindahkan server yang masih bisa diakses pemain, dengan inventaris, rumah, dan izin mereka tetap utuh, adalah bagian yang sering bermasalah.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Memindahkan dunia itu mudah. Memindahkan server yang masih bisa diakses pemain, dengan inventaris, rumah,
dan izin yang utuh, adalah bagian yang seringkali salah. Urutan di bawah ini meminimalkan waktu henti menjadi beberapa
menit dan tetap menyediakan jalan kembali jika mesin baru mengecewakan.

## Inventarisasi dulu

Catat ini sebelum Anda menyentuh apa pun. Setiap poin di bawah ini telah menyebabkan migrasi gagal karena
dianggap remeh daripada diperiksa:

- **Versi dan loader Minecraft**, persis. 1.20.1 NeoForge bukan 1.20.1 Forge.
- **Daftar mod atau plugin beserta versinya.** Dunia tidak akan bisa dimuat tanpa mod yang membuatnya.
- **Versi Java**, yang mengikuti versi Minecraft.
- **`level-name`** dari `server.properties`. Folder dunia seringkali tidak bernama `world`.
- **Mode online.** Jika server lama berjalan dengan `online-mode=false` dan yang baru berjalan dengan mode aktif, atau
  sebaliknya, setiap pemain akan mendapatkan UUID yang berbeda dan oleh karena itu inventaris yang benar-benar baru dan kosong. Ini
  adalah kesalahan paling menyakitkan di halaman ini.
- **Apa pun yang berada di luar folder server**, seperti database MySQL untuk plugin.

## Salin saat berjalan, lalu salin lagi saat berhenti

Kunci untuk waktu henti yang singkat adalah melakukan penyalinan lambat terlebih dahulu.

1. **Saat server berjalan**, salin seluruh direktori server ke mesin baru. Pada dunia yang besar
   ini mungkin memakan waktu satu jam; tidak ada yang menyadarinya, karena tidak ada yang berhenti.
2. **Umumkan restart, lalu hentikan server dengan benar.** Penghentian yang baik membuat game menyimpan dunia; mematikan proses tidak.
3. **Salin lagi.** Kali ini hanya file yang berubah yang dipindahkan, jadi hanya butuh detik hingga menit.
4. **Mulai di mesin baru**, pada port non-publik jika memungkinkan, dan masuklah sendiri. Periksa markas yang Anda kenal, inventaris Anda sendiri, dan pastikan plugin atau mod dimuat tanpa kesalahan.
5. **Kemudian** arahkan pemain ke sana.

`rsync -a --delete` adalah alat yang biasa digunakan untuk langkah 1 dan 3. Pertahankan izin dan stempel waktu: dunia
yang disalin oleh pengguna yang salah adalah server yang tidak akan bisa dimulai, dan kesalahannya tidak akan menyatakannya dengan jelas.

## Jangan hapus yang lama dulu

Simpan mesin lama, dalam keadaan mati tetapi utuh, setidaknya selama beberapa hari. Itu adalah satu-satunya cara pemulihan yang sebenarnya. Jaga agar tetap mati daripada berjalan, agar tidak ada yang secara tidak sengaja bergabung dengan salinan yang ditinggalkan dan membangun di sana selama seminggu.

## Buat alamat tetap sama setelah pindah

Jika pemain terhubung ke alamat IP mentah, setiap perpindahan memaksa setiap pemain untuk mengedit daftar server mereka, dan beberapa dari mereka tidak pernah melakukannya.

Gunakan nama host yang Anda kontrol, diarahkan ke server. Perpindahan kemudian menjadi perubahan DNS, dan alamat di klien semua orang tetap sama. Turunkan waktu hidup (TTL) rekaman satu hari sebelum perpindahan agar perubahan menyebar dengan cepat.

Jika Anda ingin pemain mengetik domain mentah saat server berjalan pada port non-standar, rekaman SRV melakukan itu. Ini adalah mekanisme yang sama yang digunakan host komersial untuk memberikan `play.something.net`.

## Periksa mesin baru sebelum mempercayainya

Tiga hal yang berbeda antar host dan seringkali menjadi masalah setelah perpindahan:

- **Firewall.** Port game Anda harus terbuka, dan hanya port game Anda. Jangan mengekspos panel manajemen atau peta ke internet hanya karena berfungsi di localhost.
- **Kecepatan inti tunggal.** Minecraft jauh lebih peduli tentang seberapa cepat satu inti berjalan daripada berapa banyak inti yang ada.
  Delapan inti yang lambat akan terasa lebih buruk daripada dua inti yang cepat.
- **Disk.** Dunia di penyimpanan berputar atau volume yang sangat dibagikan akan tersendat saat memuat chunk.

## Meninggalkan panel terkelola

Jika Anda berasal dari host yang memberi Anda panel kontrol daripada mesin, temukan unduhan atau manajer file, dan ambil seluruh direktori server daripada hanya dunianya. Dapatkan file jar plugin dan mod itu sendiri, bukan daftarnya: versi itu penting, dan "terbaru" adalah file yang berbeda bulan depan.

Periksa juga cadangan Anda adalah milik Anda. Cadangan yang hanya ada di dalam panel yang Anda tinggalkan bukanlah cadangan yang Anda miliki.

## Di Minecraft Server Manager

Seluruh panel adalah satu direktori. Menyalinnya ke mesin lain dan memulai panel di sana akan membawa setiap server, dunia, cadangan, dan pengaturan bersamanya, yang membuat perpindahan panel itu sendiri menjadi penyalinan daripada migrasi.

Untuk satu server daripada semuanya, cetak biru menangkap konfigurasinya, set mod, dan versi paket yang disematkan (dan, jika Anda mencentangnya, dunia aktif) sebagai satu file `.mcserver.zip` yang dapat diimpor di panel lain untuk membangun kembali server yang sama. Dunia dapat diunduh dan diinstal secara terpisah ketika hanya dunia yang perlu dipindahkan.

Jika port game yang digunakan server sudah terpakai di mesin baru, atau Anda ingin menguji pada port non-publik terlebih dahulu, ubah di **Pengaturan → Konfigurasi**: kartu **Port Game** memiliki **Gunakan Port Bebas Berikutnya**, server yang berjalan akan bertanya sebelum memulai ulang pada port baru, dan jika tidak dapat dimulai di sana, ia akan kembali ke port lama. Alihkan ke port publik saat Anda mengarahkan pemain ke sana.

Terkait: [cetak biru](/docs/blueprints/), [cadangan yang benar-benar dapat dipulihkan](/docs/guide-backups/),
[dunia dan file](/docs/worlds-and-files/).
