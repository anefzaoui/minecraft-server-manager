---
title: 'API Publik'
description: 'API HTTP kecil yang hanya bisa dibaca untuk mengambil status server dari luar panel: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Kembali ke indeks dokumentasi](/docs/)

API HTTP kecil yang hanya bisa dibaca untuk mengambil status server dari luar panel: dasbor status, pemantau waktu aktif, bot Discord, aturan otomatisasi rumah. API ini disajikan oleh panel itu sendiri dan mengembalikan data langsung yang sama dengan yang ditampilkan halaman panel (dari cache dalam memori), sehingga memantaunya tidak pernah menyentuh Docker.

API ini **mati sampai diaktifkan oleh admin** dan **dibatasi untuk admin**. Tidak ada yang terekspos sampai token ada.

## Mengaktifkannya

**Pengaturan → API Publik → Kunci Baru**. Beri nama, pilih apa yang bisa dilihatnya (semua server, atau subset tertentu), dan opsional tanggal kedaluwarsa. Kunci lengkap (token Bearer) ditampilkan **sekali**, dalam dialog; salin sekarang, karena hanya awalan pendek yang disimpan setelahnya, untuk identifikasi dalam daftar.

![Pengaturan API Publik](/docs/images/settings-public-api.png)

Membuat kunci pertama akan mengaktifkan API secara otomatis (sakelar **Biarkan aplikasi luar membaca status** adalah kontrol jeda: matikan untuk berhenti menyajikan tanpa membatalkan kunci apa pun). Batalkan kunci dari tabel yang sama kapan saja; klien yang menggunakannya akan kehilangan akses segera.

Token disimpan sebagai hash SHA-256 (tidak pernah dalam teks biasa), bertahan dari restart panel, dan melampaui server yang dibatasinya (server yang dihapus hanya akan hilang dari hasil token tersebut).

## Otentikasi

Kirim token sebagai kredensial Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Tidak ada cookie dan **tidak ada CORS**: ini untuk pemanggil server-ke-server dan CLI, bukan aplikasi peramban dari asal lain. Jika panel berada di belakang proxy terbalik, pastikan proxy meneruskan header `Authorization`.

Kegagalan mengembalikan `401` dengan `{ "ok": false, "error": "..." }`. Apa pun selain `GET` (atau `HEAD`) mengembalikan `405`. Jalur yang tidak diketahui mengembalikan `404`. Ketika API dinonaktifkan, setiap rute mengembalikan `404`.

## Batas tarif

Setiap token mendapatkan anggarannya sendiri, `RATE_LIMIT_PUBLIC_API_PER_MIN` (default `120` permintaan/menit; `0` menonaktifkan pembatas). Melebihi batas mengembalikan `429`. Permintaan yang tidak pernah menyajikan token yang valid (hilang, salah format, dicabut, atau kedaluwarsa) dibatasi secara terpisah per IP klien sebanyak lima kali jumlah tersebut, sehingga penjelajahan tidak dapat melewati anggaran dengan memutar token.

## Titik akhir

### `GET /api/v1/servers`

Setiap server yang dibatasi oleh token.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Satu server, objek yang sama di bawah kunci `server`. Mengembalikan `404` untuk id yang tidak diketahui **dan** untuk server yang tidak dibatasi oleh token (tidak ada oracle keberadaan), dan `400` untuk id yang salah format.

## Bidang respons

| Bidang          | Arti                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `total`         | Berapa banyak server yang terlihat oleh token ini (setelah filter cakupannya).                  |
| `online`        | Berapa banyak dari server tersebut dalam status: `running`.                                     |
| `id`            | Id server yang stabil (`srv_...`).                                                              |
| `name`          | Nama tampilan.                                                                                  |
| `type`          | Tipe server itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                   |
| `state`         | `running`, `starting`, `stopped`, atau `crashed` - ringkasan stabil dari status internal panel. |
| `cpuPct`        | Persentase CPU terbaru, atau `null` ketika server tidak berjalan.                               |
| `memoryMb`      | Memori residen dalam MB, atau `null`.                                                           |
| `memoryLimitMb` | Batas memori kontainer yang dikonfigurasi dalam MB, atau `null`.                                |
| `uptimeSeconds` | Detik sejak kontainer dimulai, atau `null`.                                                     |
| `players`       | `{ online, max }`, atau `null` sampai server melaporkan daftar pemain.                          |

## Contoh

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
