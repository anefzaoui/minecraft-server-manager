---
title: 'Minecraft sunucunuz başlamıyor'
description: 'Başlamayan bir Minecraft sunucusunu en olası sıralamaya göre düzeltin: günlük dosyası, Java sürümü, bellek, EULA ve port, ve modlar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Geri belgeler dizinine](/docs/)

Bu listeyi aşağı doğru takip edin. Her birinin cevap olma sıklığına göre sıralanmıştır ve ilk dördü
çoğunu kapsar.

## 1. İlk yirmi satırı değil, son yirmi satırı okuyun

Günlüğün **sonuna** kaydırın. Bir Java yığın izi en içten başlayarak yazdırılır, bu nedenle metin
duvarının üst kısmı en az ilginç kısımdır. İstediğiniz şey son `Caused by:` satırı ve onu takip edenlerdir.
Bu tek satır genellikle sorunu adlandırır.

Nerede olduğunuzu gösteren iki şekil vardır:

- `Exception in thread "main"` veya sondaki bir çökme raporu yolu, oyunun kendisinin başarısız
  olduğu anlamına gelir.
- Günlüğün herhangi bir istisna olmadan ortasında durması, işlemin dışarıdan öldürüldüğü anlamına
  gelir. 3. noktaya atlayın.

## 2. UnsupportedClassVersionError, yanlış Java anlamına gelir

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Sınıf dosyası 52 Java 8, 60 ise 16, 61 ise 17, 65 ise 21, 69 ise 25'tir. Mesaj, sunucunun
çalıştığına göre daha yeni bir Java'ya ihtiyaç duyduğu anlamına gelir; tersi, yeni Java'da eski bir
paket genellikle bunun yerine bir karışıklık veya yansıma hatasıyla başarısız olur.

| Minecraft sürümü | Java |
| ---------------- | ---- |
| 1.16.5 ve öncesi | 8    |
| 1.17             | 16   |
| 1.18 ve 1.19     | 17   |
| 1.20 - 1.20.4    | 17   |
| 1.20.5 - 1.21.x  | 21   |
| 26.1 ve sonrası  | 25   |

Eski paketler gerçekten Java 8 gerektirir. Burada yenisi daha iyi değildir.

## 3. Çıkış kodu 137 çekirdektir, mod değil

Günlük, cümle ortasında durur, çökme raporu yoktur ve kapsayıcı 137 bildirir. Bu, bellek
yetersizliğinden kaynaklanan bir öldürmedir: işlem, makinenin sahip olmadığı belleği istedi, bu
yüzden sonlandırıldı.

Neredeyse her zaman Java yığını, makinenin belleğiyle aynı sayıya ayarlanmıştır. Yığın, makinenin
belleği **eksi** JVM'nin kendi ek yükünü gerektirir; bu, modlu bir sunucuda 0,5 ila 1,5 GB'dir. Yığını
düşürün veya makineyi yükseltin. [Bir sunucunun ne kadar RAM'e ihtiyacı var](/docs/guide-server-memory/)
sayıları içerir.

## 4. EULA ve port

Tek satırlık düzeltmelerle iki klasik:

- `Sunucuyu çalıştırmak için EULA'yı kabul etmeniz gerekiyor.` `eula.txt` içinde `eula=true`
  ayarlayın veya kurulumunuzun kullandığı ortam değişkeniyle.
- `Adres zaten kullanılıyor` veya `PORTA BAĞLANAMADI`. Başka bir şey 25565'i tutuyor, genellikle
  tam olarak durmayan aynı sunucunun önceki bir kopyası. Portu değiştirmek yerine onu bulun ve
  durdurun, aksi takdirde ikiniz de olursunuz.

## 5. Bir mod bağımlılığını kaçırıyor

```
Mod X, eksik olan mod Y'yi gerektirir
Fabric API yüklü değil
```

Fabric modları büyük ölçüde ayrı bir dosya olarak Fabric API'ye ihtiyaç duyar. Forge ve NeoForge modları,
bağımlılıklarını hatanın kendisine listeler. En yenisini değil, adlandırılmış sürümü yükleyin:
"0.91.x gerektirir" o satır anlamına gelir ve 0.92 aynı kontrolü başarısız olur.

Bazen eksik bağımlılık yükleyicinin kendisidir:

```
Mod X forge 47.4.14 veya üstünü gerektirir
Mod Kimliği: 'forge', İsteyen: 'x', Beklenen aralık: '[47.4.14,)', Gerçek sürüm: '47.4.10'
```

Düzeltme, farklı bir mod değil, daha yeni bir yükleyici yapısıdır. "47.4.14 veya üstü" oradan
itibaren herhangi bir yapıyı ifade eder ve Forge her sayıyı yayınlamaz, bu nedenle kurulacak yapı
bir sonraki olabilir. Bir mod paketinde, önce paketi güncelleyin: kendi yükleyici sürümü
modları için çok eski olan bir paket, yazarının düzeltmesi gereken bir hatadır.

## 6. Bir mod yanlış yükleyici veya sürüm için

Farklı bir yükleyici için bir jar, nazikçe başarısız olmaz. Bir karışıklık hatası, bir
`NoClassDefFoundError` veya hiç duymadığınız bir sınıftaki bir çökme bekleyin. Jar'ın sayfasına
bakın: hem yükleyici hem de Minecraft sürümü tam olarak eşleşmelidir. Modlar söz konusu olduğunda
1.20.1 ve 1.20.4 farklı oyunlardır.

## 7. Dünya daha yeni bir sürüme ait

```
Bu dünya Minecraft'ın daha yeni bir sürümü tarafından oluşturuldu
```

Dünyalar ileriye doğru yükseltilir ve asla geriye doğru değil. Yükseltmeden önceki yedekten
geri yükleyin veya dünyanın beklediği sürümü çalıştırın. Parçaları sağlam tutan bir geri
dönüştürme yolu yoktur.

## Haftalarca sorunsuz çalıştıktan sonra çöktüğünde

Farklı soru, genellikle farklı cevap:

- **Yük altında çöktü**, zamanlamalar uzun duraklamalar gösteriyor: çöp toplama, bu yüzden
  modlardan önce yığın boyutuna bakın.
- **Dünyanın aynı noktasında çöktü**: bozuk bir parça veya kırık bir varlık. Çökme raporu
  genellikle koordinatları adlandırır.
- **Güncellemeden hemen sonra çöktü**: iz başka yere işaret etse bile güncellenen mod
  şüphelidir. Geri alın ve görün.
- **Daha önce iyi olmasına rağmen yeniden başlatmada çöktü**: diski kontrol edin. Dolu bir disk
  görkemli ve yanıltıcı hatalar üretir.

## Gerçekten yardımcı olan yardım almak

**Tüm günlüğü** yapıştırın, son satırı değil ve bozulmadan önce neyi değiştirdiğinizi söyleyin.
Bunun yerine sohbet yerine [mclo.gs](https://mclo.gs) gibi bunun için tasarlanmış bir yere yapıştırın.
Minecraft sürümünü, yükleyiciyi, paketi ve sürümünü ve sunucunun ne kadar yığını olduğunu ekleyin.
Bu dört gerçeği içeren bir rapor tek bir yanıtta cevaplanır; onlarsız beş sürer.

## Minecraft Server Manager'da

Kapsayıcının kendi çıkışından çökmeler tespit edilir, bu nedenle sabah üçte ölen bir sunucu, ertesi
gün bulunmak yerine günlük alıntısıyla kaydedilir. Bu sayfadaki olağan şüpheliler (EULA, yanlış
Java, daha yeni bir sürüme ait bir dünya, zaten kullanılan bir port, belleği tükenen Java) o günlükte
tanınır ve ne yapacakları ile birlikte geçmiş girişinde adlandırılır ve otomatik yeniden
başlatma bunlara dokunmaz, çünkü yeniden başlatma bunları düzeltmez. Çökme raporları varışta
ayrıştırılır: istisna vurgulanır, yığın daraltılabilir ve izde görünen modlar şüpheli olarak
listelenir.

Yardıma ihtiyacınız olduğunda herhangi bir rapor, kartından mclo.gs'ye paylaşılabilir (yapıştırmanın
kamuya açık olduğu için bir onaydan sonra) ve konsolun **İndir** menüsünde tüm günlük dosyaları tek
bir zip olarak bulunur, bu nedenle "tüm günlüğü yapıştırın" bir arkeoloji projesi yerine bir
indirmedir. Bellek yetersizliğinden kaynaklanan bir öldürme, olağan bir saatlik mod suçlamasını
kaydeden bir bellek yetersizliği öldürmesi olarak kaydedilir. Gerçekten porta ihtiyaç duyan başka
bir şey varsa, **Ayarlar → Yapılandırma**'daki **Oyun Portu** kartı sunucuyu boş bir porta taşır.

Çok eski bir yükleyici, sunucunun **Sürümler** sekmesinden değiştirilir; bu, yapının mevcut
olduğunu kontrol eder ve sunucuyu yeniden oluşturmadan önce bir yedek alır ([mod yükleyici
sürümünü değiştirmek](/docs/updates/#changing-the-mod-loader-version)).

İlgili: [bir sunucunun ne kadar RAM'e ihtiyacı var](/docs/guide-server-memory/), [yükleyici seçimi](/docs/guide-choosing-a-loader/),
[sunucu oluşturma ve yönetme](/docs/servers/).
