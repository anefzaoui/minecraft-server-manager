---
title: "Modpack'ler"
description: 'Modpack''ler sayfası (ve oluşturma sihirbazındaki "Modpack''ten" sekmesi), bir modpack''i sunucu olarak yükler, her zaman tam bir paket sürümüne sabitlenir, böylece yeniden başlatma'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Belgeler dizinine geri dön](/docs/)

**Mod Paketleri** sayfası (ve [oluşturma sihirbazındaki](/docs/servers/) **Mod paketinden** sekmesi), bir mod paketini sunucu olarak kurar ve her zaman **tam bir paket sürümüne sabitlenir**, böylece yeniden başlatma, paketi sizden habersiz yükseltemez.

![Mod Paketleri](/docs/images/modpacks.png)

## Desteklenen platformlar

- **CurseForge** - bir paket URL'si arayın veya yapıştırın. Arama ve özel paketler için bir CurseForge API anahtarı gereklidir (Ayarlar → API anahtarları altında ekleyin).
- **Modrinth** - ada göre arayın.
- **FTB** - Feed The Beast paketleri.
- **GT New Horizons** - GTNH'nin kendi sürüm indeksinden kurulan 1.7.10 uzman paketi. GTNH, Java çalışma zamanını paket sürümüne göre seçer (2.8.0+ sürümü, paketlenmiş lwjgl3ify yamaları aracılığıyla **Java 25** üzerinde çalışır, eski sürümler Java 21 veya 17 üzerinde çalışır) ve sihirbaz, sunucunun RAM'ini ve diskini bunun için uygun minimum seviyelere yükseltir.
- **Özel zip** - hiç yayınlanmış bir paket değil: bir **CurseForge mod paketi dışa aktarımı** (CurseForge uygulamasının elle seçilmiş bir mod seti için ürettiği `manifest.json` içeren zip) veya **mod jar'larının herhangi bir zip'ini** yükleyin. Panel, manifesti CurseForge API aracılığıyla toplu olarak çözer (veya her jar'ı hash/parmak izi/meta veri ile tanımlar), neyin uygun olduğunu önizler ve her şeyi tek bir görevde kurar - isterseniz paketin `overrides/` yapılandırmaları da dahil. Yazarları otomatik indirmelere izin vermeyen modlar, kurulumu başarısız kılmak yerine bir tarayıcı bağlantısı ve manuel yükleme yuvası ile listelenir.

## Sabitleme nasıl çalışır?

Bir paket seçtiğinizde, panel tam sürümü çözer, kaydeder ve onu kurar. **Güncellemeler** sayfasında daha yeni bir sürümün mevcut olduğu size bildirilir; yükseltme, önceden yedekleme ve geri alma ile kasıtlı, korumalı bir eylemdir. Kararlı takip eden sunuculara asla beta sürümü sunulmaz.

Çok eski panel sürümlerinde (0.9.7'den önce) oluşturulan sunucular _sabitlenmemiş_ bırakılabilirdi, bu da kapsayıcı görüntüsünün her başlangıçta en yeni paket sürümünü sessizce kuracağı anlamına geliyordu. Panel şimdi bunları önyüklemede onarır: her birini gerçekten kurulu olan sürüme kilitler (panelin kendi kayıtlarından veya görüntünün kurulum manifestinden okunur, asla yeni çözülmüş "en son" değil) ve bir olay kaydeder. Ne kurulu olduğunu anlayamazsa, sunucunun Ayarlar sayfası, sürümü manuel olarak seçmenizi isteyen bir uyarı gösterir ve sabitlenmemiş bir mod paketi yapılandırmasını kaydetme girişimi tamamen reddedilir.

## Güncelleme politikası

Her sunucunun **Ayarlar** bölümünde bir güncelleme politikası vardır ve üç seçeneğin tümü söylediklerini ifade eder:

- **Yalnızca manuel** - hiçbir şey kendi başına değişmez ve sunucu güncelleme rozetinden ve Güncellemeler sayfasından tamamen çıkarılır. "Beni rahat bırak" modu: elle ayarlanmış veya içe aktarılmış, asla dokunulmasını istemediğiniz bir paket için idealdir.
- **Bana bildir** (varsayılan) - günlük kontrol, mevcut güncellemeleri bir rozet olarak ve Güncellemeler sayfasında gösterir; bunları uygulamak her zaman sizin tıklamanızla olur.
- **Otomatik güncelleme** - planlanmış günlük kontrolden sonra, bekleyen **paket** güncellemeleri, manuel yükseltmeyle aynı korumalı yol üzerinden uygulanır: güncelleme öncesi yedekleme, sağlık izleme ve yeni sürümün önyüklenememesi durumunda otomatik geri alma. Sunucuyu farklı bir Minecraft sürümüne taşıyacak güncellemeler her zaman bir olayla atlanır - bir dünyayı kalıcı olarak dönüştürmek, panelin sizin için yapmayı reddettiği bir karardır. Manuel "şimdi kontrol et" düğmeleri yalnızca kontrol eder; asla otomatik güncellemeleri tetiklemezler.

## Bir paketi yükseltme

Sabitlenmiş bir sunucudan, tek bir eylemle daha yeni bir sürüme yükseltebilirsiniz. Panel önce bir yedek alır, sabitlenmiş sürümü değiştirir, kapsayıcıyı yeniden oluşturur (yeni sürüm farklı bir çalışma zamanı gerektiriyorsa Java'yı yeniden çözer) ve ilk önyüklemeyi izler; GTNH gibi birkaç gigabayt indiren ve ilk başlangıçta birkaç yüz modlu bir dünya oluşturan büyük paketler için cömert bir pencere ile.
