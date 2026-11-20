---
title: 'Gösterge Paneli'
description: 'Gösterge paneli sizin ana üssünüzdür: her sunucu, canlı durumu ve neler olup bittiğine dair güncel bir akış.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Dokümanlar dizinine dön](/docs/)

Gösterge paneli sizin ana üssünüzdür: her sunucu, canlı durumu ve neler olup bittiğine dair güncel bir akış.

![Gösterge Paneli](/docs/images/dashboard.png)

## Özet kutucukları

En üstte:

- **Çevrimiçi sunucular**: toplam sunucu sayınızdan kaç tanesinin şu anda çalıştığı.
- **Bağlı oyuncular**: çalışan tüm sunuculardaki toplam oyuncu sayısı.
- **Mevcut güncellemeler**: kaç sunucu, paket veya modun daha yeni bir sürümü var ([Güncellemeleri gör](/docs/updates/)).
- **Docker**: panelin Docker daemon'una ulaşıp ulaşamadığı ve sürümü.

İkinci bir satır **Ayrılan Bellek** (ve ne kadarının kullanıldığı), tüm sunucu veri klasörlerindeki **Kullanılan Depolama**, **Sağlık · 24 saat** (son 24 saatteki çökmeler, bellek yetersizliği durmaları ve otomatik yeniden başlatmalar) ve modlar ile sunucu düzeyindeki güncellemeler olarak ayrılmış **Güncellemeler** ekler. Bunların altında, **Duruma Göre Sunucular** her durumdaki sunucu sayınızı ve **Kaynak Genel Bakışı** her sunucunun bellek ve CPU payını gösteren grafikler yer alır.

## Sunucu kartları

Her sunucu, durumu (Çalışıyor, Başlatılıyor, Durduruldu, Çöktü ve Sağlıksız veya Takılmış gibi ara durumlar), türü ve Minecraft sürümü, oyun bağlantı noktası ve etiketleri ile bir kart olarak gösterilir. Her kart, kota karşısında **oyuncuları** ve **disk** kullanımını gösterir; çalışan sunucular ayrıca sürekli güncellenen canlı **CPU** ve **belleği** de gösterir.

O sunucuyu açmak için bir karta tıklayın. Boş **Sunucu Oluştur** kartı ve üst çubukta bulunan **Sunucu Oluştur** düğmesi, [oluşturma sihirbazını](/docs/servers/) başlatır.

Sunucularınızı (ad, tür, sürüm veya etiketle) arayabilir, duruma, ada, boyuta, son başlatılma veya oluşturulma zamanına göre sıralayabilir ve sağdaki geçiş düğmesiyle ızgara ve liste düzenleri arasında geçiş yapabilirsiniz.

## Son etkinlikler

En alttaki akış, panelin okunabilir denetim izinin en son girişlerini gösterir: oturum açmalar, yedeklemeler, şablon dışa aktarımları, güncelleme denetimleri, sohbet komutu değişiklikleri, sunucu başlatma ve durdurmalar ve daha fazlası. Her giriş, ait olduğu sunucuya (veya panele kendisi) ve ne kadar zaman önce gerçekleştiğine göre etiketlenir. **Tümünü Görüntüle**, [Etkinlik](/docs/activity/) sayfasında tam geçmişi açar.
