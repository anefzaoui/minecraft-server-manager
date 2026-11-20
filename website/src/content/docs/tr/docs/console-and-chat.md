---
title: 'Konsol ve sohbet komutları'
description: 'Konsol sekmesi, sunucu günlüğünü gerçek zamanlı olarak yayınlar ve herhangi bir sunucu komutunu göndermeniz için bir komut kutusu sağlar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Dokümanlar dizinine dön](/docs/)

## Canlı konsol

**Konsol** sekmesi, sunucu günlüklerini gerçek zamanlı olarak akıtır ve herhangi bir sunucu komutunu göndermeniz için bir komut kutusu sunar. `docker exec` veya SSH gerekmez. Çıktı, renkleri ve tüm ayrıntılarıyla satır içi olarak geri gelir. Komut göndermek için o sunucuda Konsol iznine sahip olmanız gerekir; izniniz yoksa yalnızca günlüğü izleyebilirsiniz.

Günlüğün üzerinde, satırları metne (veya `/regex/`) ve seviyeye (INFO, WARN, ERROR) göre filtreleyebilir ve **İndir** seçeneğiyle son çıktıları, tam `latest.log` dosyasını veya tüm günlük dosyalarını zip olarak indirebilirsiniz.

![Konsol](/docs/images/server-console.png)

Konsol ayrıca, panelin sunucunun durumunu okuduğu yerdir: önyükleme aşamasını sınıflandırmak için günlüğü izler ("Modlar yükleniyor", "Dünya oluşturuluyor", "Başlatma tamamlanıyor") ve çevrimiçi olanları izlemek için `list` komutunu çağırır, böylece kontrol paneli ve sunucu kartları her zaman gerçeği yansıtır.

Bu yoklama, her döngüde kısa ömürlü bir RCON bağlantısı açar; bu, sunucu günlüklerinde yaklaşık 20 saniyede bir `Thread RCON Client … started` / `shutting down` çifti olarak ve (çekirdeğinin veya eklentilerinin bunu yankıladığı sunucularda) salt okunur yoklama (`list` oyuncu sayıları için, ayrıca Dünya Kontrolleri açıkken `time query …` ve `gamerule <name>` okumaları) için her `Rcon issued server command: …` satırı olarak görünür. Günlüğün üzerindeki **Konsol Gürültüsünü Gizle** anahtarı, bu satırları (RCON dinleyici başlatma satırlarıyla birlikte) filtreler. Varsayılan olarak açıktır ve tarayıcı başına hatırlanır; ham akışı görmek için kapatın.

Panelden gönderilen komutlar, sunucu başına bir etiket (**Şu şekilde duyur…** kutusu) altında oyunda duyurulabilir, böylece oyuncular gizemli bir konsol yerine bir operatörün işlem yaptığını bilir.

## Sohbet

**Konsol → Sohbet**, sunucu çalışırken oyun içine mesajlar gönderir: **Stilize edilmiş** mesajlar renkleri ve biçimlendirmeyi alır ve herkese veya çevrimiçi tek bir oyuncuya gidebilir; **Düz** ise herkese basit bir `[Sunucu]` yayını gönderir.

![Konsol → Sohbet](/docs/screenshots/04-chat.png)

## Sohbet komutları

Sohbet komutları (**Konsol → Komutlar**), oyuncuların oyun içi sohbette bir önek komutu yazarak panel eylemlerini tetiklemelerine olanak tanır, örneğin rastgele ışınlanma için `!spawn`. Algılama günlük tabanlıdır ve yürütme sunucu üzerinden gerçekleşir, bu nedenle **mod gerekmez**.

![Sohbet komutları](/docs/images/chat-commands.png)

Her komut şunlara sahiptir:

- Bir **tetikleyici** (örneğin, `spawn`), sunucunun **önekinden** (`!` varsayılan olarak, bir veya iki karakter, asla `/`) sonra yazılır.
- Bir **eylem**: rastgele ışınlanma, bir yapıya ışınlanma, bir biyoma ışınlanma veya ham konsol komutları çalıştırma.
- Bir **izin seviyesi**: herkes, beyaz listedeki oyuncular veya yalnızca operatörler.
- Oyuncu başına bir **bekleme süresi** (varsayılan olarak 30 saniye) ve `{distance}` gibi yer tutucularla özelleştirilebilir bekleyen / başarılı / başarısız mesajları.

### Güvenlik notu

Sunucuyu bozabilecek komutlar (`stop`, `op`, `ban`, `whitelist` ve benzerleri) yalnızca **yalnızca operatörler** tetikleyicilerinde izin verilir. Panel, bunlar `execute … run …` zincirine yerleştirilmiş olsalar bile bunları kontrol eder, böylece düşük izinli bir tetikleyici tehlikeli bir komutu gizlice sokamaz. Yalnızca bu kelimeleri belirten sıradan sohbet metni (bir `say` mesajı gibi) olduğu gibi bırakılır.
