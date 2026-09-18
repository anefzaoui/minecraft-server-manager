---
title: 'Sunucu Oluşturma ve Yönetme'
description: "Sihirbazı açmak için (üst çubukta) Sunucu Oluştur'a tıklayın veya Sunucu Oluştur kartını seçin."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Geri belgeler dizinine](/docs/)

## Sunucu Oluşturma

Sihirbazı açmak için **Sunucu Oluştur**'a (üst çubuk) veya **Sunucu oluştur** kartına tıklayın.

![Sunucu oluştur](/docs/images/create-wizard.png)

Sihirbaz, bir yöneticinin istediği zaman değiştirebileceği Ayarlar sayfasındaki **Yeni sunucular için varsayılanlar**'dan bellek, CPU ve disk kotası alanlarını önceden doldurur.

![Yeni sunucular için varsayılanlar](/docs/images/settings-defaults.png)

Şunları seçersiniz:

- Bir **isim** (ve isteğe bağlı simge, vurgu rengi ve filonuzu düzenlemek için etiketler).
- Bir **sunucu türü** - vanilla, Paper, Fabric, Forge, NeoForge ve daha fazlası, her biri arka planda doğru itzg görüntüsüne eşlenir.
- Bir **Minecraft sürümü** - `LATEST`, bir anlık görüntü veya belirli bir sürüm.
- **Kaynaklar** - RAM (yığın), kapsayıcı bellek sınırı, CPU ve disk kotası.

Bir mod paketi mi tercih ediyorsunuz? **Mod paketinden** sekmeli, bunun yerine bir CurseForge, Modrinth, FTB veya GT New Horizons paketi yükler (bkz. [Mod Paketleri](/docs/modpacks/)) veya **yüklediğiniz özel bir zip** alır: bir CurseForge mod paketi dışa aktarma (`manifest.json`) veya mod jar'larının herhangi bir zip'i. Manifest (veya tanımlanan jar'lar genelindeki çoğunluk oyu) yükleyiciyi ve Minecraft sürümünü doldurur ve her mod tek bir görevde yüklenir. Ayrıca kaydedilmiş bir [Blueprint](/docs/blueprints/) ile de başlayabilirsiniz.

Panel, sürümünüz için uygun bir Java çalışma zamanını otomatik olarak seçer, görüntüyü çeker, kapsayıcıyı oluşturur ve (isteğe bağlı olarak) tek bir formdan başlatır.

## Sunucular listesi

**Sunucular** sayfası, durum ve hızlı istatistiklerle birlikte tüm filonuzu listeler.

![Sunucular listesi](/docs/images/servers-list.png)

## Tek bir sunucu

![Oyuncular](/docs/images/players.png)

Bir sunucuyu açmak size sekmeli bir çalışma alanı sunar:

- **Genel Bakış** - durum, canlı istatistikler, çalışma süresi ve birincil başlatma / durdurma / yeniden başlatma kontrolleri.
- **Konsol** - canlı günlük akışı ve komut girişi, artı oyun içi sohbet ([ayrıntılar](/docs/console-and-chat/)).
- **Oyuncular** - çevrimiçi olanlar, artı envanter, istatistikler ve [sohbet komutları](/docs/console-and-chat/).
- **Modlar** - yüklenen mod listesi, [mod tarayıcısı](/docs/modpacks/) ve içerik güncellemeleri.
- **Dünya** - [dünyalar, canlı harita ve dosya yöneticisi](/docs/worlds-and-files/).
- **Yedeklemeler** - bu sunucu için [anlık görüntüler ve geri yükleme](/docs/backups/).
- **İzleme** - sunucu başına geçmiş ve canlı metrikler, çökme raporları dahil (aşağıya bakın).
- **Ayarlar** - sunucunun nasıl çalıştığına dair her şey, artı [entegrasyonlar](/docs/integrations/) (Discord, durum sayfası, davetiyeler, sohbet botu).

![Sunucu genel bakışı](/docs/images/server-overview.png)

**Dünya Kontrolleri** rayı her sekmede gezinir: oyun içi saat, hava durumu, geçiş çipleri olarak yaygın oyun kuralları ve geri kalanlar için "Tüm dünya kurallarını göster".

![Dünya kontrolleri](/docs/images/world-controls.png)

**İzleme → Canlı**, TPS ve milisaniye başına tik, 24 saat / 7 gün çökme ve yeniden başlatma geçmişi olan bir sağlık ve kararlılık kartı ve dünya başına boyutları gösterir.

![Canlı izleme](/docs/images/monitoring-live.png)

## Sunucu ayarları

**Ayarlar** sekmesi, tam yapılandırma yüzeyidir: yeniden adlandırma, kaynaklar, güncelleme ilkesi, otomatik başlatma / otomatik yeniden başlatma, ortam değişkenleri ve gelişmiş Docker geçersiz kılmaları. Kapsayıcının nasıl çalıştığını değiştiren alanlar, yeniden başlatma gerektirdiği açıkça işaretlenmiştir.

![Sunucu ayarları](/docs/images/server-settings.png)

**Bellek ölçer hakkında.** "RAM (Java yığını)", Java'ya hem başlangıç hem de maksimum yığın olarak verilir ve Java, Aikar / MeowIce bayrak ön ayarları olsun veya olmasın, verilen bir yığını ilk dakika içinde doldurur. Bu nedenle bellek ölçer yaklaşık yığın boyutunda sabitlenir ve kimse oynamasa bile orada kalır; ölçerdeki tik, yığının kapsayıcı sınırı altında oturduğu yeri işaretler ve altındaki not bunu söyler. Belleğin gerçek kullanıma uymasını tercih ederseniz, daha küçük bir **Başlangıç yığını** (gelişmiş) ayarlayın: 2 GB yığında, ölçümlerimizde boşta kullanımın 2,6 GB'tan yaklaşık 1,3 GB'a düşmesine neden oldu. Java'nın yığın dışında da belleğe ihtiyacı vardır (vanilla'da yaklaşık 0,5 GB, büyük bir mod paketinde 1,5 ila 2 GB), bu da kapsayıcı sınırının boş alanının ne içindir. Sayılar için README'nin "İki bellek sınırı" bölümüne bakın.

> Gelişmiş Docker geçersiz kılma alanları (özel kapsayıcı adı, ek bağlantı noktası ve bağlama noktaları ve ham geçersiz kılmalar) **yalnızca yöneticilere yöneliktir**, çünkü bir bağlama noktası artı panelin Docker erişimi, ana bilgisayarda etkili bir şekilde kök erişimidir. [Kullanıcılar ve roller](/docs/users-and-roles/) bölümüne bakın.

## Çökme raporları ve mclo.gs analizi

Çökme raporları (`crash-reports/*.txt` ve JVM `hs_err_pid*.log` dosyaları) otomatik olarak alınır, istisna ve şüpheli modlarla tek satırlık bir özete ayrıştırılır ve **İzleme → Geçmiş** altında listelenir:

![Çökme raporu kartı](/docs/images/crash-mclogs-card.png)

Her rapor kartı, yerleşik bir görüntüleyici (katlanabilir bölümler ve vurgulanmış istisnalarla), yığın izini kopyalama ve indirme, artı iki [mclo.gs](https://mclo.gs) eylemi sunar:

- **mclo.gs'ye paylaş** raporu herkese açık bir yapıştırma olarak yayınlar ve bağlantıyı kopyalar - mod yazarlarının ve destek Discord'larının istediği tam şey. Bağlantı raporda saklanır, bu nedenle hiçbir şey asla birden fazla kez yüklenmez.
- **Analiz et**, yapıştırma üzerinde mclo.gs'nin otomatik içgörülerini çalıştırır: bilinen sorunlar ve önerilen düzeltmeler (eksik bağımlılıklar, sürüm uyumsuzlukları, yaygın mod çakışmaları), doğrudan panelde oluşturulur.

![mclo.gs içgörüleri](/docs/images/crash-insights.png)

Her iki eylem de açık bir onayın arkasındadır, çünkü bir yapıştırma herkese açıktır: çökme raporları oyuncu adlarını ve tüm mod listenizi içerebilir. Panel asla kendi başına hiçbir şey yüklemez.
