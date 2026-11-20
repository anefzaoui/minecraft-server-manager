---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: hangisi?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge veya Quilt: hangi Minecraft sunucu türünü çalıştırmalı, oyuncularınızın ne yüklediğine göre seçilir.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Dokümanlar dizinine dön](/docs/)

Oyuncuların ne kurmasını istediğinize göre seçim yapın, en hızlı neyin kulağa geldiğine göre değil.

| İstediğiniz                                                    | Bunu çalıştırın      | Oyuncular kurar |
| -------------------------------------------------------------- | -------------------- | --------------- |
| Arkadaşlarla hayatta kalma, olağandışı bir şey yok             | Vanilla              | Hiçbir şey      |
| Rütbeler, alanlar ve moderasyon içeren herkese açık bir sunucu | Paper                | Hiçbir şey      |
| CurseForge veya Modrinth'ten belirli bir mod paketi            | Ne diyorsa o         | Paket           |
| Kendiniz oluşturduğunuz modern bir mod paketi                  | Fabric veya NeoForge | Aynı modlar     |
| 1.7'den 1.12'ye kadar eski bir paket                           | Forge                | Aynı modlar     |

Bu, çoğu insan için tüm karardır. Sayfanın geri kalanı bunun nedenini açıklıyor.

## Eklentiler ve modlar aynı şey değil

Her şeyin üzerine kurulduğu ayrım budur.

**Eklentiler** yalnızca sunucuda çalışır. Paper, Spigot ve Bukkit bunları yükler. Oyuncular sıradan,
değiştirilmemiş bir istemciyle katılır ve asla bilmezler. Kurallar, izinler, ekonomiler,
alanlar, mini oyunlar veya moderasyonla ilgili her şey bir eklentidir ve bu nedenle neredeyse her herkese açık sunucu Paper çalıştırır.

**Modlar** oyunu değiştirir: yeni bloklar, yeni boyutlar, yeni makineler. İstemcinin sunucuyla aynı modları yüklemesi gerekir, aksi takdirde sunucunun ne söylediğini anlayamaz. Modlu bir sunucuya katılan herkes önce paketi yükler.

Bir sunucu anlamlı bir şekilde ikisi birden olamaz. Bir mod yükleyici üzerine bir eklenti API'si ekleyen hibrit projeler mevcuttur ve bunlar çalışır, ta ki çalışmayana kadar, genellikle en kötü anda. Her ikisine de ihtiyacınız varsa, tek bir hibrit yerine arkasında modlu bir sunucu ve bir eklenti sunucusu olan bir proxy çalıştırın.

## Eklenti tarafı

**Paper** varsayılan cevaptır. Yıllarca süren performans çalışması ve hemen hemen her davranış için bir yapılandırma dosyası içeren Spigot'un bir çatalıdır ve bu da bir yöneticiyi her zaman rahatsız etmiştir. Bukkit dönemi eklentilerinin çoğu hala çalışır.

**Purpur**, oyun içi olanlar da dahil olmak üzere daha da fazla ayara sahip Paper'ın bir çatalıdır. Bu belirli anahtarları istiyorsanız alın; aksi takdirde Paper.

**Vanilla**, değişmemiş oyunun noktası olduğunda çalışmaya değerdir. Çok sayıda oyuncuyla daha yavaştır ve izin sistemi yoktur, bu nedenle moderasyon manueldir.

Paper, performans adına varsayılan olarak bazı vanilla davranışlarını değiştirir. Bir videodaki bir redstone düzeneği sunucunuzda çalışmıyorsa, genellikle nedeni budur ve genellikle bir ayardır.

## Mod tarafı

**Fabric**, küçüktür, birkaç gün içinde yeni bir Minecraft sürümüne güncellenir ve çoğu modern performans modunu taşır. Neredeyse her Fabric modu, ayrı bir indirme olan Fabric API'yi de ister. Amacınız birkaç yaşam kalitesi moduyla hızlı bir sunucu çalıştırmaksa, bu odur.

**NeoForge**, mevcut sürümler için eski Forge ekosisteminin çalışmalarını yürüttüğü yerdir. 1.20.1 sırasında Forge'dan ayrıldı ve 1.20.2 ve sonrası için oluşturulan çoğu büyük paket bunu hedefler. Bugün yeni bir ağır hizmet paketi başlatıyorsanız, bu odur.

**Forge** hala geçmişe sahiptir. 1.7.10, 1.12.2 ve 1.16.5 dönemlerinden sevilen paketlerin büyük bir kısmı Forge'dur ve her zaman öyle olacaktır. Onlar için saklayın.

**Quilt**, çoğu Fabric modunu çalıştıran Fabric'in bir çatalıdır. İyi nedenleri vardır, ancak onu seçmek için özel bir nedeniniz yoksa, Fabric'i seçin.

Bir yükleyici için modlar diğerinde çalışmaz. Bir mod sayfasının Fabric demesi Fabric anlamına gelir.

## Bir paket yüklüyorsanız, paket karar verir

Seçmeyin. Paket, yükleyicisini ve tam Minecraft sürümünü listeler ve her ikisi de eşleşmelidir. "Yaklaşık olarak" burada bir şey değildir: 1.20.1 için bir paket 1.20.4'te çalışmaz ve 1.20.1 NeoForge paketi 1.20.1 Forge'da çalışmaz.

Modları elle seçmek yerine paketi kimliğine veya bağlantısına göre yükleyin ve sürümü sabitleyin. Paketler güncellenir ve sezon ortasında ayağınızın altına inen bir güncelleme, dünyaların bozulmasının nedenidir.

## Hangi Java sürümü

Minecraft'ın gereksinimi oyunla birlikte hareket eder ve yanlış olanı çalıştırmak, net bir mesaj yerine yararsız bir `UnsupportedClassVersionError` üretir.

| Minecraft sürümü | Java |
| ---------------- | ---- |
| 1.16.5 ve öncesi | 8    |
| 1.17             | 16   |
| 1.18 ve 1.19     | 17   |
| 1.20 - 1.20.4    | 17   |
| 1.20.5 - 1.21.x  | 21   |
| 26.1 ve sonrası  | 25   |

Eski paketler gerçekten Java 8'e ihtiyaç duyar; yazılımda en yeni sürümün yanlış olduğu birkaç yerden biri budur.

## Minecraft Server Manager'da

Oluşturma sihirbazı ne çalıştırmak istediğinizi sorar ve yukarıdaki tablodan Java sürümünü seçer, böylece yanlış eşleşme asla kazara olmaz. Vanilla, Paper ve Purpur **Vanilla** sekmesindedir; **Modlardan** sekmesi Fabric, Forge, NeoForge veya Quilt'i Minecraft sürümü ve bir yükleyici derlemesiyle (en son veya sabitlediğiniz biri) alır. CurseForge, Modrinth veya GT New Horizons'dan bir paket yüklemek, onu tam bir sürüme sabitler. Yükseltme yalnızca uyguladığınızda (veya sunucunun güncelleme politikası **Otomatik Güncelleme** ise günlük denetlemeden sonra) gerçekleşir, her zaman önce bir yedekleme alır ve geri alınabilir.

Mod tarayıcısı bir sunucunun hangi yükleyiciyi çalıştırdığını bilir ve sunduklarını buna göre filtreler, böylece bir Fabric jar'ı yanlışlıkla bir NeoForge sunucusuna giremez.

İlgili: [sunucu oluşturma ve yönetme](/docs/servers/), [mod paketleri](/docs/modpacks/),
[bir sunucunun ne kadar RAM'e ihtiyacı var](/docs/guide-server-memory/).
