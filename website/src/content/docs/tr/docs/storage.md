---
title: 'Depolama'
description: 'Depolama sayfası, sunucu başına kullanım ve zaman içindeki eğilimler dahil olmak üzere diskinizin nereye gittiğini gösterir.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Depolama** sayfası, diskinizin nereye gittiğini gösterir: sunucu başına kullanım ve zaman içindeki eğilimi.

![Depolama](/docs/images/storage.png)

## Disk kotaları panel tarafından zorlanır

Docker, bir bind mount'un disk kullanımını sınırlayamaz, bu yüzden panel bunu yapar. Arka planda çalışan bir boyut-indeksleyici, veri dizininde gezinir, her sunucunun ayak izini önbelleğe alır ve sunucu başına ayarladığınız disk kotasını zorlar. Bir sunucunun verileri (dünya + yedeklemeler + diğer her şey) kotasına yaklaştığında, panel bir sunucunun ana bilgisayarınızı doldurmasına izin vermek yerine kontrolsüz büyümeyi durdurur.

Bir sunucunun kotasını [ayarlarında](/docs/servers/) ayarlayın. Modlu sunucular ve [yedeklemeleri](/docs/backups/) büyük olabilir, bu yüzden onlara yer açın.

## Temizlik

Depolama görünümü, yeriniz tükenmeden önce neyi budayacağınızı (eski yedeklemeler, kullanılmayan dünyalar veya beklentilerin çok ötesine geçen bir sunucu) bulmanıza yardımcı olur.
