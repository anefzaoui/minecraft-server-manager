---
title: 'Zamanlamalar'
description: 'Zamanlamalar sayfası, cron ifadeleriyle tekrarlanan görevleri otomatikleştirir.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Zamanlamalar** sayfası, cron ifadeleriyle tekrarlayan görevleri otomatikleştirir. Harici cron veya betik gerekmez.

![Zamanlamalar](/docs/images/schedules.png)

## Neleri zamanlayabilirsiniz?

- **Yeniden başlatmalar** - uzun süre çalışan bir sunucuyu sağlıklı tutmak için gece yarısı yeniden başlatma.
- **Yedeklemeler** - düzenli anlık görüntüler (`Zamanlanmış` olarak etiketlenir, [Yedeklemeler](/docs/backups/) sayfasında).
- **Komutlar** - bir zamanlamaya göre herhangi bir sunucu komutunu çalıştırın.
- **Güncelleme denetimleri** - güncel olmayanları periyodik olarak yenileyin.

Her zamanlama belirli bir sunucuyu (veya paneli genel olarak) hedefler, kendi cron ifadesi üzerinde çalışır ve silinmeden etkinleştirilip devre dışı bırakılabilir. Son çalıştırma zamanı gösterilir, böylece çalıştığını doğrulayabilirsiniz.
