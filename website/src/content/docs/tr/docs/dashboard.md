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

- **Çevrimiçi sunucular** - sunucularınızdan kaçının şu anda çalıştığı.
- **Bağlı oyuncular** - çalışan tüm sunuculardaki toplam oyuncu sayısı.
- **Mevcut güncellemeler** - kaç sunucu, paket veya modun daha yeni bir sürümü var ([Güncellemeleri gör](/docs/updates/)).
- **Docker** - panelin Docker daemon'una ulaşıp ulaşamadığı ve sürümü.

## Sunucu kartları

Her sunucu, durumu (Çalışıyor, Başlıyor, Durduruldu, Çöktü), türü ve Minecraft sürümü ile oyun portunu gösteren bir kart olarak görünür. Çalışan sunucular için ayrıca canlı **oyuncular**, **CPU**, **bellek** ve **disk** kullanımını sürekli güncellenmiş olarak alırsınız.

O sunucuyu açmak için bir karta tıklayın. Boş **Sunucu oluştur** kartı ve üst çubuktaki **Sunucu Oluştur** düğmesi, [oluşturma sihirbazını](/docs/servers/) başlatır.

Sunucularınızı arayabilir ve sıralayabilir, sağdaki geçiş düğmesiyle ızgara ve liste düzenleri arasında geçiş yapabilirsiniz.

## Son etkinlikler

En alttaki akış, canlı, insan tarafından okunabilir bir denetim izidir: oturum açmalar, yedeklemeler, şablon dışa aktarımları, güncelleme denetimleri, sohbet komutu değişiklikleri, sunucu başlatma ve durdurmalar ve daha fazlası. Her giriş, ait olduğu sunucuyla (veya panelin kendisiyle) ve ne kadar süre önce gerçekleştiğiyle etiketlenir. Tam geçmiş [Etkinlik](/docs/activity/) sayfasında bulunur.
