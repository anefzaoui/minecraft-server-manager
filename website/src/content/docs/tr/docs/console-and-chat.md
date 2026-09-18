---
title: 'Konsol ve sohbet komutları'
description: 'Konsol sekmesi, sunucu günlüğünü gerçek zamanlı olarak yayınlar ve herhangi bir sunucu komutunu göndermeniz için bir komut kutusu sağlar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Dokümanlar dizinine dön](/docs/)

## Canlı konsol

**Konsol** sekmesi, sunucu günlüğünü gerçek zamanlı olarak akıtır ve herhangi bir sunucu komutunu göndermeniz için bir komut kutusu sağlar. `docker exec` yok, SSH yok. Çıktı, renkleri ve tümüyle satır içi olarak geri gelir.

![Konsol](/docs/images/server-console.png)

Konsol aynı zamanda panelin sunucunun durumunu okuduğu yerdir: önyükleme aşamasını ("Modlar yükleniyor", "Dünya oluşturuluyor", "Başlatma tamamlanıyor") sınıflandırmak için günlüğü izler ve çevrimiçi olanları takip etmek için `list` komutunu çağırır, böylece kontrol paneli ve sunucu kartları her zaman gerçeği yansıtır.

Bu yoklama, her döngüde kısa ömürlü bir RCON bağlantısı açar; bu, sunucu günlüklerinde yaklaşık 20 saniyede bir `Thread RCON Client … started` / `shutting down` çifti olarak ve (çekirdeği veya eklentileri bunu yansıtan sunucularda) her salt okunur yoklama için `Rcon issued server command: …` satırı olarak görünür - oyuncu sayıları için `list`, ayrıca Dünya Kontrolleri sayfası açıkken `time query …` ve `gamerule <name>` okumaları. Günlüğün üzerindeki **RCON gürültüsünü gizle** anahtarı bu satırları (RCON dinleyici başlatma satırlarıyla birlikte) filtreler. Varsayılan olarak açıktır ve tarayıcı başına hatırlanır; ham akışı görmek için kapatın.

Panelden gönderilen komutlar, sunucu başına bir etiket altında oyunda duyurulabilir, böylece oyuncular gizemli bir konsol yerine bir operatörün işlem yaptığını bilir.

## Sohbet komutları

Sohbet komutları, oyuncuların oyun sohbetinde bir ön ek komutu yazarak panel eylemlerini tetiklemelerine olanak tanır, örneğin rastgele ışınlanma için `!spawn`. Algılama günlük tabanlıdır ve yürütme sunucu aracılığıyla gerçekleşir, bu nedenle **mod gerekmez**.

![Sohbet komutları](/docs/images/chat-commands.png)

Her komutun şunları vardır:

- Bir **tetikleyici** (örneğin, `spawn`) ve bir **ön ek** (varsayılan olarak `!`).
- Bir **eylem**: rastgele ışınlanma, bir yapıya ışınlanma, bir biyoma ışınlanma veya ham konsol komutlarını çalıştırma.
- Bir **izin seviyesi**: herkes, beyaz listedeki oyuncular veya yalnızca operatörler.
- Bir **bekleme süresi** ve `{distance}` gibi yer tutucularla özelleştirilebilir bekleyen / başarılı / başarısız mesajları.

### Güvenlik notu

Sunucuyu bozabilecek komutlar (`stop`, `op`, `ban`, `whitelist` ve benzerleri) yalnızca **yalnızca operatörler** için tetikleyicilerde izin verilir. Panel, bunlar `execute … run …` zincirine yerleştirilmiş olsalar bile bunları kontrol eder, böylece düşük izinli bir tetikleyici tehlikeli bir komutu gizlice sokamaz. Yalnızca bu kelimeleri belirten sıradan sohbet metni (bir `say` mesajı gibi) olduğu gibi bırakılır.
