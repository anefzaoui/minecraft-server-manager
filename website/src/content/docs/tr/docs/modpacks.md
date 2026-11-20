---
title: 'Mod Paketleri'
description: 'CurseForge, Modrinth, FTB ve GT New Horizons mod paketlerini sunucular olarak kurun, her zaman tam bir paket sürümüne sabitlenmiş.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Geri belgeler dizinine](/docs/)

**Modpackler** sayfası (ve [oluşturma sihirbazındaki](/docs/servers/) **Modpack'ten** sekmesi), bir modpack'i sunucu olarak yükler; bu, her zaman **tam bir paket sürümüne sabitlenmiş** durumdadır, böylece yeniden başlatma sizi sessizce yükseltilmiş bir paketle baş başa bırakamaz.

![Modpackler](/docs/images/modpacks.png)

## Desteklenen platformlar

- **CurseForge**: Ada göre arama yapın. Bir CurseForge API anahtarı gerektirir (**Ayarlar → API Anahtarları** altında ekleyin).
- **Modrinth**: Ada göre arama yapın.
- **FTB**: Feed The Beast paketleri, yalnızca API aracılığıyla (sayısal bir paket kimliği artı açık bir sürüm kimliği). Panel henüz FTB paketlerini güncellemeler için kontrol etmiyor.
- **GT New Horizons**: 1.7.10 uzman paketi, GTNH'nin kendi sürüm dizininden yüklenir. GTNH, Java çalışma zamanını paket sürümüne göre seçer (2.8.0+ paketlenmiş lwjgl3ify yamaları aracılığıyla **Java 25** üzerinde çalışır, eski sürümler Java 21 veya 17 üzerinde çalışır) ve sihirbaz sunucunun RAM ve diskini bunun için makul minimumlara yükseltir.
- **Özel zip**: Hiç yayınlanmış bir paket değil. **CurseForge modpack dışa aktarma** (CurseForge'un uygulaması tarafından seçilmiş bir mod kümesi için üretilen `manifest.json` içeren zip), bir **Modrinth `.mrpack`** veya **mod jar'larının herhangi bir zip'ini** yükleyin. Panel, manifest'i toplu olarak çözer (veya her jar'ı karma/parmak izi/meta veri ile tanımlar), uygun olanları önizler ve paketin `overrides/` yapılandırmaları dahil her şeyi tek bir görevde yükler. Yazarlarının otomatik indirmelere izin vermediği modlar, yüklemeyi başarısız kılmak yerine bir tarayıcı bağlantısı ve manuel yükleme yuvasıyla listelenir.

## Sabitleme nasıl çalışır

Bir paket seçtiğinizde, panel tam sürümü çözer, kaydeder ve onu yükler. **Güncellemeler** sayfasında daha yeni bir sürümün ne zaman mevcut olduğu size bildirilir (sunucunun [güncelleme ilkesi](#update-policy) **Yalnızca Manuel** değilse); yükseltme, önceden bir yedekleme ve geri alma ile kasıtlı, korumalı bir eylemdir. Kararlı izleme sunucularına asla beta sürümü sunulmaz. Bir sunucunun kendi **Sürümler** sekmesi sorunun diğer yarısını yanıtlar: sahip olduğu modların hangi gelecekteki Minecraft sürümlerini takip edebileceği ([güncellemeler](/docs/updates/#minecraft-version-compatibility)).

Mod yükleyici sürümü de paketle birlikte gelir: sunucu, paketin belirttiği Forge, NeoForge veya Fabric sürümünü yükler. Bir Forge veya Fabric CurseForge paketi, kendi modları için çok eski bir sürüm belirtirse, paket düzeltilene kadar **Sürümler** sekmesi bunu geçersiz kılabilir; paket güncellemesi geçersiz kılmayı kaldırır, çünkü yeni sürüm kendi sürümünü belirtir ([mod yükleyici sürümünü değiştirmek](/docs/updates/#changing-the-mod-loader-version)).

Çok eski panel sürümlerinde (0.9.7 öncesi) oluşturulan sunucular _sabitlenmemiş_ bırakılabilirdi, bu da kapsayıcı görüntüsünün her başlatmada en yeni paket sürümünü sessizce yükleyeceği anlamına gelir. Panel şimdi bunları önyüklemede onarır: her birini gerçekten yüklenmiş olan sürüme sabitler (panelin kendi kayıtlarından veya görüntünün yükleme manifestinden okunur, asla yeni çözülmüş "en son" değil) ve bir olay günlüğü kaydeder. Yüklü olanı belirleyemezse, sunucunun Ayarlar sayfası bir uyarı ve **Bir Sürüm Seç…** düğmesi (CurseForge, Modrinth ve GTNH paketleri) gösterir ve bu da [sürüm seçiciyi](#changing-the-pack-version) açar ve sabitlenmemiş bir modpack yapılandırmasını kaydetme girişimi tamamen reddedilir.

## Güncelleme ilkesi

Her sunucunun **Ayarlar → Yapılandırma** sekmesinde bir **Güncelleme İlkesi** kartı vardır ve üç seçenek de söylendiği gibi anlamı taşır:

- **Yalnızca Manuel** (varsayılan): hiçbir şey kendi kendine değişmez ve sunucu güncelleme rozetinden ve Güncellemeler sayfasından tamamen çıkarılır. "Beni rahat bırak" modu: asla dokunulmasını istemediğiniz el ile ayarlanmış veya içe aktarılmış bir paket için idealdir. Sürümü kilitlemez: [**Sürüm Değiştir…**](#changing-the-pack-version) her ilke altında çalışır. Yeni sürümler hakkında bilgi almak ve bunları tek bir tıklamayla uygulamak için **Beni Bilgilendir** seçeneğini belirleyin.
- **Beni Bilgilendir**: günlük kontrol, mevcut güncellemeleri bir rozet olarak ve Güncellemeler sayfasında gösterir; bunları uygulamak her zaman sizin tıklamanızdır.
- **Otomatik Güncelleme**: planlanmış günlük kontrolden sonra, bekleyen **paket** güncellemeleri, manuel bir yükseltme ile aynı korumalı yoldan uygulanır: güncelleme öncesi yedekleme, sağlık izleme ve yeni sürüm önyüklenemezse otomatik bir geri alma. Sunucuyu farklı bir Minecraft sürümüne taşıyacak güncellemeler her zaman bir olayla atlanır: bir dünyayı kalıcı olarak dönüştürmek, panelin sizin için yapmayı reddettiği bir karardır. Manuel **Şimdi Kontrol Et** düğmeleri yalnızca kontrol eder; otomatik güncellemeleri tetiklemezler.

## Bir paketi yükseltme

Sabitlenmiş bir sunucudan tek bir eylemle daha yeni bir sürüme yükseltebilirsiniz. Panel önce bir yedekleme alır, sabitlenmiş sürümü değiştirir, sunucuyu yeniden oluşturur (yeni sürüm farklı bir çalışma zamanı gerektiriyorsa Java'yı yeniden çözer) ve ilk önyüklemeyi izler; GTNH gibi birkaç gigabayt indiren ve ilk başlangıçta birkaç yüz modluk bir dünya oluşturan büyük paketler için cömert bir pencere sunar.

## Paket sürümünü değiştirme

Belirli bir sürümü, daha yeni veya daha eski, çalıştırmak için sunucunun **Genel Bakış** sekmesindeki paket kartındaki **Sürüm Değiştir…** seçeneğini kullanın. **Modpackler** sayfasında, yüklenmiş bir paketin kartını açmak aynı seçeneği sunar: açılır menüden bir sürüm seçin ve **Buna Geç** düğmesine tıklayın. Her ikisi de sunucunun **İçerik** iznini gerektirir ve her ikisi de CurseForge, Modrinth ve GTNH paketleri için kullanılabilir (FTB paketlerinin henüz bir sürüm listesi yok). Liste, CurseForge ve Modrinth için en yeni 25 sürümü ve her GTNH sürümünü gösterir.

Geçiş, yükseltme ile aynı korumalı yoldan geçer: güncelleme öncesi yedekleme, yeni sabitleme, yeniden oluşturma ve izlenen ilk önyükleme, sunucu sağlıklı gelmezse tek tıklamayla geri alma ile. Özel modlarınız, devre dışı bıraktığınız paket modları ve paketin diğer yükleme ayarları (zorla eklenen modlar, göz ardı edilecek dosyalar, ek projeler) korunur. Farklı bir paket yüklemek bu ayarları sıfırlar, çünkü bunlar yalnızca oluşturuldukları paket için anlamlıdır.

Her sürüm, çalıştığı Minecraft sürümüyle birlikte listelenir ve son kaydeden dünya sürümünüzle karşılaştırılır:

- **Aynı Minecraft sürümü**: normal bir onaydan sonra geçiş yapın. Eski bir paket sürümüne geri dönmek, o sürümde olmayan modlardan blokları ve öğeleri düşürebilir, bu nedenle yedekleme her iki durumda da Yedekler sekmesinde kalır.
- **Daha yeni Minecraft sürümü**: dünyanın kalıcı olarak dönüştürüldüğü konusunda uyaran bir onaydan sonra izin verilir. Alınan ilk yedekleme, eski dünyaya geri dönmenin tek yoludur.
- **Eski Minecraft sürümü**: kullanılamaz. Minecraft, son kaydeden sürümden daha eski bir sürümde bir dünyayı yükleyemez, bu nedenle panel önyüklemede çöken bir sunucu bırakmak yerine reddeder.
