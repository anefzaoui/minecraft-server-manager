---
title: 'Chatbot per server Minecraft'
description: 'Panel ini menawarkan chatbot yang dikonfigurasi admin untuk setiap server Minecraft yang dikelola, diatur pada tab Pengaturan → Chatbot server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Panel ini menawarkan chatbot yang dikonfigurasi admin untuk setiap server Minecraft yang dikelola, diatur pada tab **Pengaturan → Chatbot** server. Ini terhubung ke
endpoint pelengkapan-obrolan yang kompatibel dengan OpenAI, termasuk Ollama di host LAN lain. Setiap server memiliki
endpoint, model, nama pemanggilan, persona, kebijakan transkrip, pesan jangkauan, dan kebijakan daya sendiri. Pemanggilan default adalah `@wizard`, dan persona default mendemonstrasikan seorang penyihir kuno yang menyenangkan di dalam game; keduanya dapat diedit.

![Pengaturan Chatbot](/docs/images/integrations-chatbot.png)

## Pengalaman Pemain

- Pemain mana pun dapat menggunakan `@wizard <pesan>` (atau pemanggilan yang dikonfigurasi) untuk percakapan dan
  bantuan resep vanilla yang deterministik dan sadar versi Minecraft.
- Salam bergabung dan pemeriksaan satu kali yang dapat dikonfigurasi mengingatkan pemain bahwa chatbot tersedia. `@wizard chat` membuka jendela percakapan opt-in singkat; `@wizard bye` menutupnya.
- **Pengguna Dasar** dapat memanggil kekuatan diri/dunia yang diaktifkan. **Pengontrol Kekuatan** dapat memanggil tindakan yang divalidasi secara terpisah yang memengaruhi pemain online lainnya. Pemain di kedua grup tidak tetap
  hanya percakapan.
- Hadiah diri pengguna dasar menggunakan daftar item yang diizinkan. Pengontrol dapat memberikan pemain lain item vanilla atau modded yang valid dengan nama ruang, tunduk pada batas kuantitas dan perlindungan kekuatan lainnya.

![Transkrip Chatbot](/docs/images/chatbot-transcripts.png)

## Desain dan Keamanan

Konfigurasi dan transkrip hanya untuk admin. Model tidak pernah menerima RCON mentah atau eksekusi perintah arbitrer. Pesan hanya mengekspos satu alat tetap yang cocok dengan niat eksplisitnya;
kode server memvalidasi otorisasi, argumen, flag, kuantitas, cooldown, dan nama pemain online yang tepat sebelum mengeksekusi operasi layanan yang ada. Pemilih Minecraft ditolak,
tindakan lintas pemain tidak dapat menargetkan pemanggil, kekuatan dimulai dalam mode dry-run, dan setiap kekuatan yang dicoba diaudit. Model pemanggilan alat yang tidak didukung kembali ke percakapan saja.

Balasan dibatasi untuk obrolan Minecraft. Resep vanilla yang diketahui berasal dari data resep versi yang dibundel dan dirender sebagai baris 2x2/3x3 yang stabil; LLM tidak dipercaya untuk membuat tata letak resep. Resep yang tidak diketahui atau modded mengarahkan pemain ke JEI/REI daripada mengarang jawaban.

## File Implementasi Utama

- `src/services/wizard.js`: konfigurasi per-server, permintaan yang kompatibel dengan OpenAI, penanganan obrolan,
  jangkauan, retensi transkrip, dan batas respons.
- `src/services/wizardPowers.js`: pemeriksaan peran, skema alat khusus niat, validasi, eksekusi,
  cooldown, dan audit kekuatan.
- `src/services/wizardRecipes.js`: pencarian resep versi deterministik dan pemformatan grid. Data resep
  dan item berasal dari paket [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) yang dibundel. (Draf sebelumnya dari dokumen ini menunjuk ke folder `src/data/recipes/` yang tidak pernah di-commit; tidak ada folder seperti itu, dan data berada di paket. Lihat "Jejak Ketergantungan".)
- `src/analytics/ingest.js`: meneruskan gabungan, kepergian, dan obrolan pemain yang diurai ke chatbot.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js`, dan
  `views/partials/server/integrations.hbs` (melalui `chatbot.hbs`): API admin dan tab Pengaturan → Chatbot per-server.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`,
  `017_wizard_outreach.js`, dan `019_wizard_power_controllers.js`: skema persisten.
- `test/wizard.test.js`: pengujian otorisasi, batas alat, retensi, jangkauan, dan perilaku obrolan.

Nama rute/modul/tabel internal `wizard` dipertahankan untuk kompatibilitas peningkatan dan API; "chatbot" adalah istilah produk yang menghadap pengguna. Demikian pula, bidang `power_testers_json` yang disimpan memetakan ke grup **Pengguna Dasar** UI.

## Jejak Ketergantungan (`minecraft-data`)

Bantuan resep menggunakan paket `minecraft-data`. Ukurannya besar di disk (sekitar 429 MB terinstal), dan dikirimkan di dalam gambar produksi karena merupakan dependensi runtime, bukan dev. Kami menyimpannya dengan sengaja agar bantuan resep berfungsi offline untuk setiap rilis Minecraft tanpa panggilan jaringan.

Catatan untuk siapa pun yang melihat ini selanjutnya (manusia atau AI), sehingga ukurannya tidak mengejutkan:

- Saat ini hanya data Java (`pc`) yang digunakan. `wizardRecipes.js` membaca `minecraftData.versions.pc`
  dan tabel `recipes`, `items`, dan `blocks` per-versi. File yang sebenarnya disentuhnya berjumlah sekitar 15 MB di semua versi pc.
- Sekitar 330 MB paket adalah `data/bedrock`, dan tidak ada di sini yang membacanya saat ini. Kami sengaja membiarkannya di tempatnya. Jika panel menambahkan dukungan Bedrock Minecraft di masa mendatang, data resep dan item Bedrock sudah ada di sini, sehingga fitur resep dapat berkembang untuk mencakup server Bedrock tanpa menambahkan dependensi baru. Mulai dari `minecraftData.versions.bedrock` dan ikuti bentuk yang sama dengan jalur pc.
- Jika ukurannya harus dikurangi sebelum dukungan Bedrock tiba, sudah ada polanya di repositori ini. `src/services/itemRegistry.js` mengambil file `minecraft-data` dari CDN jsDelivr saat dibutuhkan dan menyimpannya di `api_cache`. Baik pendekatan itu, atau subset kecil `src/data/recipes/` yang dipilih sendiri yang mencakup beberapa versi umum, akan sangat mengecilkan gambar.

## Penyimpanan Lokal dan Inspeksi Manual

Semua pengaturan dan transkrip yang disimpan berada di database SQLite panel di `/data/panel.db` di dalam kontainer panel. Dengan mount Compose standar, jalur host adalah
`${DATA_DIR_HOST}/panel.db` (misalnya `/opt/msm/data/panel.db`). Tabel yang relevan adalah
`wizard_configs`, `wizard_transcripts`, dan `wizard_outreach`; audit kekuatan adalah baris di tabel `events`
dengan tipe `wizard-power`. Kunci API LLM opsional dienkripsi AES-256-GCM dengan kunci at-rest panel, `.secret-key` di folder data (terpisah dari `SESSION_SECRET`).

Cadangkan database dan hentikan panel sebelum pengeditan SQLite langsung agar WAL-nya ditangani dengan aman.
Menggunakan UI/API admin lebih disukai karena menerapkan validasi dan enkripsi. Simpan file
`panel.db`, `panel.db-wal`, dan `panel.db-shm` bersama-sama saat menyalin database langsung.
