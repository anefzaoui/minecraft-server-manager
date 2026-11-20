---
title: 'Blueprints'
description: 'Blueprints menyimpan seluruh konfigurasi server Minecraft sebagai resep yang dapat digunakan kembali untuk membuat server baru. Rahasia tidak pernah disertakan.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Sebuah **blueprint** menangkap seluruh konfigurasi server (tipe, versi, sumber daya, lingkungan, pin pack, mod kustom, dan opsional konfigurasi serta dunianya) ke dalam satu file `.mcserver.zip` portabel yang dapat Anda gunakan untuk membuat server baru. Rahasia (kata sandi, token, dan kunci di lingkungan) tidak pernah ditulis ke dalam blueprint.

![Blueprints](/docs/images/blueprints.png)

## Mengekspor

Dari tab **Pengaturan → Konfigurasi** server, gunakan **Ekspor sebagai Blueprint** dan pilih apa yang akan disertakan: konfigurasi server selalu, direktori konfigurasinya (aktif secara default), dan opsional file mod kustom itu sendiri (file yang lebih besar yang terinstal tanpa mengunduh apa pun) dan dunia yang aktif. Hasilnya disimpan ke pustaka blueprint Anda dan dapat diunduh untuk dibagikan.

**Kloning Server**, pada kartu yang sama, melakukan ekspor dan impor dalam satu langkah untuk membuat salinan server, dengan atau tanpa dunianya.

## Mengimpor & membuat dari blueprint

Impor file blueprint (**Impor Blueprint** di halaman **Blueprint**) atau pilih salah satu dari pustaka (**Buat Server** pada kartunya, atau tab **Dari Blueprint** pada wizard) untuk membuat server baru yang telah dikonfigurasi persis seperti aslinya. Server baru mendapatkan portnya sendiri dan kata sandi RCON yang baru. Mod kustom yang tidak disematkan akan diunduh lagi dan diperiksa terhadap hash yang dicatat oleh blueprint. Pustaka juga dimulai dengan dua blueprint awal, satu Paper dan satu Fabric.

Ini adalah cara tercepat untuk:

- Menyiapkan server yang identik (jaringan server minigame, salinan staging produksi).
- Memindahkan server antar panel.
- Menyimpan template yang diketahui baik yang selalu dapat Anda gunakan kembali.

Karena blueprint mencatat [pin pack](/docs/modpacks/) yang tepat, server modpack yang dibuat dari blueprint akan menginstal versi yang disematkan yang sama, tanpa pembaruan yang mengejutkan.
