---
title: 'Başlangıç'
description: "Minecraft Server Manager'ı kurun ve ilk çalıştırma ayarlarını tamamlayın: sistem kontrolü, saat diliminiz ve yönetici hesabı."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Dokümanlar dizinine dön](/docs/)

## İlk Kurulum

Paneli ilk açtığınızda, kısa bir kurulum sihirbazı size yol gösterecektir:

1.  **Sistem Kontrolü**, Docker'a erişilebildiğini, Node.js'in yeterince yeni olduğunu ve veri klasörünün yazılabilir olduğunu kontrol eder. Docker henüz çalışmıyorsa bile devam edebilirsiniz; sunucu oluşturma ve başlatma işlemleri Docker çalışana kadar bekler.
2.  **Yönetici Hesabınızı Oluşturun**. Bu, siz daha fazla hesap ekleyene kadar var olacak tek hesaptır ve tam kontrole sahiptir. Bir kullanıcı adı (2 ila 32 karakter) ve en az 8 karakterli bir şifre seçin. Oluşturulduğu anda oturum açmış olursunuz.
3.  **Panel Yapılandırması** (isteğe bağlı): oyunculara bağlanma adreslerinde göstermek için bir genel alan adı, bir CurseForge API anahtarı ve saat diliminiz. Hepsi daha sonra **Ayarlar**'da değiştirilebilir.

Son adım **Sunucu Oluştur** veya **Kontrol Paneline Git** seçeneklerini sunar.

![İlk kurulumun Sistem Kontrolü adımı](/docs/images/setup-system-check.png)

> **Ağa Açık Kurulumlar PIN Korumalıdır.** Paneli döngüsel olmayan bir adrese (`127.0.0.1` dışındaki `PANEL_HOST`) bağlarsanız, kurulum sayfası ayrıca **6 haneli bir PIN** ister. Panel, başlangıçta bunu konsoluna yazdırır. Kullanıcı adınız ve şifrenizle birlikte girin. Bu, portu ilk bulan bir yabancının yönetici hesabını ele geçirmesini engeller. PIN, yönetici hesabı oluşturulduktan sonra kaybolur.

## Oturum Açma

Kurulumdan sonra panel bir giriş ekranıyla korunur. Devam etmek için kullanıcı adınızı ve şifrenizi girin.

![Oturum Aç](/docs/images/login.png)

Hesabınızda [iki faktörlü kimlik doğrulama](/docs/two-factor-authentication/) etkinse, şifrenizden hemen sonra kimlik doğrulama uygulamanızdan 6 haneli bir kod girmeniz istenecektir.

## Etrafı Keşfetme

Her şey sol kenar çubuğundan yönetilir:

- **Kontrol Paneli** - tüm sunucular bir bakışta ([ayrıntılar](/docs/dashboard/)).
- **Sunucular**, **Mod Paketleri**, **Dünyalar**, **Blueprintler** - sunucuları ve içeriklerini oluşturun ve yönetin.
- **Güncellemeler**, **Yedeklemeler**, **Zamanlamalar**, **Depolama**, **Etkinlik** - operasyonel taraf: ne güncel değil, anlık görüntülarınız, otomasyon, disk kullanımı ve denetim günlüğü.
- **İzinler** (altta, yalnızca yöneticiler): her kullanıcının her sunucuda ne yapabileceği ([ayrıntılar](/docs/users-and-roles/#per-server-permissions)).
- **Ayarlar** (altta, yalnızca yöneticiler): API anahtarları, panel yapılandırması, yeni sunucular için varsayılanlar, [yedekleme saklama süresi](/docs/backups/#retention), kullanıcılar, oturum açma güvenliği ve genel API.

Bunların altında, kenar çubuğu sunucularınızı listeler. Birini açmak kendi sekmelerini gösterir: **Genel Bakış**, **Konsol**, **Oyuncular**, **Modlar**, **Dünya**, **Yedeklemeler**, **İzleme** ve **Ayarlar**, çoğu ilgili alt sekmelere sahiptir (örneğin, **Ayarlar → Yapılandırma** sunucunun ayarlarını ve oyun portunu içerir). [Tek bir sunucu](/docs/servers/#a-single-server) bölümüne bakın.

Üst çubukta **Sunucu Oluştur** düğmesi, bir **tema değiştirici** (koyu/açık) ve **hesap menünüz** bulunur; burada profil resminizi değiştirebilir, [iki faktörlü kimlik doğrulamayı](/docs/two-factor-authentication/) yönetebilir veya oturumu kapatabilirsiniz.

## Telefon veya Tablet Üzerinde

Her sayfa önce dar bir ekran için tasarlanmış ve oradan genişlemektedir: kenar çubuğu menü düğmesinin arkasına gizlenir, veri tabloları kartlara istiflenir, araç çubukları sarılır ve dünya kontrolleri rayı, ihtiyacınız olduğunda açtığınız bir karta daraltılır. Düğmeler ve çipler gerçek bir dokunma hedef boyutuna sahiptir. Hiçbir şey yalnızca masaüstüne özel değildir.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Telefonda Kontrol Paneli" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Telefonda Sunucu Genel Bakışı" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Telefonda Konsol" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Telefonda Modlar Sekmesi" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Telefonda Sürüm Uyumluluğu" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Telefonda Ayarlar" width="180">
</p>

## İhtiyacınız Olanlar

Panel, sunucuları çalıştırmak için Docker ile konuşur, bu nedenle bir Docker daemon'una (Docker Desktop veya bir Docker Engine soketi) erişmesi gerekir. Docker erişilebilir olduğunda, kontrol panelindeki Docker kutucuğu **Bağlandı** ve sürümünü gösterir. Değilse, panel yine de çalışır. Daemon çalışana kadar sunucu başlatamazsınız.

## Sonraki Adımlar

- [İlk sunucunuzu oluşturun →](/docs/servers/)
- [Hesabınızı 2FA ile güvence altına alın →](/docs/two-factor-authentication/)
