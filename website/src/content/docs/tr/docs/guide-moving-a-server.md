---
title: 'Bir Minecraft sunucusunu başka bir barındırma ortamına taşıma'
description: 'Bir dünyayı taşımak kolaydır. Oyuncuların hala giriş yapabildiği, envanterleri, evleri ve izinleri bozulmadan kalan bir sunucuyu taşımak ise işlerin ters gittiği kısımdır.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Geri belgeler dizinine](/docs/)

Bir dünyayı taşımak kolaydır. Oyuncuların hala giriş yapabildiği, envanterleri, evleri ve izinleri
bozulmadan bir sunucuyu taşımak ise işlerin ters gittiği kısımdır. Aşağıdaki sıra, kesinti süresini
birkaç dakikaya indirir ve yeni makine hayal kırıklığı yaratırsa geri dönüş yolu sağlar.

## Önce durumu değerlendirin

Herhangi bir şeye dokunmadan önce bunları not alın. Kontrol edilmek yerine varsayıldığında, bunların
her biri bir taşıma işlemini kötü bir şekilde sonlandırmıştır:

- **Minecraft sürümü ve yükleyicisi**, tam olarak. 1.20.1 NeoForge, 1.20.1 Forge değildir.
- **Sürümleriyle birlikte mod veya eklenti listesi.** Dünyayı oluşturan modlar olmadan dünya yüklenmez.
- **Java sürümü**, Minecraft sürümünü takip eder.
- **`server.properties` dosyasındaki `level-name`**. Dünya klasörü genellikle `world` olarak adlandırılmaz.
- **Çevrimiçi mod.** Eski sunucu `online-mode=false` ile çalışıyor ve yeni sunucu açıkken çalışıyorsa
  veya tersi durumda, her oyuncu farklı bir UUID alır ve dolayısıyla yepyeni, boş bir envantere sahip olur.
  Bu, bu sayfadaki en acı verici hatadır.
- **Sunucu klasörünün dışında yaşayan herhangi bir şey**, örneğin bir eklentinin MySQL veritabanı.

## Çalışırken kopyalayın, sonra durdurulmuşken tekrar kopyalayın

Kısa kesinti süresinin sırrı, yavaş kopyalamayı ilk yapmaktır.

1. **Sunucu çalışırken**, tüm sunucu dizinini yeni makineye kopyalayın. Büyük bir dünyada bu bir saat
   sürebilir; kimse fark etmez çünkü hiçbir şey durmamıştır.
2. **Yeniden başlatma duyurusu yapın, ardından sunucuyu düzgün bir şekilde durdurun.** Nazik bir duruş,
   oyunun dünyayı temizlemesini sağlar; işlemi sonlandırmak bunu yapmaz.
3. **Tekrar kopyalayın.** Bu sefer yalnızca değişen dosyalar taşınır, bu nedenle saniyeler ila dakikalar
   sürer.
4. **Yeni makinede başlatın**, mümkünse halka açık olmayan bir bağlantı noktasında ve kendiniz bağlanın.
   Bildiginiz bir üssü, kendi envanterinizi kontrol edin ve eklentilerin veya modların hatasız yüklendiğinden
   emin olun.
5. **Ardından** oyuncuları ona yönlendirin.

`rsync -a --delete` genellikle 1. ve 3. adımlar için kullanılan araçtır. İzinleri ve zaman damgalarını
koruyun: yanlış kullanıcı olarak kopyalanan bir dünya, başlamayacak bir sunucudur ve hata bunu açıkça
belirtmez.

## Eski olanı henüz silmeyin

Eski makineyi en az birkaç gün boyunca durdurulmuş ancak sağlam tutun. Gerçek tek geri alma budur.
Yanlışlıkla terk edilmiş kopyaya katılmalarını ve orada bir hafta boyunca inşa etmelerini önlemek için
çalışır durumda yerine kapalı tutun.

## Taşıma sırasında adresin hayatta kalmasını sağlayın

Oyuncular çıplak bir IP adresine bağlanırsa, her taşıma her oyuncuyu sunucu listelerini düzenlemeye
zorlar ve bazıları bunu asla yapmaz.

Sunucuyu işaret eden, kontrolünüzdeki bir ana bilgisayar adı kullanın. Taşıma o zaman bir DNS değişikliği
halini alır ve herkesin istemcisindeki adres aynı kalır. Değişikliğin hızla yayılması için taşıma işleminden
bir gün önce kaydın yaşam süresini (TTL) düşürün.

Oyuncuların standart olmayan bir bağlantı noktasında çalışan sunucuya çıplak bir alan adı yazmasını
istiyorsanız, bir SRV kaydı bunu yapar. Ticari barındırıcıların `play.something.net` dağıtmak için
kullandığı mekanizmadır.

## Yeni makineyi güvenmeden önce kontrol edin

Taşındıktan sonra sorun çıkaran, ana bilgisayarlar arasında farklılık gösteren üç şey:

- **Güvenlik duvarı.** Oyun bağlantı noktanız açık olmalı ve yalnızca oyun bağlantı noktanız.
  localhost'ta çalıştığı için bir yönetim paneli veya haritayı internete maruz bırakmayın.
- **Tek çekirdek hızı.** Minecraft, kaç çekirdek olduğundan çok bir çekirdeğin ne kadar hızlı
  olduğuna çok daha fazla önem verir. Sekiz yavaş çekirdek, ikiden hızlı olanlardan daha kötü hissettirir.
- **Disk.** Dönüşümlü depolama veya yoğun paylaşımlı bir birimdeki dünya, parça yükleme sırasında
  takılacaktır.

## Yönetilen bir panelden ayrılma

Size bir makine yerine bir kontrol paneli veren bir barındırıcıdan geliyorsanız, indirme veya dosya
yöneticisini bulun ve yalnızca dünyayı değil, tüm sunucu dizinini alın. Eklenti ve mod jar'larının
kendilerini alın, bir listesini değil: sürümler önemlidir ve "en son" gelecek ay farklı bir dosya olur.

Yedeklerinizin de size ait olduğundan emin olun. Ayrıldığınız panelin içinde var olan bir yedek,
sahip olduğunuz bir yedek değildir.

## Minecraft Server Manager'da

Tüm panel tek bir dizindir. Bunu başka bir makineye kopyalamak ve paneli orada başlatmak, her sunucuyu,
dünyayı, yedeği ve ayarı beraberinde getirir, bu da panelin kendisini taşıma yerine kopyalama haline
getirir.

Hepsi yerine tek bir sunucu için, bir şablon, yapılandırmasını, mod setini ve sabitlenmiş paket sürümünü
(ve işaretlerseniz, aktif dünyayı) başka bir panelde aynı sunucuyu yeniden oluşturmak için içe aktarılabilen
tek bir `.mcserver.zip` dosyası olarak yakalar. Yalnızca dünya seyahat etmesi gerektiğinde dünyalar
ayrı ayrı indirilebilir ve kurulabilir.

Bir sunucunun kullandığı oyun bağlantı noktası yeni makinede zaten doluysa veya önce halka açık olmayan
bir bağlantı noktasında test etmek istiyorsanız, bunu **Ayarlar → Yapılandırma**'da değiştirin:
**Oyun Bağlantı Noktası** kartında **Sonraki Boş Bağlantı Noktasını Kullan** bulunur, çalışan bir sunucu
yeni bağlantı noktasında yeniden başlatılmadan önce sorar ve orada başlayamazsa eskisini geri alır. Oyuncuları
ona yönlendirdiğinizde halka açık bağlantı noktasına geçirin.

İlgili: [şablonlar](/docs/blueprints/), [gerçekten geri yüklenen yedekler](/docs/guide-backups/),
[dünyalar ve dosyalar](/docs/worlds-and-files/).
