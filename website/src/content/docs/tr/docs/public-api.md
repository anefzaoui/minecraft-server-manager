---
title: 'Genel API'
description: "Panel dışından sunucu durumunu almak için küçük, salt okunur bir HTTP API'si: durum panosu, çalışma süresi izleyicisi, Discord botu, ev otomasyonu kuralı."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Geri belgeler dizinine](/docs/)

Panel dışından sunucu durumunu almak için küçük, salt okunur bir HTTP API:
bir durum panosu, bir çalışma süresi izleyicisi, bir Discord botu, bir ev otomasyonu kuralı. Panel
tarafından sunulur ve panelin kendi sayfalarının gösterdiği aynı canlı verileri (bellek içi önbellekten) döndürür,
bu nedenle onu sorgulamak Docker'a asla dokunmaz.

**Bir yönetici kullanana kadar kapalıdır** ve **yönetici tarafından denetlenir**. Bir jeton
olmadan hiçbir şey gösterilmez.

## Etkinleştirme

**Ayarlar → Genel API → Yeni Anahtar**. Bir ad verin, neyi görebileceğini seçin (tüm sunucular veya belirli bir alt küme)
ve isteğe bağlı olarak bir son kullanma tarihi belirleyin. Tam anahtar (bir Bearer jetonu),
bir iletişim kutusunda **yalnızca bir kez** gösterilir; şimdi kopyalayın, çünkü sonrasında yalnızca kısa bir ön ek
listede tanımlama için saklanır.

![Genel API ayarları](/docs/images/settings-public-api.png)

İlk anahtarın oluşturulması API'yi otomatik olarak açar (**Dış uygulamaların durumu okumasına izin ver** anahtarı bir duraklatma kontrolüdür:
anahtarları iptal etmeden sunmayı durdurmak için kapatın). Herhangi bir zamanda aynı tablodan bir anahtarı iptal edin;
onu kullanan istemciler hemen erişimi kaybeder.

Jetonlar bir SHA-256 karma değeri olarak saklanır (asla düz metin olarak değil), panel yeniden başlatılmasından kurtulur
ve kapsamına alındıkları sunucuları geride bırakır (silinen bir sunucu yalnızca o jetonun sonuçlarından düşer).

## Kimlik Doğrulama

Jetonu bir Bearer kimlik bilgisi olarak gönderin:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Çerez yok ve **CORS yok**: bu, tarayıcı uygulamaları için değil, sunucudan sunucuya ve CLI çağrıları içindir.
Panel bir ters proxy'nin arkasındaysa, proxy'nin `Authorization` başlığını ilettiğinden emin olun.

Hatalar `{ "ok": false, "error": "..." }` ile `401` döndürür. `GET` (veya `HEAD`) dışında
herhangi bir şey `405` döndürür. Bilinmeyen yollar `404` döndürür. API devre dışı bırakıldığında, her rota
`404` döndürür.

## Hız Sınırı

Her jetonun kendi bütçesi vardır, `RATE_LIMIT_PUBLIC_API_PER_MIN` (varsayılan `120` istek/dakika; `0` sınırlayıcıyı devre dışı bırakır).
Sınırın üzerinde `429` döndürür. Her istek, jetonu kontrol edilmeden önce bile,
her istemci IP'si için bu sayının beş katı olan bir sınıra doğru sayılır, bu nedenle eksik,
hatalı, iptal edilmiş veya süresi dolmuş jetonlarla deneme, bunları döndürerek bütçeyi atlayamaz.

## Uç Noktalar

### `GET /api/v1/servers`

Jetonun kapsamına giren her sunucu.

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
**ve** jetonun kapsamına girmeyen bir sunucu için `404` (varlık oracle'ı yok) ve hatalı bir kimlik için `400` döndürür.

## Yanıt Alanları

| Alan            | Anlam                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| `total`         | Bu jetonun görebildiği sunucu sayısı (kapsam filtresinden sonra).                            |
| `online`        | Bunlardan kaç tanesi `running` durumunda.                                                    |
| `id`            | Sabit sunucu kimliği (`srv_...`).                                                            |
| `name`          | Görünen ad.                                                                                  |
| `type`          | itzg sunucu türü (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                |
| `state`         | `running`, `starting`, `stopped` veya `crashed`: panelin dahili durumunun kararlı bir özeti. |
| `cpuPct`        | Son CPU yüzdesi veya sunucu çalışmıyorsa `null`.                                             |
| `memoryMb`      | MB cinsinden yerleşik bellek veya `null`.                                                    |
| `memoryLimitMb` | MB cinsinden yapılandırılmış kapsayıcı bellek sınırı veya `null`.                            |
| `uptimeSeconds` | Kapsayıcı başlatıldığından beri geçen saniye veya `null`.                                    |
| `players`       | `{ online, max }` veya sunucu bir oyuncu listesi bildirene kadar `null`.                     |

## Örnek

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
