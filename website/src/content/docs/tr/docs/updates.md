---
title: 'Güncellemeler'
description: 'Her sunucudaki Minecraft sürümleri, mod paketleri, modlar ve eklentiler için güncellemeleri izleyin ve uygulayın; sunucu başına bir ilke ile.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Geri belgeler dizinine](/docs/)

**Güncellemeler** sayfası, filonuzdaki güncel olmayanları tek bir yerde takip eder:

- Modrinth / CurseForge / GTNH sürüm dizinine karşı **Modpack** sürümleri ([modpackler](/docs/modpacks/)).
- Kendinizin eklediği **özel içerikler** (modlar, veri paketleri, kaynak paketleri, eklentiler), her biri kaynağına karşı: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) veya GitHub Sürümleri. GitHub aramaları ETag yeniden doğrulamasını kullanır, bu nedenle günlük kontrolleri hız sınırını zar zor zorlar.
- **Docker imajı** güncelliği: her sunucu kapsayıcısının imaj kimliği, yeni çekilmiş bir etikete karşı (aynı etiketteki sunucular arasında tekilleştirilmiş), yalnızca yeniden derleme yükseltmesi olarak sunulur.
- **Bağımsız sürüm sabitlemeleri**: yönetilen bir paket olmayan sunucu için, açık bir `mc_version` sabitlemesi Mojang'ın manifestosuna karşı ve açık bir yükleyici-derleme ortam değişkeni (`PAPER_BUILD`, `FORGE_VERSION` vb.) yükleyicinin kayıt defterine karşı. Paper derlemeleri PaperMC'nin mevcut **Fill v3 API**'sinden gelir (eski v2 uç noktası yeni Minecraft sürümlerini almaya son verdi). Modlu bir sunucuda, daha yeni bir Minecraft sürümü yalnızca bir [sürüm kontrolü](#minecraft-version-compatibility) tüm kurulu modların bunun için bir derlemesi olduğunu gösterdiğinde sunulur. Sabitlenmiş bir Forge sunucusuna Forge'un önerilen derlemesi sunulur, asla sabitlendiği derlemeden daha eski bir derleme sunulmaz ve bir sürüme sabitlenmiş bir sunucuya asla ön sürüm (zaten beta sürümünde olan birine daha yeni bir beta veya sürüm sunulabilir) sunulmaz. Bir yükleyici derlemesi uygulamak önce bir ön güncelleme yedeği alır. Bir Forge veya NeoForge sunucusunu yeni bir Minecraft sürümüne taşımak, sabitlenmiş yükleyici derleme numarasını temizler, çünkü bir derleme tek bir Minecraft sürümü için yapılır; `latest` gibi bir anahtar korunur, çünkü sürümü kendi başına takip eder. Belirli bir derlemeyi kendiniz seçmek için [mod yükleyici sürümünü değiştirmeyi](#changing-the-mod-loader-version) görün.

![Güncellemeler](/docs/images/updates.png)

## Nasıl çalışır

Panel, her sunucunun sabitlenmiş sürümlerini üst akış kaynağına karşı kontrol eder ve daha yeni sürümü olan herhangi bir şeyi listeler. Eşleşen bir sayı, [gösterge paneli](/docs/dashboard/)'nin "Güncellemeler mevcut" kutucuğunda da görünür.

Denetimler varsayılan [zamanlamada](/docs/schedules/) günlük olarak ve **Hepsini Şimdi Denetle** ile isteğe bağlı olarak çalışır. Bir satırdaki **Yoksay**, o belirli sürümü sunmayı durdurur; daha yenisi tekrar sunulur. Güncelleme **politikası** sunucu başına ayarlanır: panel her şeyi manuel bırakır (varsayılan, bu da sunucuyu bu sayfadan uzak tutar), yalnızca sizi bilgilendirir veya paket güncellemelerini kendisi uygular ([güncelleme politikası](/docs/modpacks/#update-policy)).

## Minecraft sürüm uyumluluğu

Modlarınız sizinle birlikte gelemiyorsa, daha yeni bir Minecraft sürümü bir yükseltme değildir. Her sunucunun kendi **Sürümler** sekmesi (Modlar altında) bu soruyu yanıtlar:

- Sunucunun şu anda çalıştığı sürüm ve **tüm kurulu modların bir derlemesi olduğu en yüksek sürüm**.
- Gelecekteki her Minecraft sürümü için bir adet daraltılabilir satır, kaç modun hazır olduğunu ve kaçının henüz yayınlanmadığını gösterir. Bir satırı açmak, hangi modların geride kalacağını ve hangilerinin iyi olduğunu gösterir.

![Sürüm uyumluluğu](/docs/images/server-versions.png)

**Gelecek Sürümleri Denetle** düğmesine basın. Hiçbir şey kendi kendine tarama yapmaz: bir denetim, sunucunun mod klasöründeki her jar dosyasını okur ve her biri hakkında Modrinth ve CurseForge'a sorar, bu nedenle yalnızca siz istediğinizde gerçekleşir. İlerleme ve kısmi sonuçlar ilerledikçe yazılır, bu nedenle sayfayı kapatmak veya yenilemek hiçbir şeyi kaybetmez ve panel yeniden başlatmasıyla kesilen bir denetim bunu belirtir ve tekrar çalıştırmayı teklif eder. Kesintiye uğrayan bir denetimin zaten çalıştığı her şey korunur, bu nedenle tekrar çalıştırmak bu işi tekrarlamaz.

Bir rapor yalnızca oluşturulduğu sunucuyu tanımlar. Minecraft sürümünü, yükleyiciyi veya modların kendilerini (bir tane ekleme, bir tane kaldırma, bir tane güncelleme) değiştirirseniz, rapor güncel değil olarak işaretlenir ve siz denetimi tekrar çalıştırmadığınız sürece kullanılmaz.

Modlar, varsa mod paketinin kendi dosya listesinden veya aksi takdirde dosyanın içeriğiyle, bir başlatıcının bir jar dosyasını tanıdığı şekilde tanımlanır. İki tür mod için yanıt verilemez ve hiçbiri tahmin edilmez:

- **Tanımlanamadı**: elle oluşturulmuş bir jar veya herhangi bir kayıt defterinin tanımadığı özel bir derleme.
- **Denetlenemedi**: GitHub Sürümleri, Hangar veya SpigotMC'den bir mod veya projesi kaldırılmış bir mod. Bunlar, her derlemenin hangi Minecraft sürümü için olduğunu belirten bir liste yayınlamaz.

Bunlardan biri kurulu olduğu sürece, panel tek tıklamayla Minecraft sürüm güncellemesi sunmaz, çünkü neyin bozulacağını dürüstçe söyleyemez. Modların desteklediği bir sürümün üzerine bir sürüm uygulamak reddedilir ve onu engelleyen modları adlandırır.

**Devre dışı bıraktığınız** modlar rol oynamaz: sunucu onları yüklemez, bu nedenle bir modu kapatmak bir engelleyicinin üstesinden gelmenin gerçek bir yoludur. Bir modu açmak veya kapatmak raporu yeniden denetim için işaretler.

Bu, mod çalıştıran sunucuları kapsar: Fabric, Forge, NeoForge ve Quilt. Paper tarzı eklenti sunucuları düz en yeni sürüm davranışını korur ve Sürümler sekmesine sahip değildir, çünkü eklentilerin geldiği iki kayıt defteri okunabilecek bir şey yayınlamaz.

![Açılmış bir sürüm, hangi modların geride kalacağını gösteriyor](/docs/images/server-versions-expanded.png)

Bir sürüm açmak, önce bunun için derlemesi olmayan modları (cevabı belirleyenler) listeler ve hazır olanları bir tıklama arkasında tutar. Büyük paketler sayfada bir seferde bir mod yükler, bu nedenle 300 modlu bir sunucu beş modlu bir sunucu kadar hızlı açılır.

## Mod yükleyici sürümünü değiştirme

**Sürümler** sekmesinde ayrıca bir **Yükleyici Sürümü** kartı bulunur. Sunucunun hangi Forge, NeoForge, Fabric veya Quilt derlemesini yüklediğini ve değiştirilebildiği yerlerde, başka birine geçmek için bir seçiciyi gösterir.

- **Forge, NeoForge, Fabric veya Quilt sunucusu** herhangi bir yayınlanmış derlemeyi çalıştırabilir. Seçici, sunucunun Minecraft sürümü için son derlemeleri listeler, Forge'un önerilen ve en son derlemeleri etiketlenmiştir. **Diğer Derleme…** numarasına göre herhangi bir eski derlemeyi alır ve **Varsayılan** sunucunun seçmesine izin vermeye geri döner.
- **Forge veya Fabric CurseForge mod paketi**, kendi manifestosunun belirttiği yükleyici sürümünü yükler, bu nedenle onu değiştirmenin olağan yolu paketi güncellemekdir. Paket kendisi yanlış sürümü listelerse (içindeki bir mod, paketin yüklediğinden daha yeni bir Forge isterse), kart onu geçersiz kılabilir ve **Mod Paketinin Sürümü** geçersiz kılmayı tekrar kaldırır. Paketi güncellemek de onu kaldırır, çünkü yeni sürüm kendi yükleyicisini beyan eder. Yeni sürüm hala yanlış olanı listelerse, geçersiz kılmayı tekrar ayarlayın.
- **NeoForge CurseForge mod paketi veya bir Modrinth mod paketi**, yükleyicisini gösterir ancak geçersiz kılınamaz: sunucu imajı geçersiz kılmayı yalnızca Forge ve Fabric paketleri için uygular. Yükleyicisi paket sürümünü takip eder, bu nedenle bunun yerine paketi güncelleyin. Bir FTB paketinin yükleyicisi de burada değiştirilemez. Kartı genellikle görünmez, çünkü FTB'nin kendi yükleyicisi panelin okumadığı kayıtları tutar.

Panel, size herhangi bir şey sormadan önce derlemenin mevcut olduğunu kontrol eder. Bir Forge veya NeoForge derlemesi tek bir Minecraft sürümü için yapılır, bu nedenle en yeni sürümü takip eden bir sunucuda, birini sabitlemek sunucuyu şu anda çalıştığı Minecraft sürümünde de tutar (onay bunu söyler). Sonrasında **Varsayılan** seçmek sabitlemeyi kaldırır ancak o Minecraft sürümünü tutar. En yeni sürümü takip eden bir sunucu, yeniden derlendiğinde farklı bir Java görüntüsüne de geçebilir, o sürümün gerektirdiği. Hiç başlamamış böyle bir sunucudan önce bir kez başlaması istenir, böylece panel o sürümü bilir. Forge derleme numaralarını atlar (47.4.13 ile 47.4.15 arasında 47.4.14 yoktur), bu nedenle "47.4.14 veya üstü gerektirir" diyen bir mod bir sonraki derlemeyle karşılanır ve reddetme onu adlandırır. Bir değişiklik, bir ön güncelleme yedeği alır, ardından sunucuyu yeniden derler. Yeni derleme sunucu bir sonraki başladığında yüklenir ve kart o zamana kadar bunu söyler.

## Bir mod güncellemesini geri alma

Bir modun güncellendiği her derleme paylaşılan kütüphanede kalır, bu nedenle bir şeyi bozan bir güncelleme geri alınabilir. **Modlar** sekmesindeki modun satırı, önceki derlemeyi geri yükleyen bir **Geri Al** düğmesine sahiptir. İndirme yoktur, bu nedenle proje daha sonra kayıt defterinden çekilmiş olsa bile çalışır. Geri aldığınız derleme, daha yenisi görünene kadar sunulmaz.

![Bir modu güncellendiği derlemeye geri alma](/docs/images/mods-revert.png)

## Bir güncelleme uygulama

Güncellemeler asla sessiz olmaz. Bir paketi yükseltmeyi (veya [başka bir sürüme geçirmeyi](/docs/modpacks/#changing-the-pack-version), eski sürümler dahil) seçtiğinizde, panel:

1. Bir **ön güncelleme yedeği** alır (bu nedenle geri alınabilir; varsayılan olarak sunucu başına son 10 ön güncelleme yedeği tutulur, bkz. [saklama](/docs/backups/#retention)).
2. Tam yeni sürümü yeniden sabitler.
3. Gerekirse Java çalışma zamanını yeniden çözümleyerek sunucuyu yeniden derler.
4. Platform başına bir zaman bütçesiyle ilk önyüklemeyi izler.

Sağlıklı bir şekilde başlamazsa, ön güncelleme yedeğine geri dönersiniz. Kararlı sürümü takip eden bir sunucuya asla beta sürümü sunulmaz ve değişiklik günlüğü bağlantısı, kaynak bir tane sağladığında gerçek sürüm başına farka işaret eder. Başarısız bir güncelleme, entegrasyon yapılandırılmışsa bir Discord [uyarısı](/docs/integrations/) da tetikler.
