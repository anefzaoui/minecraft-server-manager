---
title: 'Etkinlik günlüğü'
description: 'Etkinlik sayfası tam denetim izidir: panelde olan her şeyin aranabilir, kronolojik kaydı.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Etkinlik** sayfası tam denetim izidir: panelde olan her şeyin aranabilir, kronolojik kaydı. Sunucuya veya olay türüne göre filtreleyin, özetleri arayın ve filtrelediğinizi CSV veya JSON olarak dışa aktarın. Bir günlük yakalayan girişler (örneğin bir çökme) onu yerinde açar.

![Etkinlik](/docs/images/activity.png)

## Neler kaydedilir

- **Kimlik Doğrulama**: oturum açmalar (2FA veya yedek kodun kullanılıp kullanılmadığı dahil), hesap kilitlemeleri, şifre değişiklikleri ve 2FA'nın etkinleştirilmesi, devre dışı bırakılması veya sıfırlanması.
- **Sunucu yaşam döngüsü**: oluşturmalar, başlatmalar, durdurmalar, yeniden başlatmalar, çökmeler, otomatik yeniden başlatmalar ve bellek dışı olaylar.
- **Uyarılar**: takılıp kalan önyüklemeler, durdurma hataları, başarısız programlar, kota durdurmaları, sağlıksız kapsayıcılar, yeniden başlatma sonrası çevrimdışı olma.
- **Veriler**: oluşturulan ve geri yüklenen yedeklemeler, dışa aktarılan şablonlar, yüklenen ve yükseltilen paketler, mod ve dünya değişiklikleri ve dosya düzenlemeleri.
- **Oyuncular**: atılanlar, yasaklananlar, beyaz liste ve operatör değişiklikleri ve oyuncu notları.
- **Yapılandırma**: sohbet komutu değişiklikleri, kullanıcı ve rol değişiklikleri, sunucu başına izin değişiklikleri, oyun portu değişiklikleri ve ayar düzenlemeleri.

Her giriş kimin yaptığını (bir kullanıcı adı veya otomatik eylemler için panel/zamanlayıcı), hangi sunucuyla ilgili olduğunu ve ne zaman yapıldığını kaydeder. [Gösterge tablosu](/docs/dashboard/) en son girişleri gösterir; bu sayfa tam geçmişi içerir. Operatörler ve görüntüleyiciler yalnızca görüntüleyebildikleri sunucularla ilgili girişleri (artı panel genelindekileri) görür ve sunucu başına izin değişiklikleri yalnızca yöneticilere gösterilir. Yaşam döngüsü ve uyarı olayları ayrıca Discord'a iletilebilir (bkz. [Entegrasyonlar](/docs/integrations/)).

Güvenlikle ilgili olayları (girişler, 2FA değişiklikleri, rol ve izin değişiklikleri) yakaladığı için, bir hesapla ilgili bir şeyler ters gittiğinde etkinlik günlüğü de ilk başvuracağınız yerdir.
