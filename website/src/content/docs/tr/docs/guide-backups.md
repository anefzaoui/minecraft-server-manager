---
title: 'Gerçekten geri yüklenebilen Minecraft sunucu yedeklemeleri'
description: 'Gerçekten geri yüklenebilen Minecraft sunucu yedeklemeleri nasıl yapılır: tutarlı kopyalar, başka bir yerde saklanan ve en az bir kez test edilen yedeklemeler.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Dokümanlar dizinine dön](/docs/)

Çoğu sunucunun yedeği vardır. Çalışan yedekleri olanların sayısı ise oldukça azdır ve aradaki fark ancak en kötü günde ortaya çıkar. Bunları ayıran üç şey vardır: kopyanın tutarlı olması, başka bir yerde saklanması ve birisinin en az bir kez geri yükleme yapmış olması.

## Dünya yazılırken kopyalamayın

Çalışan bir sunucu, bölge dosyalarını sürekli olarak yazar. Yazma işlemi ortasındayken kopyalarsanız, yarısı eski yarısı yeni bir dosya elde edersiniz; bu dosya ya yüklenemez ya da birisinin üssünün bulunduğu yerde bir delikle yüklenir. Kopyalama başarılı olduğu için sizi uyaran hiçbir şey olmaz.

Kopyalama yapmanın iki doğru yolu vardır:

1.  **Sunucuyu durdurun**, kopyalayın, tekrar başlatın. Basit, dürüst ve kesinti süresi nedeniyle sevilmeyen bir yöntem.
2.  **Oyuna önce yazmayı durdurmasını söyleyin.** `save-off` komutunu çalıştırın, ardından `save-all flush` komutunu çalıştırın, bitmesini bekleyin, kopyalayın, sonra `save-on` komutunu çalıştırın. Dünya, kopyalama süresi boyunca eksiksiz ve sessizdir.

Asla doğrudan kopyalamaya geçmeyin. Dosya sistemi veya birim düzeyinde bir anlık görüntü yalnızca gerçekten atomikse iyidir ve oyuncular blok yerleştirirken `cp -r` komutu atomik değildir.

## Dünyadan fazlasını yedekleyin

Yalnızca dünyayı geri yüklemek araziyi elde etmenizi sağlar ancak sunucuyu kaybedersiniz. Ayrıca şunlara da ihtiyacınız vardır:

- `server.properties` ve kuralları belirleyen diğer her şey.
- Çalışan sürümlerindeki mod veya eklenti jar dosyaları. Dünya, bloklarını oluşturan modlar olmadan yüklenmez.
- `whitelist.json`, `ops.json` ve istatistikler ile başarılar klasörleri dahil oyuncu verileri.
- Paketten geldiyse paket sürümü. Bunu not almak yeterlidir.

Herhangi bir yedeğin en hızlı mantık kontrolü: yalnızca arşivden bu sunucuyu yeni bir makinede yeniden oluşturabilir misiniz? Cevap "ve sonra yeniden yükleyeceğim" ile başlayan bir cümle gerektiriyorsa, bu eksiksiz bir yedek değildir.

## Aynı diskteki bir kopya yedek değildir

Koruduğu makinede bulunan bir yedek, yalnızca bir hatayı kapsar: bir şeyi sildiniz. Diskin arızalanmasını, sağlayıcının hesabı askıya almasını veya tüm dizini silen bir hatayı kapsamaz.

Mükemmel olmaktansa basit tutun:

- Yaygın durum olan birinin zarar vermesi veya kötü bir güncelleme için bir yerel kopya.
- Başka bir yerde bir kopya. Başka bir makine, bir nesne deposu veya SSH üzerinden gece geç saatte çekim yapan bir ev NAS'ı.
- Hemen fark etmediğiniz bir sorundan kurtulmak için yeterli geçmiş. Bozulmalar genellikle günler sonra bulunur ve üç günlük yedekleri tutuyorsanız, iyi olanı zaten üzerine yazmış olursunuz.

Yedi günlük yedek artı dört haftalık yedek, neredeyse her gerçek olayı kapsar ve çok az yer kaplar.

## Geri yüklemeyi ihtiyacınız olmadan önce test edin

Bir yedek seçin, onu boş bir sunucuya geri yükleyin ve bağlanın. Tüm test budur, on beş dakika sürer ve tüm klasik hataları yakalar: arşivin mod klasörünü kaçırması, artık çalıştırmadığınız bir sürüm gerektiren bir dünya, dosyaları okunamaz hale getiren izinler, bozuk bir yükleme.

Yedekleri ayarlarken bir kez ve sunucuda büyük bir değişiklik yaptıktan sonra bir kez daha yapın.

## Boyut ve onu nasıl makul tutmalı

Oyuncular keşfettikçe dünyalar büyür. Birinin düz bir çizgide on bin blok uçtuğu bir dünya, o çizgi boyunca her bölgeyi sonsuza dek taşır ve bu bölgelerin çoğu asla tekrar ziyaret edilmez.

Üç kaldıraç, ne kadar geri verdiklerine göre sıralanmıştır:

1.  **Ziyaret edilmeyen bölgeleri temizleyin.** Son dokunulan zamana göre budama yapan araçlar, iyi seyahat edilmiş bir dünyanın büyük bir bölümünü görünür bir etki olmadan kaldırır.
2.  **Düzgün sıkıştırın.** Bölge dosyaları iyi sıkıştırılır; bunların arşivleri egzotik bir şeyden fayda sağlamaz.
3.  **Bir yıl boyunca her saatlik kopyayı saklamayın.** Saklama, sıkıştırmadan daha önemlidir.

## Minecraft Server Manager'da

Yedeklemeler `save-off`, flush, copy, `save-on` yolunu izler ve yedekleme ortasında istenen bir durdurma veya yeniden başlatma, onunla yarışmak yerine kopyanın bitmesini bekler. Arşiv, tüm sunucu dizinini kapsar, bu nedenle modlar, yapılandırma ve oyuncu verileri dünya ile birlikte taşınır.

Yedeklemeler, yeniden başlatmalar ve komutlarla birlikte bir programa göre çalışabilir ve her yeni sunucu günlük bir yedekleme programıyla başlar. Saklama, her türü ayrı ayrı sayar, bu nedenle kendi kendine biriken on zamanlanmış kopya, riskli bir değişiklikten önce elinizle aldığınız kopyayı dışarı itemez ve bunların üzerine yaş ve boyut sınırları uygulanır. Yöneticiler bunların tümünü Ayarlar sayfasında veya sunucu bazında Yedekler sekmesinde değiştirir. Geri yükleme önce yeni bir yedek alır, bu nedenle yanlış zaman noktasına geri yükleme kendi başına geri alınabilir. Bir dünya kendi başına veya bir yedeklemenin parçası olarak küçültülebilir, bu da boyut için en önemli kaldıraçtır.

Tüm panel, her yedekleme dahil, tek bir dizin altında yaşar. Bu dizini başka bir yere kopyalamak, makine dışı hikayenin yarısıdır ve kasıtlı olarak kopyalamanız gereken tek şey budur.

İlgili: [paneldeki yedeklemeler](/docs/backups/), [zamanlamalar](/docs/schedules/), [bir dünyayı küçültme](/docs/world-shrink/), [bir sunucuyu başka bir ana bilgisayara taşıma](/docs/guide-moving-a-server/).
