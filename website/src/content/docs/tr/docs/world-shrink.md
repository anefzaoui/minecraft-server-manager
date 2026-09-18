---
title: 'Bir dünyayı küçültme'
description: 'Zamanla bir dünya yayılır: bir oyuncunun yürüdüğü, uçtuğu veya'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Dokümanlar dizinine dön](/docs/)

Zamanla bir dünya genişler: bir oyuncunun yürüdüğü, uçtuğu veya Ender inci ile taşındığı her yer, kimse geri dönmese bile diskte oluşturulmuş parçalar bırakır. **Dünyayı daralt**, çok az kişinin zaman geçirdiği parçaları kaldırır, böylece dünya daha az yer kaplar. Minecraft, birisi tekrar oraya seyahat ettiğinde kaldırılan alanı dünya tohumundan yeniden oluşturur, bu nedenle kullanılmayan araziler için güvenlidir, ancak bir oyuncunun zar zor durduğu bir noktada _inşa ettiği_ her şey de gider, bu yüzden önce bir yedek almalısınız (yedek geri almadır).

## "Nadir ziyaret edilen" ne anlama gelir?

Her parça, oyuncuların içinde ne kadar süre durduğunu kaydeder (Minecraft buna `InhabitedTime` der). Dünyayı daralt, varsayılan olarak toplam oyuncu süresi **30 saniyenin altında** olan tüm parçaları kaldırır; daraltma iletişim kutusu bu eşiği (1 saniyeden 1 saate kadar) ve spawn etrafında kaç parça tutulacağını (varsayılan 8, `0` spawn korumasını kapatır) değiştirmenize olanak tanır.

Her zaman saklananlar:

- Dünyanın **spawn noktası** çevresindeki alan ( `level.dat` 'dan okunur) overworld'de. Nether, End ve özel boyutların bir spawn alanı yoktur.
- Ziyaret süresi okunamayan herhangi bir parça, örneğin panelin çözemediği bir sıkıştırma formatıyla (LZ4) kaydedilmiş bir dünya. Önizleme ve sonuç, kaç tane bu tür parçanın atlandığını söyler.

Dünyanın her boyutu kapsanır: Bukkit tarzı kardeş klasörler (`world_nether`, `world_the_end`) ile vanilla ve Forge/Fabric düzeni (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Bir parça kaldırıldığında, varlıkları ve köylü ilgi noktaları da onunla birlikte gider, böylece yeniden oluşturulan bir parça eski mobları, maden arabalarını veya iş alanlarını devralmaz.

## Dünyalar sekmesinden yapmak

1. **Yedekler** sekmesinden bir yedek alın. Dünyalar sekmesinden daraltmak sizin için yedek almaz.
2. **Dünya → Dünyalar**'ı açın, dünyayı bulun ve daralt simgesine tıklayın.
3. Kaldırılacak yaklaşık parça sayısını (ve kaç megabayt) görmek için **Önizleme**'ye tıklayın. Henüz hiçbir şey değiştirilmedi; sunucu çalışırken önizleme çalışır.
4. **Dünyayı Daralt**'a tıklayın. Daraltma dünya dosyalarını doğrudan düzenler, bu nedenle sunucu durdurulmalıdır: ya önce durdurun ya da durdurma, daraltma ve tekrar başlatma seçeneğini tek seferde işaretleyin (daraltma başarısız olsa bile sunucu yeniden başlatılır). Görev çubuğunda ilerleme gösterilir.

![Dünyayı daralt](/docs/images/world-shrink.png)

## Yedeklemenin bir parçası olarak yapmak

**Yedekler** sekmesinde, **Şimdi Yedekle**'den önce **"Sonrasında dünyayı da daralt"** seçeneğini işaretleyin. Yedek arşiv önce yazılır (bu arşiv sizin geri almanızdır), ardından sunucu durdurulursa dünya daraltılır. Sunucu çalışıyorsa, yedekleme hala çalışır ve daraltma bir notla atlanır.

Zamanlanmış yedeklemeler de aynı seçeneğe sahiptir: zamanlama düzenleyicisinde, **Yedekle** görevini seçin ve **"Her yedekten sonra dünyayı daralt"** seçeneğini işaretleyin. Otomatik olarak çalışmasını istiyorsanız, birkaç dakika öncesine bir **Sunucuyu Durdur** zamanlamasıyla eşleştirin.
