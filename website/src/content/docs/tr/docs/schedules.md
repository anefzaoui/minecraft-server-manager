---
title: 'Zamanlamalar'
description: 'Zamanlamalar sayfası, cron ifadeleriyle tekrarlanan görevleri otomatikleştirir. Harici cron veya betik gerekmez.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Belgeler dizinine geri dön](/docs/)

**Zamanlamalar** sayfası, cron ifadeleriyle yinelenen görevleri otomatikleştirir. Harici cron veya betik yok.

![Zamanlamalar](/docs/images/schedules.png)

## Neleri zamanlayabilirsiniz

- **Yeniden Başlatmalar**: uzun süredir çalışan bir sunucuyu sağlıklı tutmak için gecelik yeniden başlatma.
- **Durdurmalar ve Başlatmalar**: bir sunucuyu gece kapatıp sabah tekrar açma.
- **Yedeklemeler**: düzenli anlık görüntüler ([Yedeklemeler](/docs/backups/) sayfasında `scheduled` olarak etiketlenir). Bir yedekleme zamanlaması, her yedeklemeden sonra dünyayı küçültebilir ([bir dünyayı küçültme](/docs/world-shrink/)). Her yeni sunucu otomatik olarak günlük bir yedekleme zamanlaması alır.
- **Komutlar**: herhangi bir sunucu komutunu zamanlamaya göre çalıştırma.
- **Güncelleme Kontrolleri**: süresi dolmuş olanları periyodik olarak yenileme. Zamanlanmış kontrol, [Otomatik Güncelleme](/docs/modpacks/#update-policy) olarak ayarlanmış sunucular için güncellemeleri uygulayan şeydir.

Her zamanlama belirli bir sunucuyu (veya paneli global olarak) hedefler, kendi cron ifadesiyle çalışır ve silinmeden etkinleştirilebilir veya devre dışı bırakılabilir. Düzenleyici, siz yazarken bir sonraki çalışma zamanlarını önizler, cron zamanları panelin saat dilimine (Ayarlar'da ayarlanır) uyar ve tablo her zamanlamanın bir sonraki çalışmasını gösterir. Her tetikleme bir geçmiş olayı olarak kaydedilir ve başarısız bir çalıştırma da kaydedilir.

Panel ayrıca ilk önyüklemede kendi bakım zamanlamalarını da oluşturur; bunları yeniden zamanlayabilir veya kapatabilirsiniz: günlük bir güncelleme kontrolü, her altı saatte bir depolama yeniden taraması, eski geçici dosyaların günlük temizliği, her 15 dakikada bir yasak süresi dolma taraması (süresi dolmuş geçici yasakları kaldırma) ve gecelik içerik meta veri doldurma (eksik mod adlarını ve simgelerini doldurma).

## Sunucu meşgul olduğunda

Sunucusunu başka bir eylemin (geri yükleme, yedekleme temizliği, bağlantı noktası değişikliği) ortasında bulan zamanlanmış bir yedekleme veya başlatma, bu eylem bitene kadar her dakika tekrar dener, en fazla 30 dakika. Bekleyen bir başlatma, bu arada biri sunucuyu başlatır veya durdurursa iptal edilir. Zamanlanmış bir yeniden başlatma veya durdurma yeniden denenmez: atlanır ve bir sonraki zamanında tekrar çalışır.
