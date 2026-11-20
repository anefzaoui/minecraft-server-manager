---
title: 'Entegrasyonlar'
description: 'Her sunucu, Ayarlar grubu altında entegrasyonlarını barındırır: Discord, herkese açık bir Durum Sayfası, tek tıklamayla Davetler ve isteğe bağlı Sohbet Botu sekmesi (yalnızca yöneticiler için).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Geri dön](/docs/)

Her sunucu, **Ayarlar** grubu altında kendi entegrasyonlarını taşır: **Discord**, genel bir **Durum Sayfası**, tek tıklamayla **Davetler** ve isteğe bağlı **Sohbet Botu** sekmesi (yalnızca yöneticiler için). Bu sayfa Discord'u kapsar; [davetler ve durum sayfası](/docs/invites-and-status-page/) bu ikisini kapsar ve [sohbet botunun](/docs/chatbot/) kendi sayfası vardır.

## Discord bildirimleri

Panel, bir webhook aracılığıyla sunucu olaylarını bir Discord kanalına iletir. Bot yok, OAuth yok.

### Kurulum

1. Discord'da: **Sunucu Ayarları → Entegrasyonlar → Webhook'lar → Yeni Webhook**. Kanalı seçin ve webhook URL'sini kopyalayın.
2. Panelde, sunucunun **Ayarlar → Discord** sekmesini açın, URL'yi **Webhook URL**'ye yapıştırın, kartı **açın** ve **Kaydedin**. URL şifrelenmiş olarak saklanır (API anahtarlarınızla aynı depolama alanında).
3. Çalıştığını doğrulamak için **Test Gönder**'i kullanın.

![Discord entegrasyonu](/docs/images/integrations-discord.png)

Saklanan bir URL'yi değiştirmek için yeni bir URL yapıştırıp kaydedin; mevcut URL'yi korumak için alanı boş bırakın. Saklanan URL maskelenmiş olarak gösterilir (token gizlenir).

### Neler gönderilir

Bildirimler, kapatılabilir kategorilere ayrılır. Hepsi varsayılan olarak açıktır.

| Kategori                | Olaylar                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **Başlatma / Durdurma** | Sunucu başlatıldı, sunucu durduruldu                                    |
| **Çökmeler**            | Çökme, çökme döngüsü algılandı, yeni çökme raporu                       |
| **Yedeklemeler**        | Yedekleme oluşturuldu, yedekleme geri yüklendi                          |
| **Güncellemeler**       | Güncelleme uygulandı, güncelleme geri alındı, güncelleme başarısız oldu |
| **Atmalar / Yasaklar**  | Oyuncu atıldı, oyuncu yasaklandı                                        |
| **Uyarılar**            | Sunucuyu sessizce bozuk bırakan şeyler (aşağıya bakınız)                |

### Uyarılar kategorisi

`Uyarılar`, "bir şeyin insan müdahalesi gerektirdiği" kanalıdır; eskiden yalnızca panelde görünen koşullar için:

| Olay                    | Anlam                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Bellek yetersizliği nedeniyle kapsayıcı durduruldu.                                                                         |
| `unhealthy`             | İşlem çalışıyor ancak `mc-health` denetimi başarısız oluyor: canlı ama ölü bir sunucu.                                      |
| `startup-stalled`       | Kayıtlarda "Tamamlandı" olmadan yaklaşık 10 dakika sonra hala başlatılıyor (ne düzeltileceğine dair teşhisle, biliniyorsa). |
| `stop-failed`           | Nazikçe durdurma işlemi etkili olmadı ve kapsayıcı hala çalışıyor.                                                          |
| `schedule-failed`       | Zamanlanmış bir yeniden başlatma / yedekleme / komut başarısız oldu.                                                        |
| `quota-exceeded`        | Katı mod disk kotası aşıldı ve sunucu durduruldu.                                                                           |
| `offline-after-restart` | Panel yeniden başlatılmadan önce sunucu çalışıyordu, şimdi çalışmıyor ve otomatik olarak başlatılmayacak.                   |
| `port-change-failed`    | Port değişikliği başarısız oldu ve sunucu eski portuna geri konulamadı, bu yüzden kapalı.                                   |
| `auto-restart-gave-up`  | Çöken bir sunucu yeniden başlatılmadı çünkü başka bir işlem onu çok uzun süre meşgul etti.                                  |

### Teslimat nasıl çalışır

Arka planda çalışan bir köprü, [etkinlik günlüğünü](/docs/activity/) her 15 saniyede bir yoklar ve eşlenen satırları iletir. Bir webhook POST işlemi geçici olarak başarısız olursa, o satır sonraki yoklamalarda yeniden denenir, düşmez; birkaç başarısız denemeden sonra satır atlanır ve teslimat hataları sunucu başına saatte en fazla bir kez kaydedilir. Panel yeniden başlatıldıktan sonra köprü, henüz teslim etmediği olayları gönderir, ancak asla iki saatten fazla geriye gitmez; ilk çalıştırmasında en yeni olaydan başlar.
