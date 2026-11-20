---
title: "Bir Minecraft sunucusu ne kadar RAM'e ihtiyaç duyar?"
description: "Vanilla, Paper, hafif modlar ve büyük mod paketleri için bir Minecraft sunucusunun ne kadar RAM'e ihtiyacı olduğu ve makine için ne kadar bırakılması gerektiği."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Geri belgeler dizinine](/docs/)

Kısa cevap, gerçekten oynanacak bir sunucu için:

| Ne çalıştırıyorsunuz                           | Java yığını | Makineye verin |
| ---------------------------------------------- | ----------- | -------------- |
| Vanilla veya Paper, 10 oyuncuya kadar          | 2 GB        | 4 GB           |
| Eklentili Paper, 10 ila 30 oyuncu              | 4 GB        | 6 GB           |
| Hafif bir mod paketi, 40 ila 80 mod            | 4 GB        | 6 GB           |
| Büyük bir her şey dahil paket, 150 ila 300 mod | 6 ila 8 GB  | 10 GB          |
| GregTech New Horizons ve benzeri canavarlar    | 8 ila 12 GB | 16 GB          |

Tek değil, iki sayı. Çoğu rehberin atladığı kısım budur ve insanların 4 GB'lık bir sunucu alıp Java'ya 4 GB verip sonra çökmesini izlemesinin nedeni budur.

## Yığın ve makine farklı sayılardır

Java yığını (`-Xmx`), oyunun dünya, varlıklar ve mod verileri için kullanabileceği bellek miktarıdır. Makine veya kapsayıcı, bu yığının **artı** Java'nın ihtiyaç duyduğu her şeyi tutmalıdır: sınıf meta verileri, iş parçacığı yığınları, çöp toplayıcı defter tutma, ağ arabellekleri ve JVM'nin kendisi. Bu ek yük, modlu bir sunucu için kabaca 1,5 GB'dır.

Yığın makinenin belleğine eşitse, Java bu ek yüke ulaştığı anda çekirdek sunucuyu sonlandırır. Docker'da bu, 137 çıkış kodu olarak görünür ve kayıtlarda hiçbir şey olmaz: işlem cümle ortasında basitçe kaybolur. İnsanlar genellikle bir modu suçlar.

Güvenli bir kural: **yığın artı yüzde 25 ve en az bir boş gigabayt.** 8 GB'lık bir yığın 10 GB'lık bir makine ister.

## Daha fazla RAM daha fazla performans demek değildir

Minecraft, yaptığı işlerin çoğunda tek iş parçacığına bağlıdır. 40 modlu bir pakete 16 GB vermek, parçaların daha hızlı oluşturulmasını sağlamaz; her çöp toplama duraklamasını daha uzun sürdürür, çünkü yürütülecek daha çok şey vardır. Otuz saniyede bir takılan bir sunucu genellikle çok fazla yığına sahip bir sunucudur, çok az değil.

Bunları gördüğünüzde yığını artırın ve başka zaman değil:

- `java.lang.OutOfMemoryError: Java heap space` kayıtta.
- Zamanlamalarda çöp toplama duraklamalarıyla tekrarlanan "Yetişemiyorum! Sunucu aşırı yüklü mü?"
- Bellek kullanımı tavanı görüp saatlerce orada sabitlenirse.

## Neden kimse çevrimiçi değilken sunucunuz 12 GB kullanılmış gösteriyor

Çünkü siz öyle söylediniz. İki varsayılan ayar birleşir:

1. Yaygın Docker görüntüsü, başlangıç yığınını maksimuma eşit ayarlar, bu nedenle `-Xms` ve `-Xmx` ikisi de sizin sayınızdır. Java bunu büyütmek yerine baştan talep eder.
2. Popüler Aikar bayrak seti `-XX:+AlwaysPreTouch` içerir; bu, yığının her sayfasını başlangıçta yürütür, böylece sayfalar gerçekten tahsis edilir. Bu kasıtlıdır: daha yavaş bir önyükleme ve yüksek bir boşta kalma rakamı karşılığında daha sonra daha az duraklama sağlar.

Paper 1.21.1 üzerinde 4 GB'lık bir kapsayıcıda 2 GB yığın ile, dünya yüklenmeyi bitirdikten sonra üç dakika boyunca örneklenmiştir:

| Yapılandırma                                 | Yerleşik bellek |
| -------------------------------------------- | --------------- |
| Bayrak yok                                   | 2.60 GiB        |
| Aikar bayrakları                             | 2.59 GiB        |
| `AlwaysPreTouch` olmadan Aikar bayrakları    | 1.95 GiB        |
| 512 MB başlangıç yığını ile Aikar bayrakları | 1.38 GiB        |
| 512 MB başlangıç yığını ile bayrak yok       | 1.25 GiB        |

Yani boşta 12 GB "kullanan" bir sunucu genellikle önceden dokunulmuş 12 GB'lık bir yığındır, bir sızıntı değil. İzlemeniz onu doğru okuyor; sayı sadece göründüğü gibi anlam ifade etmiyor.

Dürüst bir boşta kalma rakamı istiyorsanız, başlangıç yığınını maksimumdan daha düşük ayarlayın. Bunun bedelini başlangıçta biraz daha fazla toplama yaparak ödersiniz. Düz kare süreleri tercih ederseniz, onu olduğu gibi bırakın ve grafiği izlemeyi bırakın.

## Oyuncular düşündüğünüzden daha az önemli

10'dan 20 oyuncuya iki katına çıkmak, elli mod eklemekten çok daha az maliyetlidir. Oyuncular çoğunlukla varlıklar ve yüklenen parçalar ekler, bunlar nazikçe ölçeklenir. Modlar sınıf verileri, kayıt defterleri, dünya oluşturma özellikleri ve kendi önbelleklerini ekler, bunlar ölçeklenmez. Önce paket için boyut, sonra modlu bir sunucuda düzenli oyuncu başına yaklaşık 100 ila 200 MB ekleyin.

Görüş mesafesi diğer büyük kaldıraçtır. 12'den 8 parçaya düşürmek, yoğun bir sunucuda bir gigabayt tasarruf sağlayabilir ve oyunda zar zor fark edilir.

## Minecraft Server Manager'da

Her sunucunun iki ayrı alanı vardır: **Java yığını** ve **kapsayıcı bellek sınırı**, tam olarak farklı sorular oldukları için. Oluşturma sihirbazı, kapsayıcı sınırını yığının yüzde 50 üstüne ayarlar ve panel, kapsayıcı sınırı yığınının üstünde olmayan bir sunucuyu kaydetmeyi reddeder, çünkü bu kombinasyon bir hata mesajı yerine 137 çıkış koduyla sonuçlanır.

Sunucudaki bellek ölçer, kapsayıcının gerçekte ne kullandığını gösterir ve yığının önceden talep edildiği durumlarda bir not bulunur, böylece önceden dokunulmuş bir yığın kaçak olarak okunmaz. Bellek nedeniyle çekirdek tarafından sonlandırılan bir sunucu, geçmişte gizemli bir çökme olarak değil, tam olarak bu şekilde kaydedilir.

İlgili: [sunucu oluşturma ve yönetme](/docs/servers/),
[çökme raporları](/docs/servers/#crash-reports--mclogs-analysis), [depolama ve kotalar](/docs/storage/).
