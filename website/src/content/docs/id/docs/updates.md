---
title: 'Pembaruan'
description: 'Halaman Pembaruan melacak apa saja yang sudah usang di seluruh armada Anda di satu tempat:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Kembali ke indeks docs](/docs/)

Halaman **Pembaruan** melacak apa yang sudah usang di seluruh armada Anda dalam satu tempat:

- Versi **Modpack** ([modpacks](/docs/modpacks/)) terhadap Modrinth / CurseForge / indeks rilis GTNH.
- **Konten kustom** yang Anda tambahkan sendiri - mod, datapack, resource pack, plugin - masing-masing terhadap sumbernya: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), atau GitHub Releases. Pencarian GitHub menggunakan validasi ulang ETag, jadi pemeriksaan harian hampir tidak menyentuh batas tarifnya.
- Ketertinggalan **image Docker**: ID image setiap kontainer yang berjalan terhadap tag yang baru saja ditarik (dideduplikasi di seluruh server dengan tag yang sama), ditawarkan sebagai peningkatan yang hanya dapat dibuat ulang.
- **Pin versi mandiri**: untuk server tanpa pack yang dikelola, pin `mc_version` eksplisit terhadap manifes Mojang, dan variabel lingkungan env var loader-build eksplisit (`PAPER_BUILD`, `FORGE_VERSION`, dan sejenisnya) terhadap registri loader. Build Paper berasal dari **API Fill v3** PaperMC saat ini (endpoint v2 lama berhenti menerima versi Minecraft baru).

![Pembaruan](/docs/images/updates.png)

## Cara kerja

Panel memeriksa versi yang disematkan setiap server terhadap sumber hulu dan mencantumkan apa pun yang memiliki rilis lebih baru. Jumlah yang cocok juga muncul di ubin "Pembaruan tersedia" di [dashboard](/docs/dashboard/).

Pemeriksaan berjalan sesuai permintaan dan dapat dijadwalkan ([Jadwal](/docs/schedules/)). **Kebijakan** pembaruan adalah per server: Anda memutuskan apakah panel hanya memberi tahu Anda, atau membiarkan semuanya manual.

## Menerapkan pembaruan

Pembaruan tidak pernah diam. Saat Anda memilih untuk meningkatkan pack, panel:

1. Mengambil **cadangan pra-pembaruan** (sehingga dapat dibalik; 10 cadangan pra-pembaruan terakhir per server disimpan).
2. Menyematkan kembali versi baru yang tepat.
3. Membuat ulang kontainer, menyelesaikan ulang runtime Java jika diperlukan.
4. Memantau boot pertama, dengan anggaran waktu per platform.

Jika tidak berhasil, Anda akan kembali ke cadangan pra-pembaruan. Server yang melacak versi stabil tidak pernah ditawari beta, dan tautan changelog mengarah ke diff per-versi sebenarnya di mana sumber menyediakannya. Pembaruan yang gagal juga memicu [peringatan](/docs/integrations/) Discord jika integrasi dikonfigurasi.
