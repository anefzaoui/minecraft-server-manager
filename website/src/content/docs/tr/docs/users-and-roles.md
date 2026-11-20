---
title: 'Kullanıcılar ve roller'
description: "Minecraft Server Manager'daki hesaplar, yönetici, operatör ve görüntüleyici rolleri ve sunucu başına izinler."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Geri belgeler dizinine](/docs/)

Panel çok kullanıcılıdır. Hesapları **Ayarlar → Kullanıcılar** altında yönetin.

![Kullanıcılar](/docs/images/settings-users.png)

## Üç rol

| Rol          | Her sunucuda varsayılan                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Her şey: kullanıcıları, API anahtarlarını, genel dosyaları, gelişmiş Docker geçersiz kılmalarını ve her sunucu eylemini yönetir.                |
| **operator** | Sunucuları çalıştırır ve yapılandırır (başlat/durdur, konsol, yedeklemeler, dünyalar, modlar, çoğu ayar), ancak yöneticiye özel alanları değil. |
| **viewer**   | Salt okunur. Sunucuları ve durumlarını görür, ancak değişiklik yapmaz.                                                                          |

Bir görüntüleyici dahil her kullanıcı, kendi [iki faktörlü kimlik doğrulamasını](/docs/two-factor-authentication/) yönetebilir, çünkü kendi oturumunu korumak bir sunucu yönetimi eylemi değildir.

Bir rol, her sunucu için **varsayılandır**. Birine bir sunucuda farklı haklar vermek için aşağıdaki sunucu başına izinleri kullanın.

## Sunucu başına izinler

**İzinler** sayfası (kenar çubuğunda veya **Ayarlar → Kullanıcılar** altındaki **Sunucu İzinleri**) bir tablo gösterir: bir tarafta her operatör ve görüntüleyici, diğer tarafta her sunucu. O tek sunucuda o kullanıcının ne yapabileceğine karar vermek için bir hücreye tıklayın. Yöneticiler listelenmez çünkü her zaman her şeye sahiptirler.

![İzinler](/docs/images/settings-permissions.png)

Her hücre bir dizi izindir:

| İzin             | O sunucuda neye izin verir                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Görünüm**      | Sunucuyu, durumunu, konsol çıktısını, oyuncuları, geçmişi ve istatistikleri görür.                                                     |
| **Güç**          | Sunucuyu başlatır, durdurur, yeniden başlatır, kapatır ve yeniden oluşturur.                                                           |
| **Konsol**       | Konsol komutlarını ve dünya hızlı eylemlerini çalıştırır, sohbet gönderir ve sohbet komutlarını yönetir.                               |
| **Oyuncular**    | Oyuncuları atar, yasaklar, beyaz listeye alır, operatör yapar ve oyuncu notlarını düzenler.                                            |
| **İçerik**       | Modları, eklentileri, paketleri, dünyaları, veri paketlerini yükler ve kaldırır, envanterleri düzenler.                                |
| **Yedeklemeler** | Yedeklemeleri oluşturur, geri yükler, indirir ve siler.                                                                                |
| **Dosyalar**     | Sunucu dosyalarını, arşivlenmiş günlükleri ve günlük paketlerini gözden geçirir, düzenler, yükler ve indirir; şablonları dışa aktarır. |
| **Ayarlar**      | Sunucu ayarlarını, özelliklerini, entegrasyonlarını, simgesini değiştirir ve sürümleri yükseltir.                                      |
| **Sil**          | Sunucuyu siler.                                                                                                                        |

![İzin düzenleyici](/docs/images/permissions-editor.png)

Tablonun altında, **Her İzin Neleri Kapsar** her izni, bir kişinin ne yapabileceğine, nelerin dahil olmadığına ve hangi tam panel yollarını açtığına ayırır. Son liste, test paketi tarafından çalışan kodla karşılaştırılır.

![İzin referansı](/docs/images/permissions-reference.png)

Telefonda, tablo her kullanıcı için tek bir karta yığılır ve her sunucu için bir satır bulunur.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Telefonda İzinler" width="180">
</p>

Parçaların nasıl bir araya geldiği:

- **Rol varsayılandır.** Bir operatör her sunucuda her izinle başlar; bir görüntüleyici yalnızca Görünüm ile başlar. Soluk metindeki bir hücre (araç ipucu "Rol varsayılanı" der) hiç değiştirilmemiştir.
- **Bir hücre, yalnızca o sunucu için rolü geçersiz kılar.** Bir görüntüleyiciye bir sunucuda Güç ve Konsol verin, onu çalıştırabilir, diğer tüm sunucular onlar için salt okunur kalır. Bir operatörden ana sunucunuzdaki Silme iznini kaldırın, orada diğer her şeye sahip olmaya devam ederler.
- **Her izin Görünüm'ü içerir.** Göremediğiniz bir sunucu üzerinde işlem yapamazsınız.
- **Bir sunucuyu gizlemek için her şeyi kapatın.** Kullanıcının kenar çubuğundan, kontrol panelinden, yedeklemelerinden, zamanlamalarından, etkinliklerinden, güncellemelerinden, mod paketlerinden, canlı durumundan, çalışan görevlerinden ve şablonlarından kaybolur ve dünya kütüphanesi onu adlandırmayı durdurur. Doğrudan bir bağlantı, API çağrısı veya konsol soketi, var olmayan bir sunucu gibi "bulunamadı" yanıtını verir.
- **Panel genelindeki eylemler hala rolü takip eder.** Sunucu oluşturma (birini klonlamak dahil), depolama, kullanıcılar, API anahtarları, genel ayarlar ve panel genelindeki zamanlamalar sunucu başına değildir, bu nedenle bazı sunucularda izinleri olan bir görüntüleyici hala bunlardan hiçbirini yapamaz. Operatörler sunucu oluşturma ve panel genelindeki zamanlamaları tutar; depolama, kullanıcılar, API anahtarları ve genel ayarlar yalnızca yöneticiye özeldir.
- **Zamanlamalar sunucuyu takip eder.** Bir sunucudaki zamanlanmış bir yeniden başlatma, yedekleme veya komut, rol ne olursa olsun orada eşleşen izni (Güç, Yedeklemeler veya Konsol) gerektirir.
- **Şablonlar da sunucuyu takip eder.** Bir sunucuyu şablon olarak dışa aktarmak, dosyaları taşıdığı için orada Dosyalar iznini gerektirir. Birinin göremediği bir sunucudan dışa aktarılan bir şablon, onlar için de gizlenir.
- **Yöneticiye özel alanlar her sunucuda yöneticiye özel kalır**: sohbet botu, yedekleme saklama süresi ve gelişmiş Docker geçersiz kılmaları.

Her değişiklik, kimin neyi değiştirdiğini gösteren etkinlik günlüğüne yazılır; bu girişler yalnızca yöneticilere gösterilir. Bir kullanıcıyı silmek satırlarını kaldırır. Bir sunucuyu kaldırmak onları tutar, bu nedenle birinden gizlenen bir sunucu geçmişinde ve saklanan yedeklemelerinde gizli kalır.

Mevcut kurulumlar değişmeden çalışmaya devam eder: bir yönetici bir hücreyi düzenleyene kadar her kullanıcı, rollerinin onlara daha önce verdiği haklara tam olarak sahiptir.

## Yalnızca yöneticiye özel ve neden

Birkaç şey kasıtlı olarak yöneticilere kısıtlanmıştır:

- **Kullanıcı yönetimi, depolama, genel ayarlar, API anahtarları ve genel dosyalar.**
- **[Genel API](/docs/public-api/)**: `/api/v1`'i etkinleştirme ve salt okunur Bearer belirteçleri oluşturma, kapsam belirleme veya iptal etme.
- **Gelişmiş Docker geçersiz kılmaları**: özel kapsayıcı adı, ek port yayınları ve bağlama bağlamaları. Bir bağlama bağlaması, herhangi bir ana bilgisayar yolunu bir kapsayıcıya eşleyebilir ve panelin Docker erişimiyle birleştirildiğinde bu, ana bilgisayarda etkili bir şekilde kök erişimidir. Bu alanlar yalnızca yöneticiler için görünür.

Özel kapsayıcı adları, panelin kendi `msm-` ad alanında yaşayamaz, bu nedenle elle adlandırılmış bir kapsayıcı asla başka bir sunucunun kapsayıcısını gölgeleyip yanlış bir örneğe durdurma veya komut yönlendiremez.

## Hesap yönetimi

![Profil resmi](/docs/images/profile-picture.png)

Yöneticiler, Kullanıcılar tablosundan kullanıcı oluşturabilir, rolleri değiştirebilir, şifreleri sıfırlayabilir ve hesapları silebilir. **2FA** sütunu, her kullanıcının iki faktörlü kimlik doğrulamasının etkin olup olmadığını gösterir; bir yönetici, kullanıcının eylemler menüsündeki **2FA Sıfırla** ile başka bir kullanıcının 2FA'sını sıfırlayabilir (kayıp telefon ve yedek kodlar durumu için), ancak kendi şifresi olmadan asla kendi şifresini devre dışı bırakamaz, ki bu kendi kendine hizmet akışı bunu halleder.

Başarısız oturum açmalar, kaba kuvvet denemelerini yavaşlatmak için hesap başına (hem IP başına hem de hesap genelinde bir sayaç) hız sınırlıdır ve aynı sınır 2FA kodu adımını da kapsar, böylece doğru bir şifre kod tahmininden önce sayacı sıfırlayamaz. Bunun önünde, oturum açma / 2FA / kurulum uç noktalarında daha kaba bir IP başına istemci istek sınırlayıcısı bulunur, bu `RATE_LIMIT_AUTH_PER_15MIN` (varsayılan 100; ters proxy arkasında, gerçek istemci IP'sini anahtarlaması için `TRUST_PROXY` ayarlayın) ile ayarlanabilir.
