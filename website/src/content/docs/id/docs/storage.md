---
title: 'Penyimpanan'
description: 'Halaman Penyimpanan menunjukkan ke mana ruang disk Anda digunakan: penggunaan per server dan bagaimana trennya dari waktu ke waktu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

Halaman **Penyimpanan** menunjukkan ke mana disk Anda digunakan: penggunaan per server dan bagaimana trennya dari waktu ke waktu.

![Penyimpanan](/docs/images/storage.png)

## Kuota disk diberlakukan oleh panel

Docker tidak dapat membatasi penggunaan disk dari bind mount, jadi panel yang melakukannya. Sebuah pengindeks ukuran latar belakang memindai direktori data, menyimpan cache jejak setiap server, dan memberlakukan kuota disk yang Anda tetapkan per server. Ketika data server (dunia + cadangan + lainnya) mendekati kuotanya, panel menghentikan pertumbuhan yang tidak terkendali daripada membiarkan satu server memenuhi host Anda.

Atur kuota server di [pengaturannya](/docs/servers/). Server modifikasi dan [cadangannya](/docs/backups/) bisa berukuran besar, jadi berikan ruang yang cukup.

## Pembersihan

Tampilan Penyimpanan membantu Anda menemukan apa yang perlu dipangkas (cadangan lama, dunia yang tidak terpakai, atau server yang telah tumbuh jauh melebihi harapan) sebelum Anda kehabisan ruang.
