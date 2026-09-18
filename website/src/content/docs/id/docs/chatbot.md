---
title: 'Obrolan bot per server Minecraft'
description: 'Cabang ini menambahkan obrolan bot yang dikonfigurasi admin ke setiap server Minecraft yang dikelola.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Kembali ke indeks docs](/docs/)

Fork ini menambahkan chatbot yang dikonfigurasi admin ke setiap server Minecraft yang dikelola. Ia terhubung ke
endpoint obrolan-komplet yang kompatibel dengan OpenAI, termasuk Ollama di host LAN lain. Setiap server memiliki
endpoint, model, nama pemanggilan, persona, kebijakan transkrip, pesan jangkauan, dan kebijakan kekuatan sendiri.
Pemanggilan default adalah `@wizard`, dan persona default mendemonstrasikan penyihir kuno yang
ceria di dalam game; keduanya dapat diedit.

![Pengaturan Chatbot](/docs/images/integrations-chatbot.png)

## Pengalaman Pemain

- Pemain mana pun dapat menggunakan `@wizard <pesan>` (atau pemanggilan yang dikonfigurasi) untuk percakapan dan
  bantuan resep vanilla yang deterministik dan sadar versi Minecraft.
- Salam saat bergabung dan pengingat sekali pakai yang dapat dikonfigurasi mengingatkan pemain bahwa chatbot tersedia. `@wizard chat` membuka jendela percakapan opt-in singkat; `@wizard bye` menutupnya.
- **Pengguna dasar** dapat memanggil kekuatan diri/dunia yang diaktifkan. **Pengontrol kekuatan** dapat memanggil tindakan yang divalidasi secara terpisah yang memengaruhi pemain online lain. Pemain di kedua grup tetap
  hanya percakapan.
- Hadiah diri pengguna dasar menggunakan daftar item yang diizinkan. Pengontrol dapat memberikan pemain lain item vanilla atau modded apa pun yang valid dengan nama ruang, tunduk pada batas kuantitas dan perlindungan kekuatan lainnya.

![Transkrip Chatbot](/docs/images/chatbot-transcripts.png)

## Desain dan Keamanan

Konfigurasi dan transkrip hanya untuk admin. Model tidak pernah menerima RCON mentah atau eksekusi perintah arbitrer. Pesan hanya mengekspos satu alat tetap yang cocok dengan niat eksplisitnya;
kode server memvalidasi otorisasi, argumen, flag, kuantitas, cooldown, dan nama pemain online yang tepat sebelum mengeksekusi operasi layanan yang ada. Pemilih Minecraft ditolak,
aksi antar-pemain tidak dapat menargetkan pemanggil, kekuatan dimulai dalam mode dry-run, dan setiap kekuatan yang dicoba diaudit. Model pemanggilan alat yang tidak didukung kembali ke percakapan saja.

Balasan dibatasi untuk obrolan Minecraft. Resep vanilla yang diketahui berasal dari data resep versi yang dibundel dan dirender sebagai baris 2x2/3x3 yang stabil; LLM tidak dipercaya untuk membuat tata letak resep. Resep yang tidak diketahui atau modded mengarahkan pemain ke JEI/REI daripada mengarang jawaban.

## File Implementasi Utama

- `src/services/wizard.js`: konfigurasi per-server, permintaan yang kompatibel dengan OpenAI, penanganan obrolan,
  jangkauan, retensi transkrip, dan batas respons.
- `src/services/wizardPowers.js`: pemeriksaan peran, skema alat spesifik niat, validasi, eksekusi,
  cooldown, dan audit kekuatan.
- `src/services/wizardRecipes.js`: pencarian resep versi deterministik dan pemformatan grid. Resep
  dan data item berasal dari paket [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) yang dibundel. (Draf sebelumnya dari dokumen ini menunjuk ke folder `src/data/recipes/` yang tidak pernah di-commit; tidak ada folder seperti itu, dan data berada di paket. Lihat "Jejak Ketergantungan".)
- `src/analytics/ingest.js`: meneruskan gabungan, keluar, dan obrolan pemain yang diurai ke chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, dan
  `views/partials/server/integrations.hbs`: API admin dan UI Integrasi per-server.
- `src/db/migrations/011_wizard_chat.js` hingga `019_wizard_power_controllers.js`: skema persisten.
- `test/wizard.test.js`: pengujian otorisasi, batas alat, retensi, jangkauan, dan perilaku obrolan.

Nama rute/modul/tabel internal `wizard` dipertahankan untuk kompatibilitas peningkatan dan API;
"chatbot" adalah istilah produk yang menghadap pengguna. Demikian pula, bidang `power_testers_json` yang disimpan sesuai dengan grup **Pengguna dasar** di UI.

## Jejak Ketergantungan (`minecraft-data`)

Bantuan resep menggunakan paket `minecraft-data`. Ukurannya besar di disk (sekitar 429 MB terpasang), dan ia
dikirimkan di dalam gambar produksi karena merupakan dependensi runtime, bukan dev. Kami menyimpannya
dengan sengaja agar bantuan resep berfungsi offline untuk setiap rilis Minecraft tanpa panggilan jaringan.

Catatan untuk siapa pun yang melihat ini selanjutnya (manusia atau AI), agar ukurannya tidak mengejutkan:

- Saat ini hanya data Java (`pc`) yang digunakan. `wizardRecipes.js` membaca `minecraftData.versions.pc`
  dan tabel `recipes`, `items`, dan `blocks` per-versi. File yang sebenarnya disentuhnya berjumlah sekitar 15 MB di setiap versi pc.
- Sekitar 330 MB dari paket adalah `data/bedrock`, dan tidak ada di sini yang membacanya. Kami membiarkannya di
  tempat dengan sengaja. Jika panel menambahkan dukungan Minecraft Bedrock, data resep dan item Bedrock
  sudah ada di sini, sehingga fitur resep dapat berkembang untuk mencakup server Bedrock tanpa menambahkan dependensi baru. Mulai dari `minecraftData.versions.bedrock` dan ikuti bentuk yang sama dengan jalur pc.
- Jika ukurannya harus dikurangi sebelum dukungan Bedrock tiba, sudah ada polanya di repositori ini. `src/services/itemRegistry.js` mengambil file `minecraft-data` dari CDN jsDelivr
  saat dibutuhkan dan menyimpannya di `api_cache`. Pendekatan itu, atau subset kecil `src/data/recipes/` yang dipilih sendiri
  mencakup beberapa versi umum, akan sangat mengecilkan gambar.

## Penyimpanan Lokal dan Inspeksi Manual

Semua pengaturan dan transkrip yang disimpan berada di database SQLite panel di `/data/panel.db` di dalam kontainer panel. Dengan mount Compose standar, jalur host adalah
`${DATA_DIR_HOST}/panel.db` (misalnya `/opt/msm/data/panel.db`). Tabel yang relevan adalah
`wizard_configs`, `wizard_transcripts`, dan `wizard_outreach`; audit kekuatan adalah baris di tabel `events`
dengan tipe `wizard-power`. Kunci API LLM opsional dienkripsi AES-256-GCM menggunakan `SESSION_SECRET` panel, biasanya dipertahankan sebagai `${DATA_DIR_HOST}/.session-secret`.

Cadangkan database dan hentikan panel sebelum mengedit SQLite secara langsung agar WAL-nya ditangani dengan aman.
Menggunakan UI/API admin lebih disukai karena menerapkan validasi dan enkripsi. Simpan file
`panel.db`, `panel.db-wal`, dan `panel.db-shm` bersama-sama saat menyalin database langsung.
