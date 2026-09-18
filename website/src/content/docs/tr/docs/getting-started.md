---
title: 'Başlangıç'
description: 'Paneli ilk açtığınızda, bir yönetici hesabı oluşturmanız istenir.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Dokümanlar dizinine dön](/docs/)

## İlk Kurulum

Paneli ilk açtığınızda, bir yönetici hesabı oluşturmanız istenir. Bu, siz daha fazlasını ekleyene kadar var olan tek hesaptır ve tam kontrole sahiptir.

Bir kullanıcı adı ve en az 8 karakterden oluşan bir şifre seçin. İşte bu kadar: oturum açtınız ve doğrudan kontrol paneline yönlendirildiniz.

> **Erişilebilir kurulumlar PIN ile korunur.** Paneli döngüsel olmayan bir adrese bağlarsanız (`PANEL_HOST` `127.0.0.1` dışında bir değerse), kurulum sayfası ayrıca **6 haneli bir PIN** ister. Panel, başlangıçta bunu konsoluna yazdırır. Yönetici hesabını ele geçirmesini önlemek için kullanıcı adınız ve şifrenizle birlikte girin. Yönetici hesabı oluştuktan sonra PIN kaybolur.

## Oturum Açma

Kurulumdan sonra panel bir giriş ekranıyla korunur. Devam etmek için kullanıcı adınızı ve şifrenizi girin.

![Giriş](/docs/images/login.png)

Hesabınızda [iki faktörlü kimlik doğrulama](/docs/two-factor-authentication/) etkinse, şifrenizden hemen sonra kimlik doğrulama uygulamanızdan 6 haneli bir kod girmeniz istenecektir.

## Etrafı Keşfetme

Her şey sol kenar çubuğundan yönetilir:

- **Kontrol Paneli** - tüm sunuculara genel bakış ([ayrıntılar](/docs/dashboard/)).
- **Sunucular**, **Mod Paketleri**, **Dünyalar**, **Blueprintler** - sunucuları ve içeriklerini oluşturun ve yönetin.
- **Güncellemeler**, **Yedeklemeler**, **Zamanlamalar**, **Depolama**, **Etkinlik** - operasyonel taraf: neyin güncel olmadığı, anlık görüntülarınız, otomasyon, disk kullanımı ve denetim günlüğü.
- **Ayarlar** (alt kısımda): kullanıcılar, API anahtarları ve panel yapılandırması.

Üst çubukta **Sunucu Oluştur** düğmesi, bir **tema değiştirici** (koyu/açık) ve [iki faktörlü kimlik doğrulamayı](/docs/two-factor-authentication/) yönetebileceğiniz veya oturumu kapatabileceğiniz **hesap menünüz** bulunur.

## Telefon veya Tablet Üzerinde

Her sayfa önce dar ekranlar için tasarlanmış ve oradan genişlemektedir: kenar çubuğu menü düğmesinin arkasına gizlenir, veri tabloları kartlara dönüşür, araç çubukları sarılır ve dünya kontrol çubuğu ihtiyacınız olduğunda açtığınız bir karta daraltılır. Düğmeler ve çipler gerçek bir dokunma hedefi boyutuna sahiptir. Hiçbir şey yalnızca masaüstüne özel değildir.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Telefonda Kontrol Paneli" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Telefonda Sunucu Genel Bakışı" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Telefonda Konsol" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Telefonda Modlar Sekmesi" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Telefonda Ayarlar" width="180">
</p>

## İhtiyacınız Olanlar

Panel, sunucuları çalıştırmak için Docker ile iletişim kurar, bu nedenle bir Docker arka plan programına (Docker Desktop veya bir Docker Engine soketi) erişmesi gerekir. Docker erişilebilir olduğunda, kontrol panelindeki Docker kutucuğu **Bağlandı** ve sürümünü gösterir. Değilse, panel çalışmaya devam eder. Arka plan programı çalışana kadar sunucuları başlatamazsınız.

## Sonraki Adımlar

- [İlk sunucunuzu oluşturun →](/docs/servers/)
- [Hesabınızı 2FA ile güvence altına alın →](/docs/two-factor-authentication/)
