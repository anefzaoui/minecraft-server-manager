---
title: 'Blueprints'
description: 'Blueprint menangkap seluruh konfigurasi server (tipe, versi, sumber daya, lingkungan, pin paket, dan opsional konfigurasi serta dunianya) menjadi satu file po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Sebuah **blueprint** menangkap seluruh konfigurasi server (tipe, versi, sumber daya, lingkungan, pin pack, dan opsional konfigurasi serta dunianya) ke dalam satu file portabel yang dapat Anda gunakan untuk membuat server baru.

![Blueprints](/docs/images/blueprints.png)

## Mengekspor

Dari sebuah server, ekspor blueprint dan pilih apa yang ingin disertakan: konfigurasi selalu, dan opsional file yang disematkan serta dunianya. Hasilnya disimpan ke pustaka blueprint Anda dan dapat diunduh untuk dibagikan.

## Mengimpor & membuat dari blueprint

Impor file blueprint (atau pilih salah satu dari pustaka) untuk membuat server baru yang dikonfigurasi persis seperti aslinya. Ini adalah cara tercepat untuk:

- Menyiapkan server yang identik (jaringan server minigame, salinan staging dari produksi).
- Memindahkan server antar panel.
- Menyimpan template yang sudah diketahui baik yang selalu dapat Anda gunakan sebagai cadangan.

Karena blueprint mencatat [pin pack](/docs/modpacks/) yang tepat, server modpack yang dibuat ulang dari blueprint akan menginstal versi yang disematkan sama, tanpa pembaruan yang mengejutkan.
