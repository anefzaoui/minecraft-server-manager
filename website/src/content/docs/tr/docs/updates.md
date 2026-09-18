---
title: 'Güncellemeler'
description: 'Güncellemeler sayfası, filonuzdaki güncel olmayanları tek bir yerde takip eder:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Dokümanlar dizinine dön](/docs/)

**Güncellemeler** sayfası, filonuzdaki güncel olmayan her şeyi tek bir yerde takip eder:

- Modrinth / CurseForge / GTNH sürüm dizinine karşı **Modpack** sürümleri ([modpackler](/docs/modpacks/)).
- Kendiniz eklediğiniz **özel içerikler** - modlar, datapackler, kaynak paketleri, eklentiler - her biri kaynağına karşı: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) veya GitHub Releases. GitHub aramaları ETag yeniden doğrulama kullanır, bu nedenle günlük kontrolleri hız sınırını zar zor zorlar.
- **Docker imajı** güncelliği: Çalışan her kapsayıcının imaj kimliği, yeni çekilmiş bir etikete karşı (aynı etiketteki sunucular arasında tekilleştirilmiş), yalnızca yeniden oluşturma yükseltmesi olarak sunulur.
- **Bağımsız sürüm sabitlemeleri**: Yönetilmeyen bir paket olmayan sunucu için, Mojang'ın manifestosuna karşı açık bir `mc_version` sabitlemesi ve yükleyici kayıt defterine karşı açık bir yükleyici-derleme ortam değişkeni (`PAPER_BUILD`, `FORGE_VERSION` ve benzeri). Paper derlemeleri PaperMC'nin mevcut **Fill v3 API**'sinden gelir (eski v2 uç noktası yeni Minecraft sürümlerini almaya son verdi).

![Güncellemeler](/docs/images/updates.png)

## Nasıl çalışır

Panel, her sunucunun sabitlenmiş sürümlerini üst akış kaynağına karşı kontrol eder ve daha yeni bir sürümü olan her şeyi listeler. Eşleşen bir sayı, [gösterge tablosu](/docs/dashboard/)'nun "Kullanılabilir Güncellemeler" kutucuğunda da görünür.

Denetimler isteğe bağlı olarak çalışır ve zamanlanabilir ([Zamanlamalar](/docs/schedules/)). Güncelleme **politikası** sunucu başına ayarlanır: panelin yalnızca sizi bilgilendirmesine mi yoksa her şeyi manuel bırakmasına mı karar verirsiniz.

## Güncelleme uygulama

Güncellemeler asla sessiz olmaz. Bir paketi yükseltmeyi seçtiğinizde, panel:

1. **Güncelleme öncesi yedekleme** alır (böylece geri alınabilir; sunucu başına son 10 güncelleme öncesi yedek saklanır).
2. Tam yeni sürümü yeniden sabitler.
3. Gerekirse Java çalışma zamanını yeniden çözümleyerek kapsayıcıyı yeniden oluşturur.
4. Platform başına bir zaman bütçesiyle ilk önyüklemeyi izler.

Sağlıklı bir şekilde başlamazsa, güncelleme öncesi yedeğe geri dönersiniz. Kararlı izleme yapan bir sunucuya asla beta sürümü sunulmaz ve değişiklik günlüğü bağlantısı, kaynağın sağladığı gerçek sürüme özgü farkı gösterir. Başarısız bir güncelleme, entegrasyon yapılandırılmışsa bir Discord [uyarısı](/docs/integrations/) da tetikler.
