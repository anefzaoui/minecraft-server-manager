---
title: 'Etkinlik günlüğü'
description: 'Etkinlik sayfası tam denetim izidir: panelde olan her şeyin aranabilir, kronolojik kaydı.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Etkinlik** sayfası, panelde olan her şeyin aranabilir, kronolojik bir kaydı olan tam denetim izidir.

![Etkinlik](/docs/images/activity.png)

## Neler kaydedilir

- **Kimlik Doğrulama** - oturum açmalar (2FA veya yedek kodun kullanılıp kullanılmadığı dahil) ve 2FA'nın etkinleştirilmesi, devre dışı bırakılması veya sıfırlanması.
- **Sunucu yaşam döngüsü** - oluşturmalar, başlatmalar, durdurmalar, yeniden başlatmalar, çökmeler ve bellek yetersizliği olayları.
- **Uyarılar** - takılıp kalan önyüklemeler, durdurma hataları, zamanlanmış görev hataları, kota durdurmaları, sağlıksız konteynerler, yeniden başlatma sonrası çevrimdışı olma.
- **Veri** - oluşturulan ve geri yüklenen yedeklemeler, dışa aktarılan şablonlar, yüklenen ve yükseltilen paketler.
- **Yapılandırma** - sohbet komutu değişiklikleri, rol değişiklikleri ve ayar düzenlemeleri.

Her girdi, kimin yaptığını (bir kullanıcı adı veya otomatik eylemler için panel/zamanlayıcı), hangi sunucuyla ilgili olduğunu ve ne zaman olduğunu kaydeder. [Gösterge tablosu](/docs/dashboard/) en son girdileri gösterir; bu sayfa ise tam geçmişi içerir. Yaşam döngüsü ve uyarı olayları ayrıca Discord'a iletilebilir (bkz. [Entegrasyonlar](/docs/integrations/)).

Güvenlikle ilgili olayları (girişler, 2FA değişiklikleri, rol değişiklikleri) yakaladığı için, bir hesapla ilgili bir sorun olduğunda etkinlik günlüğü de ilk başvuracağınız yerdir.
