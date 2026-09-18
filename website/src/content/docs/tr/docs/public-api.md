---
title: 'Genel API'
description: 'Panel dışından sunucu durumunu almak için küçük, salt okunur bir HTTP API: a'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Geri belgeler dizinine](/docs/)

Panel dışından sunucu durumunu almak için küçük, salt okunur bir HTTP API: bir
durum panosu, bir çalışma süresi izleyicisi, bir Discord botu, bir ev otomasyonu kuralı. Bu,
panelin kendisi tarafından sunulur ve panelin kendi sayfalarının gösterdiği canlı verileri döndürür
(bellek içi önbellekten), bu nedenle onu sorgulamak Docker'a asla dokunmaz.

**Bir yönetici kullanana kadar kapalıdır** ve **yönetici tarafından korunur**. Bir belirteç
olmadan hiçbir şey gösterilmez.

## Etkinleştirme

**Ayarlar → Genel API → Yeni Anahtar**. Bir ad verin, neyi görebileceğini seçin (tüm
sunucular veya belirli bir alt küme) ve isteğe bağlı olarak bir son kullanma tarihi belirleyin. Tam anahtar (bir Bearer belirteci)
**yalnızca bir kez**, bir iletişim kutusunda gösterilir; şimdi kopyalayın, çünkü sonrasında yalnızca kısa bir ön ek
tutulur, listede tanımlama için.

![Genel API ayarları](/docs/images/settings-public-api.png)

İlk anahtarın oluşturulması API'yi otomatik olarak açar (**Dış uygulamaların
durumu okumasına izin ver** anahtarı bir duraklatma kontrolüdür: herhangi bir anahtarı iptal etmeden
sunmayı durdurmak için kapatın). Herhangi bir zamanda aynı tablodan bir anahtarı iptal edin; onu kullanan istemciler
derhal erişimi kaybeder.

Belirteçler SHA-256 karma değeri olarak saklanır (asla düz metin olarak değil), panel
yeniden başlatıldığında kalır ve kapsamına alındığı sunucuları aşar (silinen bir sunucu yalnızca
o belirtecin sonuçlarından düşer).

## Kimlik Doğrulama

Belirteci bir Bearer kimlik bilgisi olarak gönderin:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Çerez yok ve **CORS yok**: bu, sunucudan sunucuya ve CLI
çağrıları içindir, başka bir kaynaktaki tarayıcı uygulamaları için değil. Panel bir ters proxy'nin arkasındaysa,
proxy'nin `Authorization` başlığını ilettiğinden emin olun.

Hatalar `{ "ok": false, "error": "..." }` ile `401` döndürür. `GET`
(veya `HEAD`) dışındaki her şey `405` döndürür. Bilinmeyen yollar `404` döndürür. API devre dışı bırakıldığında, her rota
`404` döndürür.

## İstek Sınırı

Her belirtecin kendi bütçesi vardır, `RATE_LIMIT_PUBLIC_API_PER_MIN` (varsayılan `120`
istek/dakika; `0` sınırlayıcıyı devre dışı bırakır). Sınırı aşmak `429` döndürür. Geçerli bir belirteç
hiçbir zaman sunmayan istekler (eksik, bozuk, iptal edilmiş veya süresi dolmuş) ayrı olarak
her istemci IP'si için bu sayının beş katı ile sınırlandırılır, böylece tarama, belirteçleri döndürerek bütçeyi atlayamaz.

## Uç Noktalar

### `GET /api/v1/servers`

Belirtecin kapsamına alınan her sunucu.

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

Tek bir sunucu, `server` anahtarı altında aynı nesne. Bilinmeyen bir kimlik
**ve** belirtecin kapsamına alınmadığı bir sunucu için `404` döndürür (varlık oracle'ı yok) ve bozuk bir kimlik için `400` döndürür.

## Yanıt Alanları

| Alan            | Anlam                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| `total`         | Bu belirtecin görebildiği sunucu sayısı (kapsam filtresinden sonra).                          |
| `online`        | Bunlardan kaç tanesi `running` durumunda.                                                     |
| `id`            | Sabit sunucu kimliği (`srv_...`).                                                             |
| `name`          | Görünen ad.                                                                                   |
| `type`          | itzg sunucu türü (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                 |
| `state`         | `running`, `starting`, `stopped` veya `crashed` - panelin dahili durumunun kararlı bir özeti. |
| `cpuPct`        | Son CPU %, veya sunucu çalışmıyorsa `null`.                                                   |
| `memoryMb`      | MB cinsinden yerleşik bellek veya `null`.                                                     |
| `memoryLimitMb` | Yapılandırılmış kapsayıcı bellek sınırı MB cinsinden veya `null`.                             |
| `uptimeSeconds` | Kapsayıcı başlatıldığından beri geçen saniye veya `null`.                                     |
| `players`       | `{ online, max }` veya sunucu bir oyuncu listesi bildirene kadar `null`.                      |

## Örnek

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
