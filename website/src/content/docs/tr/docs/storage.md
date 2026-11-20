---
title: 'Depolama'
description: 'Disk alanının nereye gittiğini görün, her sunucu klasörünü bir disk kotasıyla sınırlayın ve artık ihtiyacınız olmayanları temizleyin.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Depolama** sayfası, diskinizin nereye gittiğini gösterir: kategoriye göre kullanım, kota başına her sunucu, en büyük dosyalar ve toplam kullanımın son taramalarda nasıl bir eğilim gösterdiği. Yalnızca yöneticiler içindir.

![Depolama](/docs/images/storage.png)

## Disk kotaları panel tarafından zorunlu kılınır

Docker, bir bind mount'un disk kullanımını sınırlayamaz, bu yüzden panel bunu yapar. Arka planda çalışan bir boyut-indeksleyici, veri klasörünü (her 15 dakikada bir, değişikliklerden sonra veya **Şimdi Yeniden Tara**'ya bastığınızda) tarar, her sunucunun ayak izini önbelleğe alır ve sunucu başına ayarladığınız disk kotasını zorlar. Bir mod, dünya yüklemek veya dosya yüklemek gibi, bir sunucunun klasörünü (dünya, modlar, yapılandırmalar, günlükler ve içindeki diğer her şey) kotasını aşacak bir eylem, bir sunucunun ana bilgisayarınızı doldurmasına izin vermek yerine, alan boşaltılana veya kota artırılana kadar engellenir.

Bir sunucunun kotasını [ayarlarında](/docs/servers/#server-settings) ayarlayın. Orada **Kota Aşıldığında Sunucuyu Durdur** seçeneğini etkinleştirmek, klasörü kotayı %10'dan fazla aştığında çalışan bir sunucuyu da durdurur ve sunucunun geçmişine not eder. Modlu sunucular büyük olabilir, bu yüzden onlara yer verin. [Yedeklemeler](/docs/backups/) ayrı olarak saklanır ve kota dahilinde sayılmaz.

## Temizlik

**Tek Tıkla Temizlik** kartı, panelin güvenli bir şekilde geri alabileceği alanı boşaltır: bir saatten eski geçici dosyalar, yetim kütüphane dosyaları ve 30 günden eski arşivlenmiş günlükler ve çökme raporları. Her biri ne kadar boşalttığını gösterir ve herhangi bir şey silinmeden önce bir önizleme açar. **Kategoriye Göre** ve **En Büyük Dosyalar** listeleri doğrudan dosya yöneticisine bağlanır, böylece yeriniz tükenmeden başka neleri budayabileceğinizi bulabilirsiniz.
