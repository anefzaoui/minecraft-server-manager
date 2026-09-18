---
title: 'Entegrasyonlar'
description: 'Her sunucu, Ayarlar grubu altında entegrasyonlarını taşır: Discord, herkese açık bir Durum Sayfası, tek tıkla Davetler ve isteğe bağlı Sohbet Botu sekmesi.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Geri belgeler dizinine](/docs/)

Her sunucu, **Ayarlar** grubu altında entegrasyonlarını barındırır: **Discord**, herkese açık bir **Durum Sayfası**, tek tıklamayla **Davetler** ve isteğe bağlı **Sohbet Botu** sekmesi. Bu sayfa Discord'u kapsar (diğerlerinin kendi belgeleri ve paneldeki kurulum yardımcıları vardır).

## Discord bildirimleri

Panel, bir webhook aracılığıyla sunucu olaylarını bir Discord kanalına iletir. Bot yok, OAuth yok.

### Kurulum

1. Discord'da: **Sunucu Ayarları → Entegrasyonlar → Webhook'lar → Yeni Webhook**. Kanalı seçin ve webhook URL'sini kopyalayın.
2. Panelde, sunucunun **Ayarlar → Discord** sekmesini açın, URL'yi **Webhook URL**'ye yapıştırın, kartı **açın** ve **Kaydedin**. URL şifrelenmiş olarak saklanır (API anahtarlarınızla aynı depolama alanında).
3. Çalıştığını doğrulamak için **Test Gönder**'i kullanın.

![Discord entegrasyonu](/docs/images/integrations-discord.png)

Saklanan bir URL'yi değiştirmek için yeni bir URL yapıştırıp kaydedin; mevcut URL'yi korumak için alanı boş bırakın. Saklanan URL maskelenmiş olarak gösterilir (token gizlenir).

### Neler gönderilir

Bildirimler, kapatılabilir kategorilere ayrılmıştır. Hepsi varsayılan olarak açıktır.

| Kategori                | Olaylar                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **Başlatma / Durdurma** | Sunucu başlatıldı, sunucu durduruldu                                    |
| **Çökmeler**            | Çökme, çökme döngüsü algılandı, yeni çökme raporu                       |
| **Yedeklemeler**        | Yedekleme oluşturuldu, yedekleme geri yüklendi                          |
| **Güncellemeler**       | Güncelleme uygulandı, güncelleme geri alındı, güncelleme başarısız oldu |
| **Atmalar / Yasaklar**  | Oyuncu atıldı, oyuncu yasaklandı                                        |
| **Uyarılar**            | Sunucuyu sessizce bozuk bırakan şeyler (aşağıya bakınız)                |

### Uyarılar kategorisi

`Uyarılar`, "bir şeyin insan müdahalesi gerektirdiği" kanalıdır; eskiden yalnızca panelde görünen koşullar için kullanılır:

| Olay                    | Anlam                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Bellek yetersizliği nedeniyle kapsayıcı durduruldu.                                                                                      |
| `unhealthy`             | İşlem çalışıyor ancak `mc-health` denetimi başarısız oluyor: canlı ama ölü bir sunucu.                                                   |
| `startup-stalled`       | Günlüklerde "Tamamlandı" olmadan yaklaşık 10 dakika boyunca hala başlatılıyor (düzeltilmesi gereken bir sorun teşhisi ile, biliniyorsa). |
| `stop-failed`           | Nazik bir durdurma işlemi etkili olmadı ve kapsayıcı hala çalışıyor.                                                                     |
| `schedule-failed`       | Zamanlanmış bir yeniden başlatma / yedekleme / komut başarısız oldu.                                                                     |
| `quota-exceeded`        | Katı mod disk kotası aşıldı ve sunucu durduruldu.                                                                                        |
| `offline-after-restart` | Panel yeniden başlatılmadan önce sunucu çalışıyordu, şimdi çalışmıyor ve otomatik olarak başlatılmayacak.                                |
| `crash-report`          | Yeni bir çökme raporu yakalandı ve ayrıştırıldı.                                                                                         |
| `update-failed`         | Korumalı bir yükseltme sağlıklı gelmedi.                                                                                                 |

### Teslimat nasıl çalışır

Arka planda çalışan bir köprü, [olay günlüğünü](/docs/activity/) her 15 saniyede bir yoklar ve eşlenen satırları iletir. Bir webhook POST işlemi geçici olarak başarısız olursa, o satır düşmek yerine sonraki yoklamalarda tekrar denenir; kalıcı olarak ulaşılamayan bir webhook, birkaç denemeden sonra sessize alınır (saatte bir günlük satırı). Köprü, panel başlamadan önceki olayları asla yeniden oynatmaz.
