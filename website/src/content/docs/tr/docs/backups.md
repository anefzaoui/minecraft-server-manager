---
title: 'Yedeklemeler'
description: 'Yedeklemeler sayfası, boyut, neden ve yaş bilgileriyle birlikte tüm sunucularınızdaki anlık görüntüleri gösterir.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Geri belgeler dizinine](/docs/)

**Yedekler** sayfası, boyut, neden ve yaş ile birlikte tüm filonuzdaki her anlık görüntüyü gösterir.

![Yedekler](/docs/images/backups.png)

## Yedek Oluşturma

Bir sunucunun **Yedekler** sekmesinden (veya bir [zamanlama](/docs/schedules/) aracılığıyla) tüm sunucu dizinini tek bir tıklamayla anlık olarak kaydedebilirsiniz. Panel, dünyayı önce sakinleştirir (`save-off` → `save-all`), verileri zip'ler, ardından kaydı yeniden etkinleştirir (`save-on`), böylece yedekler çalışan bir sunucuda bile tutarlı olur. Sıkıştırma, paneli durdurmadığı için arka plan bir işçi iş parçacığında çalışır. Her yedek bir not taşıyabilir.

Her arşiv, yazıldığı anda **bütünlük kontrolünden geçirilir**: panel zip dosyasını yeniden açar ve dizinini okur. Bozuk veya açılamayan bir arşiv silinir ve yedekleme çağrısı, sorunun aylar sonra bir geri yükleme yapmaya çalıştığınızda ortaya çıkması yerine o anda başarısız olur. Hiç başlamamış bir sunucunun sıfır girişli arşivi (bir sunucu hiç başlamamışsa) izin verilir ancak olayda işaretlenir.

Arşiv güvenli bir şekilde yazıldıktan sonra (Yedekler sekmesinde veya bir yedekleme zamanlamasında) **"Ayrıca dünyayı sonradan küçült"** seçeneğini işaretleyin (bkz. **[Dünyayı Küçültme](/docs/world-shrink/)**). Küçültme yalnızca sunucu durdurulduğunda çalışır; çalışan bir sunucuda yedekleme yine de gerçekleşir ve küçültme atlanır.

![Sunucu yedekleri](/docs/images/server-backups.png)

## Yedek Nedenleri

Yedekler, neden alındıklarına göre etiketlenir:

- **manuel** - düğmeye tıkladınız.
- **zamanlanmış** - bir [zamanlama](/docs/schedules/) tarafından oluşturuldu. Her yeni sunucuya otomatik olarak günlük zamanlanmış bir yedek de eklenir (02:00 ile 05:59 arasında rastgele), böylece bir sunucu ilk günden itibaren otomatik kapsama alanına sahip olur, sadece güncellemelerden önce değil.
- **güncelleme-öncesi** - bir paket yükseltmesinden önce otomatik olarak alınır, böylece bir yükseltme her zaman geri alınabilir.
- **geri-yükleme-öncesi** - bir geri yükleme veya dünya sıfırlamasından hemen önce otomatik olarak alınır, geri yüklemenin istediğiniz şey olmadığı durumlarda bir güvenlik ağı olarak.

## Saklama

Saklama, **sunucu başına, nedene göre** sınırlandırılmıştır: her gruptaki en yeniler tutulur, eskiler her başarılı yedekten sonra otomatik olarak temizlenir:

| Neden               | Tutulan |
| ------------------- | ------- |
| zamanlanmış         | 10      |
| güncelleme-öncesi   | 10      |
| manuel              | 20      |
| geri-yükleme-öncesi | 5       |

`geri-yükleme-öncesi`'nin kendi küçük bir haznesi vardır, böylece otomatik bir güvenlik yedeği asla sizin bilinçli olarak tuttuğunuz bir `manuel` yedeği silemez.

Her nedene göre sayımların üzerine ek olarak iki isteğe bağlı tavan uygulanır, her ikisi de varsayılan olarak kapalıdır: **maksimum yaş** (N günden eski yedekler, nedeni ne olursa olsun temizlenir) ve sunucu başına **maksimum toplam boyut** (toplam sığana kadar en eski yedekler temizlenir, önce `geri-yükleme-öncesi` olanlar). Bir sunucunun en yeni yedeği bu tavanlardan hiçbiri tarafından temizlenmez. Bunların tümü Ayarlar sayfasında küresel olarak değiştirilebilir ve sunucu bazında Yedekler sekmesinde geçersiz kılınabilir.

Yedekler, yedek listesinden **yeniden adlandırılabilir** (her satırdaki yeniden adlandırma düğmesi). Disk üzerindeki arşiv ve panelin kaydı birlikte hareket eder, böylece indirme, geri yükleme ve saklama yeni adla çalışmaya devam eder.

![Bir yedek yeniden adlandırma](/docs/images/backup-rename.png)

> Saklama otomatik olarak sınırlanır, ancak büyük modlu arşivler hala bir sunucunun [disk kotasına](/docs/storage/) dahil edilir, bu nedenle büyük paketler için toplamı göz önünde bulundurun.

## Geri Yükleme

Bir yedekten geri yükleme sunucuyu durdurur (dosyalara dokunmadan önce kapsayıcının gerçekten durduğunu doğrular), bir `geri-yükleme-öncesi` güvenlik yedeği alır, **tüm sunucu dizinini** anlık görüntüyle değiştirir ve yeniden başlatmanız için durdurulmuş olarak bırakır. Paket yükseltmeleri her zaman önce bir `güncelleme-öncesi` yedeği aldığı için, kötü bir yükseltmeyi her zaman geri alabilirsiniz.

## Panelin Kendi Veritabanı

Sunucu yedekleri yalnızca sunucu başına dünya dizinlerini kapsar. Panelin kendi veritabanı (`panel.db`, kullanıcıları, rolleri, 2FA sırlarını, zamanlamaları, paket sabitlemelerini ve geçmişi tutar) günlük bakım zamanlayıcısında ayrı olarak anlık görüntülenir:

- `VACUUM INTO`, `data/backups/_panel/`'e tutarlı, parçalanmamış bir kopya yazar; en yenisi **14** tutulur.
- Başlangıçta panel `PRAGMA integrity_check` çalıştırır ve başarısız olursa yüksek sesle günlüğe kaydeder, sizi en yeni iyi kopya için `data/backups/_panel`'e yönlendirir.

Tüm `data/` ağacını yedekleyin (ayrıca `data/`'da şifreleme anahtarı olan `.secret-key` de bulunur) ve her şeyi yedeklemiş olursunuz.
