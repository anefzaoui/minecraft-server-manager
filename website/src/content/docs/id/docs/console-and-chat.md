---
title: 'Konsol & perintah obrolan'
description: 'Tab Konsol menyiarkan log server secara real-time dan memberi Anda kotak perintah untuk mengirim perintah server apa pun.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Kembali ke indeks docs](/docs/)

## Konsol langsung

Tab **Konsol** menyiarkan log server secara real-time dan memberi Anda kotak perintah untuk mengirim perintah server apa pun. Tanpa `docker exec`, tanpa SSH. Output kembali secara inline, dengan warna dan semuanya. Mengirim perintah memerlukan izin Konsol pada server tersebut; tanpanya Anda masih dapat menonton log.

Di atas log, Anda dapat memfilter baris berdasarkan teks (atau `/regex/`) dan berdasarkan level (INFO, WARN, ERROR), dan **Unduh** menawarkan output terbaru, `latest.log` lengkap, atau setiap file log sebagai zip.

![Konsol](/docs/images/server-console.png)

Konsol juga merupakan tempat panel membaca status server: ia memantau log untuk mengklasifikasikan fase boot ("Memuat mod", "Menghasilkan dunia", "Menyelesaikan startup") dan memanggil `list` untuk melacak siapa yang sedang online, sehingga dasbor dan kartu server selalu mencerminkan kenyataan.

Polling tersebut membuka koneksi RCON berumur pendek setiap siklus, yang dicatat oleh server sebagai pasangan `Thread RCON Client … started` / `shutting down` setiap ~20 detik, dan (pada server yang intinya atau pluginnya menggemakannya) baris `Rcon issued server command: …` untuk setiap polling baca-saja (`list` untuk jumlah pemain, ditambah pembacaan `time query …` dan `gamerule <name>` saat Kontrol Dunia terbuka). Tombol **Sembunyikan Kebisingan Konsol** di atas log memfilter baris-baris tersebut (bersama dengan baris startup pendengar RCON). Ini aktif secara default dan diingat per peramban; matikan untuk melihat aliran mentah.

Perintah yang dikirim dari panel dapat diumumkan dalam game di bawah label per server (kotak **Umumkan sebagai…**), sehingga pemain tahu operator bertindak daripada konsol misterius.

## Obrolan

**Konsol → Obrolan** mengirim pesan ke dalam game saat server berjalan: pesan **Bergaya** mengambil warna dan pemformatan dan dapat dikirim ke semua orang atau satu pemain online, dan **Biasa** mengirim siaran `[Server]` sederhana ke semua orang.

![Konsol → Obrolan](/docs/screenshots/04-chat.png)

## Perintah obrolan

Perintah obrolan (**Konsol → Perintah**) memungkinkan pemain memicu tindakan panel dengan mengetik perintah awalan dalam obrolan game, misalnya `!spawn` untuk teleportasi acak. Deteksi berbasis log dan eksekusi melalui server, jadi **tidak diperlukan mod**.

![Perintah obrolan](/docs/images/chat-commands.png)

Setiap perintah memiliki:

- **Pemicu** (misalnya, `spawn`), diketik setelah **awalan** server (`!` secara default, satu atau dua karakter, tidak pernah `/`).
- **Tindakan**: teleportasi acak, teleportasi ke struktur, teleportasi ke bioma, atau jalankan perintah konsol mentah.
- **Tingkat izin**: semua orang, pemain yang masuk daftar putih, atau hanya operator.
- **Jeda** per pemain (30 detik secara default), dan pesan penundaan / keberhasilan / kegagalan yang dapat disesuaikan dengan placeholder seperti `{distance}`.

### Catatan tentang keamanan

Perintah yang dapat merusak server (`stop`, `op`, `ban`, `whitelist`, dan teman-teman) hanya diizinkan pada pemicu **hanya operator**. Panel memeriksa ini bahkan ketika mereka bersarang di dalam rantai `execute … run …`, sehingga pemicu izin rendah tidak dapat menyelundupkan perintah berbahaya. Teks obrolan biasa yang hanya menyebutkan kata-kata tersebut (seperti pesan `say`) dibiarkan begitu saja.
