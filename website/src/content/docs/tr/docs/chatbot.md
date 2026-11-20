---
title: 'Sunucu başına Minecraft sohbet botu'
description: 'Panel, sunucunun Ayarlar → Sohbet Botu sekmesinde yapılandırılan, yönetilen her Minecraft sunucusu için yönetici tarafından yapılandırılmış bir sohbet botu sunar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Geri belgeler dizinine](/docs/)

Panel, yönetilen her Minecraft sunucusu için yönetici tarafından yapılandırılan bir sohbet botu sunar. Bu bot, sunucunun **Ayarlar → Sohbet Botu** sekmesinde kurulur. Ollama'nın başka bir yerel ağ ana bilgisayarında çalıştığı durumlar dahil olmak üzere, OpenAI uyumlu bir sohbet tamamlama uç noktasına bağlanır. Her sunucunun kendi uç noktası, modeli, çağırma adı, kişiliği, transkript politikası, erişim mesajları ve güç politikası vardır. Varsayılan çağırma `@wizard`'dır ve varsayılan kişilik eski, eğlenceli bir oyun içi büyücüyü temsil eder; her ikisi de düzenlenebilir.

![Sohbet Botu ayarları](/docs/images/integrations-chatbot.png)

## Oyuncu deneyimi

- Herhangi bir oyuncu, sohbet ve kararlı, Minecraft sürümüne duyarlı standart tarif yardım için `@wizard <mesaj>` (veya yapılandırılmış çağırma) kullanabilir.
- Katılma selamları ve yapılandırılabilir tek seferlik oyun oturumu kontrolü, oyunculara sohbet botunun mevcut olduğunu hatırlatır. `@wizard chat` kısa bir katılım sohbet penceresi açar; `@wizard bye` kapatır.
- **Temel kullanıcılar** etkinleştirilmiş kendi/dünya güçlerini çağırabilir. **Güç denetleyicileri**, başka bir çevrimiçi oyuncuyu etkileyen ayrı ayrı doğrulanmış eylemleri çağırabilir. Her iki grupta da olmayan oyuncular yalnızca sohbetle sınırlı kalır.
- Temel kullanıcıların kendi kendine verdiği hediyeler bir öğe izin listesi kullanır. Denetleyiciler, başka bir oyuncuya miktar sınırı ve diğer güç güvenlik önlemlerine tabi olarak herhangi bir geçerli ad alanı içeren standart veya modlu öğeyi verebilir.

![Sohbet Botu transkriptleri](/docs/images/chatbot-transcripts.png)

## Tasarım ve güvenlik

Yapılandırma ve transkriptler yalnızca yöneticilere özeldir. Model asla ham RCON veya rastgele komut yürütme almaz. Bir mesaj, yalnızca açık amacı için eşleşen tek bir sabit aracı ortaya çıkarır; sunucu kodu, mevcut bir hizmet işlemini yürütmeden önce yetkilendirmeyi, argümanları, bayrakları, miktarları, soğuma sürelerini ve tam çevrimiçi oyuncu adlarını doğrular. Minecraft seçicileri reddedilir, çapraz oyuncu eylemleri arayanı hedefleyemez, güçler kuru çalıştırma modunda başlar ve denenen her güç denetlenir. Desteklenmeyen araç çağırma modelleri yalnızca sohbetle sınırlı kalır.

Yanıtlar Minecraft sohbeti için sınırlıdır. Bilinen standart tarifler, paketlenmiş sürümlü tarif verilerinden gelir ve kararlı 2x2/3x3 satırlar olarak işlenir; LLM'nin tarif düzenlerini icat etmesine güvenilmez. Bilinmeyen veya modlu tarifler, bir cevap uydurmak yerine oyuncuyu JEI/REI'ye yönlendirir.

## Ana uygulama dosyaları

- `src/services/wizard.js`: sunucu başına yapılandırma, OpenAI uyumlu istekler, sohbet işleme, erişim, transkript saklama ve yanıt sınırları.
- `src/services/wizardPowers.js`: rol kontrolleri, niyet özel araç şemaları, doğrulama, yürütme, soğuma süreleri ve güç denetimi.
- `src/services/wizardRecipes.js`: kararlı sürümlü tarif arama ve ızgara biçimlendirme. Tarif ve öğe verileri, paketlenmiş [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data) paketinden gelir. (Bu belgenin önceki bir taslağı, hiçbir zaman işlenmemiş bir `src/data/recipes/` klasörüne işaret ediyordu; böyle bir klasör yoktur ve veriler pakette bulunur. "Bağımlılık ayak izi" bölümüne bakın.)
- `src/analytics/ingest.js`: ayrıştırılmış katılım, ayrılma ve oyuncu sohbetlerini sohbet botuna iletir.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` ve `views/partials/server/integrations.hbs` (`chatbot.hbs` aracılığıyla): yönetici API'si ve sunucu başına Ayarlar → Sohbet Botu sekmesi.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` ve `019_wizard_power_controllers.js`: kalıcı şema.
- `test/wizard.test.js`: yetkilendirme, araç sınırı, saklama, erişim ve sohbet davranış testleri.

Dahili `wizard` rota/modül/tablo adları, yükseltme ve API uyumluluğu için korunur; "chatbot" kullanıcıya yönelik ürün terimidir. Benzer şekilde, depolanan `power_testers_json` alanı, kullanıcı arayüzünün **Temel kullanıcılar** grubuna karşılık gelir.

## Bağımlılık ayak izi (`minecraft-data`)

Tarif yardımı `minecraft-data` paketini kullanır. Disk üzerinde büyüktür (kurulu yaklaşık 429 MB) ve üretim görüntüsünün içinde gönderilir çünkü bir geliştirme bağımlılığı değil, çalışma zamanı bağımlılığıdır. Tarif yardımının ağ çağrısı olmadan her Minecraft sürümü için çevrimdışı çalışmasını sağlamak amacıyla kasıtlı olarak tutulmaktadır.

Bununla ilgilenecek bir sonraki kişiye (insan veya yapay zeka) yönelik notlar, böylece boyut sürpriz olmaz:

- Şu anda yalnızca Java (`pc`) verileri kullanılır. `wizardRecipes.js`, `minecraftData.versions.pc` ve sürüm başına `recipes`, `items` ve `blocks` tablolarını okur. Dokunduğu dosyalar, her pc sürümü boyunca yaklaşık 15 MB'a ulaşır.
- Paketin yaklaşık 330 MB'ı `data/bedrock`'tur ve şu anda hiçbir şey bunu okumaz. Kasıtlı olarak yerinde bırakılmıştır. Panel gelecekte Bedrock Minecraft desteği eklerse, Bedrock tarif ve öğe verileri zaten buradadır, bu nedenle tarif özelliği yeni bir bağımlılık eklemeden Bedrock sunucularını kapsayacak şekilde büyüyebilir. `minecraftData.versions.bedrock`'tan başlayın ve pc yoluyla aynı şekli izleyin.
- Boyutun Bedrock desteği gelmeden önce düşürülmesi gerekirse, bu repoda zaten bir kalıp mevcuttur. `src/services/itemRegistry.js`, ihtiyaç duyduğunda `minecraft-data` dosyalarını jsDelivr CDN'den alır ve bunları `api_cache`'de önbelleğe alır. Ya bu yaklaşım ya da birkaç yaygın sürümü kapsayan küçük, elle seçilmiş bir `src/data/recipes/` alt kümesi, görüntüyü önemli ölçüde küçültür.

## Yerel depolama ve manuel inceleme

Tüm ayarlar ve saklanan transkriptler, panel kapsayıcısı içindeki `/data/panel.db` adresindeki panel SQLite veritabanında bulunur. Standart Compose bağlamasıyla, ana bilgisayar yolu `${DATA_DIR_HOST}/panel.db`'dir (örneğin, `/opt/msm/data/panel.db`). İlgili tablolar `wizard_configs`, `wizard_transcripts` ve `wizard_outreach`'tir; güç denetimleri, türü `wizard-power` olan `events` tablosundaki satırlardır. İsteğe bağlı LLM API anahtarı, panelin yerinde anahtarıyla AES-256-GCM ile şifrelenir, veri klasöründeki `.secret-key` ( `SESSION_SECRET`'ten ayrıdır).

Doğrudan SQLite düzenlemeleri yapmadan önce veritabanını yedekleyin ve paneli durdurun, böylece WAL'ı güvenli bir şekilde işlenir. Yönetici UI/API'yi kullanmak tercih edilir çünkü doğrulama ve şifrelemeyi uygular. Canlı bir veritabanını kopyalarken `panel.db`, `panel.db-wal` ve `panel.db-shm` dosyalarını bir arada tutun.
