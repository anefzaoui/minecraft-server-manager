---
title: 'Sunucu Oluşturma ve Yönetme'
description: 'Panelde Minecraft sunucuları oluşturun, başlatın, durdurun, yeniden oluşturun ve yapılandırın: oluşturma sihirbazı, ayarlar, bellek ve oyun portu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Geri dön](/docs/)

## Sunucu Oluşturma

Sihirbazı açmak için **Sunucu Oluştur** (üst çubuk) veya **Sunucu Oluştur** kartına tıklayın.

![Sunucu oluştur](/docs/images/create-wizard.png)

Sihirbaz, yönetici tarafından istediği zaman değiştirilebilen Ayarlar sayfasındaki **Yeni Sunucular İçin Varsayılanlar**'dan Java yığınını ve disk kotasını önceden doldurur. Yeni bir sunucu, CPU limitini de oradan alır.

![Yeni sunucular için varsayılanlar](/docs/images/settings-defaults.png)

Şunları seçersiniz:

- Bir **isim** (ve isteğe bağlı bir açıklama, simge ve vurgu rengi). Filoyu organize etmek için etiketler daha sonra sunucunun ayarlarında eklenir.
- Bir **sunucu türü**: Vanilla sekmesinde Vanilla, Paper veya Purpur. Modlu bir sunucu için **Modlardan** sekmesi yükleyiciyi (Fabric, Forge, NeoForge veya Quilt), Minecraft sürümünü ve bir yükleyici sürümünü (en son veya belirli bir sürüm) seçer, ardından modları aramanıza olanak tanır.
- Bir **Minecraft sürümü**: `LATEST`, bir anlık görüntü veya belirli bir sürüm (beta ve alfa sürümleri dahil).
- Bir **oyun bağlantı noktası**: ücretsiz bir tane önerilir. Uzak konsol (RCON) varsayılan olarak 1000 daha yüksek bir bağlantı noktası kullanır. Bunu daha sonra değiştirebilirsiniz ([Oyun bağlantı noktasını değiştirme](#changing-the-game-port) bölümüne bakın).
- **Kaynaklar**: Java yığını (konteyner bellek sınırı bunun %50 üzerinde ayarlanır) ve bir disk kotası.

**Gelişmiş Seçenekler**, sunucu görüntüsünün desteklediği diğer tüm ayarları, ek ortam değişkenlerini ve (yöneticiler için) gelişmiş Docker ayarlarını açar.

Mod paketi mi tercih ediyorsunuz? **Mod Paketinden** sekmesi bunun yerine bir CurseForge, Modrinth veya GT New Horizons paketi yükler (bkz. [Mod Paketleri](/docs/modpacks/)) veya **yüklediğiniz özel bir zip** alır: bir Modrinth `.mrpack`, bir CurseForge mod paketi dışa aktarma (`manifest.json`) veya mod jar'larının herhangi bir zip'i. Manifest (veya tanımlanan jar'lar arasındaki çoğunluk oyu) yükleyiciyi ve Minecraft sürümünü doldurur ve her mod tek bir görevde yüklenir. Ayrıca **Blueprint'ten** sekmesinde kaydedilmiş bir [Blueprint](/docs/blueprints/) ile başlayabilirsiniz.

Panel, sürümünüz için uygun bir Java çalışma zamanını otomatik olarak seçer, görüntüyü çeker, konteyneri oluşturur ve başlatır, hepsi tek bir formdan.

## Sunucular Listesi

**Sunucular** sayfası, tüm filonuzu durum ve hızlı istatistiklerle listeler.

![Sunucular listesi](/docs/images/servers-list.png)

## Tek Bir Sunucu

![Oyuncular](/docs/images/players.png)

Bir sunucuyu açmak size sekmeli bir çalışma alanı sunar:

- **Genel Bakış**: oyuncularla paylaşılacak adres, açıklama, canlı kullanım ve çevrimiçi olanlar.
- **Konsol**: canlı günlük akışı ve komut girişi, oyun içi sohbet ve [sohbet komutları](/docs/console-and-chat/).
- **Oyuncular**: kadro, ayrıca envanter ve istatistikler.
- **Modlar**: yüklenen mod listesi, [mod tarayıcısı](/docs/modpacks/) ve içerik güncellemeleri. Modlu bir sunucuda, **Sürümler** alt sekmesi, modlarınızın hangi gelecekteki Minecraft sürümleri için derlemeleri olduğunu kontrol eder ([güncellemeler](/docs/updates/#minecraft-version-compatibility)).
- **Dünya**: [dünyalar, canlı harita ve dosya yöneticisi](/docs/worlds-and-files/).
- **Yedeklemeler**: bu sunucu için [anlık görüntüler ve geri yükleme](/docs/backups/).
- **İzleme**: çökme raporları dahil olmak üzere sunucu başına geçmiş ve canlı metrikler (aşağıya bakın).
- **Ayarlar**: **Yapılandırma** (sunucunun nasıl çalıştığına dair her şey), ayrıca [entegrasyonlar](/docs/integrations/) (Discord, Durum Sayfası, Davetler ve yöneticiler için Sohbet Botu).

Başlatma, durdurma ve yeniden başlatma kontrolleri her sekmenin üzerindeki başlıkta yer alır. Her sekmede ne yapabileceğiniz, o sunucudaki [izinlerinize](/docs/users-and-roles/#per-server-permissions) bağlıdır: örneğin, **Dosyalar** alt sekmesi Dosyalar iznini gerektirir ve konsol komutları göndermek Konsol iznini gerektirir.

![Sunucu genel bakışı](/docs/images/server-overview.png)

**Dünya Kontrolleri** rayı her sekmede gezinir: oyun içi saat, hava durumu, geçiş çipleri olarak yaygın oyun kuralları ve geri kalanlar için "Tüm dünya kurallarını göster".

![Dünya kontrolleri](/docs/images/world-controls.png)

**İzleme → Canlı**, TPS ve tik başına milisaniyeleri, çökmeler (son 24 saat ve 7 gün), bellek dışı ölümler ve otomatik yeniden başlatmalar içeren bir sağlık ve kararlılık kartı ve dünya başına boyutları gösterir.

![Canlı izleme](/docs/images/monitoring-live.png)

## Sunucu Ayarları

**Ayarlar → Yapılandırma**, tam yapılandırma yüzeyidir: ad, açıklama, MOTD, simge, renk ve etiketler, kaynaklar, oyun bağlantı noktası, güncelleme ilkesi, panel önyüklemesinde başlatma ve çökmede otomatik yeniden başlatma, sunucu görüntüsünün desteklediği her ortam değişkeni, gelişmiş Docker ayarları ve blueprint dışa aktarma, klonlama, yeniden oluşturma ve silme. Sunucu yeniden oluşturulduktan sonra geçerli olacak değişiklikler hemen kaydedilir ve bekler: sunucunun başlığında bir **Değişiklikleri Uygula** düğmesi görünür ve bir sonraki sunucu başladığında da uygulanırlar.

**Çökmede Otomatik Yeniden Başlatma**, çökmüş bir sunucuyu tekrar başlatır, her deneme arasında daha uzun süre bekler (5, 10, sonra 20 saniye) ve 10 dakika içinde 3 denemeden sonra durur. Kurulum sorunu olarak tanıdığı çökmeleri (EULA, yanlış Java, daha yeni bir sürümden bir dünya, kullanımda olan bir bağlantı noktası, bellek yetersizliği, eksik CurseForge anahtarı) atlar, çünkü bunlara önce bir düzeltme gerekir. Başka bir işlem sunucuyla meşgulse (bir yedekleme, bir geri yükleme, bir bağlantı noktası değişikliği), 30 dakikaya kadar bekler ve biri sunucuyu kendisi durdurduğunda veya başlattığında hemen vazgeçer.

Doğrudan ayar değişiklikleri her zaman yeniden başlatmalar boyunca kalıcı olur. **Dünya Kontrolleri** rayı ile yapılan bir PvP veya zorluk değişikliği, **Oyuncular** sekmesindeki bir beyaz liste geçişi veya **Dosyalar** düzenleyicisindeki bir `server.properties` düzenlemesi, eşleşen ortam değişkenini (ayarlanmışsa) kaldırır ve sunucuyu yeniden oluşturulacak şekilde işaretler, böylece diskteki değer bir sonraki başlangıçta konteyner görüntüsü tarafından yeniden doğrulanmak yerine kazanır.

![Sunucu ayarları](/docs/images/server-settings.png)

**Bellek ölçer hakkında.** "RAM (Java yığını)", Java'ya hem başlangıç hem de maksimum yığın olarak verilir ve Java, Aikar / MeowIce bayrak ön ayarları olsun veya olmasın, verilen bir yığını ilk dakika içinde doldurur. Bu nedenle bellek ölçer yığın boyutunun etrafında sabitlenir ve kimse oynamasa bile orada kalır; ölçerdeki tik, yığının konteyner sınırı altında nerede durduğunu işaretler ve altındaki not bunu belirtir. Belleğin gerçek kullanıma uymasını tercih ederseniz, sunucuya **Ayarlar → Yapılandırma**'daki Kaynaklar kartında (veya sihirbazdaki **Gelişmiş Seçenekler** altında) örneğin 512 MB gibi daha küçük bir başlangıç yığını verin: 2 GB'lık bir yığında bu, boşta kullanımımızı ölçümlerimizde yaklaşık 2,6 GB'tan 1,3 GB'a düşürdü. Java ayrıca yığın dışında belleğe ihtiyaç duyar (vanilla'da yaklaşık 0,5 GB, büyük bir mod paketinde 1,5 ila 2 GB), bu da konteyner sınırının fazlalığı bunun içindir. Sayılar için README'deki "İki bellek sınırı" bölümüne bakın.

> **Gelişmiş Docker Ayarları** (konteyner adı, Docker ağı, ek bağlantı noktası eşlemeleri ve ek birim bağlamaları) **yalnızca yöneticilere özeldir**, çünkü bir bağlama bağlama artı panelin Docker erişimi ana bilgisayarda etkili bir şekilde kök erişimidir. [Kullanıcılar ve roller](/docs/users-and-roles/) bölümüne bakın.

### Oyun bağlantı noktasını değiştirme

**Ayarlar → Yapılandırma**'daki **Oyun Bağlantı Noktası** kartı, bir sunucuyu istediğiniz zaman başka bir bağlantı noktasına taşır ve kendi **Bağlantı Noktasını Kaydet** düğmesi bulunur. **Sonraki Ücretsiz Bağlantı Noktasını Kullan**, en düşük ücretsiz olanı seçer ve kart, kaydetmeden önce girdiğiniz herhangi bir bağlantı noktasını kontrol eder. RCON her zaman oyun bağlantı noktasının 1000 üstünde (varsayılan ofset) takip eder. Yöneticiler 1024'ten itibaren herhangi bir bağlantı noktası seçebilir; diğer herkes ilk oyun bağlantı noktasından (varsayılan olarak 25565) başlar. Kaydetmek değişikliği hemen uygular: durdurulmuş bir sunucu sadece taşınır ve çalışan bir sunucu önce sorar, sonra yeni bağlantı noktasında yeniden başlatılır (dünya önce kaydedilir ve oyuncular yeni bağlantı noktasında yeniden bağlanır). Sunucu yeni bağlantı noktasında başlayamazsa, eskisini geri alır. Değişiklik, diğer değişiklikler **Değişiklikleri Uygula**'yı beklerken reddedilir, bu nedenle önce bunları uygulayın. Bağlantı noktasını değiştirmek, o sunucuda Ayarlar iznini gerektirir.

![Oyun Bağlantı Noktası kartı](/docs/images/server-port.png)

![Çalışan bir sunucu yeni bağlantı noktasında yeniden başlatılmadan önceki istem](/docs/images/port-restart.png)

## Çökme Raporları ve mclo.gs Analizi

Çökme raporları (`crash-reports/*.txt` ve JVM `hs_err_pid*.log` dosyaları) otomatik olarak alınır, istisna ve şüpheli modlarla tek satırlık bir özete ayrıştırılır ve **İzleme → Geçmiş** altında listelenir:

![Çökme raporu kartı](/docs/images/crash-mclogs-card.png)

Her rapor kartı yerleşik bir görüntüleyici (açılır kapanır bölümler ve vurgulanmış istisnalarla), yığın izini kopyalama ve indirme seçeneklerinin yanı sıra iki [mclo.gs](https://mclo.gs) eylemi sunar:

- **mclo.gs'ye Paylaş**, raporu herkese açık bir yapıştırma olarak yayınlar ve bağlantıyı kopyalar: mod yazarlarının ve destek Discord'larının istediği tam şey. Bağlantı raporda saklanır, bu nedenle hiçbir şey iki kez yüklenmez.
- **Analiz Et**, yapıştırma üzerinde mclo.gs'nin otomatik içgörülerini çalıştırır: önerilen düzeltmelerle bilinen sorunlar (eksik bağımlılıklar, sürüm uyumsuzlukları, yaygın mod çakışmaları), doğrudan panelde işlenir.

![mclo.gs içgörüleri](/docs/images/crash-insights.png)

Her iki eylem de açık bir onay gerektirir, çünkü bir yapıştırma herkese açıktır: çökme raporları oyuncu adlarını ve tüm mod listenizi içerebilir. Panel asla kendi başına hiçbir şey yüklemez.
