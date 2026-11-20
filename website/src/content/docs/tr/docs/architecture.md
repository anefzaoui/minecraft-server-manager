---
title: 'Mimari'
description: 'Minecraft Server Manager, tek süreçli, sunucu taraflı oluşturulan bir Node.js uygulamasıdır.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Belgelere geri dön](/docs/)

Minecraft Server Manager, tek süreçli, sunucu tarafından oluşturulan bir Node.js uygulamasıdır.
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) görüntüsünü kullanarak Docker
kapsayıcıları olarak çalışan Minecraft sunucularını yönetir ve Docker daemon'ı ile API'si üzerinden konuşur
(asla `docker` CLI'sine kabuktan erişmez).

## Çalışma zamanı yapısı

- **Express + Handlebars** sayfaları sunucu tarafında oluşturur. SPA yoktur; `public/js/` içindeki
  tarayıcı JS'si elle yazılmış aşamalı geliştirmedir. Bir esbuild adımı (`pnpm run build:js`)
  onu `public/dist/js/` içine paketler ve küçültür; uygulama, mevcut olduğunda bu paketi, aksi takdirde
  ham kaynağı sunar, böylece derleme olmadan bir geliştirme çalıştırması hala çalışır.
- **`node:sqlite`** (Node'a yerleşik; panel Node ≥ 24 gerektirir) veritabanıdır - senkron, sıfır
  yerel modül, WAL modu. Küçük bir sürümlü geçiş çalıştırıcısı, önyüklemede `src/db/migrations/*`
  uygular. Hazırlanmış ifadeler, SQL metnine göre anahtarlanmış olarak `src/db/index.js` içinde
  önbelleğe alınır.
- **`ws`** canlı konsol ve istatistik akışlarını taşır. Her ikisi de **aracılıdır**: her sunucu
  için bir yukarı akış `docker logs --follow` (veya `docker stats`), bir kez ayrıştırılır ve her
  bağlı sekmeye dağıtılır, her görüntüleyici için bir yukarı akış yerine. Konsol aracısı, geç
  katılan sekmeler için küçük bir tekrar arabelleği tutar ve paylaşılan akışı durdurmak yerine
  soketi çok geride kalan bir aboneyi düşürür.
- **dockerode**, uygulamanın Docker ile konuşmasının tek yoludur. Uç nokta platforma göre otomatik
  olarak algılanır (Windows adlandırılmış boru vs. unix soketi).
- **Tüm kalıcı durum tek bir dizin altında yaşar** (`$DATA_DIR`, varsayılan `./data`). Bu dizini
  kopyalamak tüm paneli taşır.

## Katmanlama

Bağımlılıklar tek yönde akar:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   girdiyi ayrıştır ve doğrula, yanıtları şekillendir
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   alan mantığı (gerçek özellikler)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   altyapı
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - her alan için bir yönlendirici (`players`, `worlds`, `crashes`, `blueprints`,
  `files`, …). `web/app.js` üst düzey olanları bağlar (`api.js`, çekirdek sunucu rotalarını
  tutarak sunucu başına alan yönlendiricilerini bağlayan oturum JSON API'si; `index.js`, sayfalar;
  `auth`, `account`, `tasks`, …). Yönlendiriciler zod ile doğrular, bir hizmeti çağırır ve JSON
  döndürür veya bir görünüm oluşturur. İş mantığı buraya ait değildir. İki yönlendirici,
  `requireAuth` öncesinde **genel bölgeye** bağlanır: `routes/status.js` (isteğe bağlı sunucu
  başına HTML durum sayfaları) ve `routes/apiV1.js` (`/api/v1`, `services/apiTokens.js`
  tarafından yönetici tarafından oluşturulan bir Taşıyıcı jetonla kimliği doğrulanmış salt okunur
  bir JSON API'si, Ayarlar'da etkinleştirilmedikçe kapalıdır; bkz. `docs/public-api.md`).
- **`services/`** - uygulamanın kalbi. Her hizmet bir alanı yönetir ve altyapıya ve diğer
  hizmetlere bağımlı olabilir.
- **`docker/`** - dockerode sarmalayıcıları: `connect` (uç nokta algılama + daemon sağlığı),
  `containers` (bağlama bağlamaları, bellek/CPU limitleri ve etiketlerle oluşturma/başlatma/durdurma/yeniden
  oluşturma), `logs`, `stats`, `images`, `networks` (ana bilgisayar ağı keşfi), `hostPath`
  (`DATA_DIR_HOST` altındaki bağlama yollarını yeniden köklendirir) ve Docker olaylarını geçmiş +
  çökme algılamasına dönüştüren bir `watcher`.
- **`db/`** - SQLite sarmalayıcısı ve geçiş çalıştırıcısı.
- **`storage/`** - `./data` önyüklemesi, **yol koruyucusu** (`safeJoin`, dosya güvenliği omurgası)
  ve arka plan boyut dizinleyici + kota uygulaması.

Çapraz kesim:

- **`config/`** - ortam yapılandırması artı **alan kataloğu**: sunucu ayarları için tek doğruluk
  kaynağı. Her itzg ortam değişkeni kataloglanır (etiket, yardım, tür, birim, varsayılan, doğrulama,
  bölüm, tehlike bayrakları). Sihirbaz, ayarlar formları ve zod doğrulaması hepsi bundan türetilir,
  bu nedenle yeni bir ayarı açığa çıkarmak bir veri değişikliğidir, yeni UI tesisatı değildir.
- **`events/`** - `recordEvent()` geçmiş günlüğü için tek giriş noktasıdır; yaşam döngüsü olayları
  ayrıca kapsayıcı günlüğü alıntılarını `data/logs/<id>/events/` içine yakalar.
- **`ws/`** - kimliği doğrulanmış konsol + istatistik WebSockets (yükseltmede oturum çerezi doğrulanır,
  siteler arası ele geçirmeyi engellemek için `Origin` kontrol edilir), sunucu başına aracılı (bkz.
  "Çalışma zamanı yapısı").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` modül başına bir
  [Pino](https://getpino.io) günlükçüsü döndürür; `LOG_LEVEL`'den seviye, `makeFailureThrottle()`
  kalıcı olarak başarısız olan bir arka plan döngüsünü bir günlük satırına ve bir "kurtarıldı"
  satırına tutar. `src/utils/logSanitize.js` kimlik bilgisi şeklindeki anahtarları ve webhook
  jetonlarını yapılandırılmış meta verilerden gizler; `src/config/logLevel.js` paylaşılan seviye
  izin listesidir (`config` ile bir require döngüsünü önlemek için ayrı tutulur).
  `src/instrument.js`, `src/server.js` içinde ilk yüklenen uyuyan bir Sentry dikişidir.
  `src/web/middleware/requestLog.js` her istek için bir erişim günlüğü satırı yazar (`/healthz` ve
  statik varlıkları atlar). ESLint, `src/**` altında `no-console`'ı zorlar, `preflight.js`,
  `instrument.js` ve `config/index.js` muaf tutulur (günlükçü var olmadan önce çalışırlar).
- **Hız sınırlama** - `src/web/middleware/rateLimit.js`, `/api` (`RATE_LIMIT_API_PER_MIN`,
  varsayılan 1200) ve giriş / 2FA / kurulum POST'larının önüne `express-rate-limit` koyar
  (`RATE_LIMIT_AUTH_PER_15MIN`, varsayılan 100); `0` bir sınırlayıcıyı devre dışı bırakır.
  `req.ip`'ye göre anahtarlanır, bu nedenle bir proxy arkasında `TRUST_PROXY` önemlidir. `/api/v1`
  kendi sınırlayıcılarına sahiptir: jeton doğrulanmadan önce çalışan istemci IP başına bir üst sınır
  (jeton başına bütçenin beş katı), ardından doğrulanmış jetonun kimliğine göre anahtarlanmış jeton
  başına bir bütçe (`RATE_LIMIT_PUBLIC_API_PER_MIN`, varsayılan 120). `src/web/middleware/auth.js`
  içindeki ayrı bir hesap başına yumuşak sayaç, giriş kilitlemesini (IP başına ve hesap genelinde,
  azalan) ele alır.
- **Yetkilendirme**: iki katman. Genel rol (`requireAuth` → `requireRole` / `requireWrite` in
  `src/web/middleware/auth.js`) panel genelindeki eylemleri kilitler ve her sunucuda varsayılandır.
  Sunucu başına izinler (`src/services/permissions.js`, `user_server_permissions` içinde
  `(kullanıcı, sunucu)` başına bir JSON listesi olarak depolanan dokuz yetenek) bu varsayılanı bir
  sunucu için iyileştirir; her `/api/servers/:id` rotası, alt yönlendirici bağlaması, sayfa,
  WebSocket ve filo genelindeki listeleme `src/web/middleware/serverAccess.js` üzerinden geçer
  (`serverScope`, hem API'nin hem de sayfa yönlendiricisinin `/servers/:id` önekine bağlıdır,
  `view` olmadan bir sunucuyu 404 olarak gizler; `requireCap(cap)` bir rotanın ihtiyaç duyduğu
  yeteneği adlandırır). Gövdesinde sunucularını adlandıran yazmalar (programlar, dünya çıkarma ve
  kurulum, şablon dışa aktarma) yalnızca o sunucu için `requireWrite` tarafından görüntüleyiciler
  için açılır ve bu tür her rota yeteneği kendisi kontrol eder.
  `test/permissions-routes.test.js` canlı yönlendirici yığınlarını dolaşır ve sunucu kapsamlı bir
  yazma rotası, bağlama veya sayfanın bir geçidi yoksa başarısız olur.

## Temel alan davranışları

- **Mod paketleri her zaman sabitlenir.** Görüntü, her yeniden başlatmada sabitlenmemiş paketleri
  otomatik olarak yükseltir, bu nedenle panel "en son"u kurulum zamanında somut bir sürüm kimliğine
  çözümler ve sabitler. Yükseltmeler açıkça düzenlenmiş bir akıştır (`updates/`): önizleme →
  güncelleme öncesi yedekleme → sorunsuz durdurma → yeniden sabitleme → yeniden oluşturma → sağlık
  izleme → tek tıklamayla geri alma.
- **Özel mod katmanı** panel tarafından yönetilir: kullanıcı tarafından eklenen modlar,
  tekilleştirilmiş kütüphaneye iner ve sunucuya sabit bağlantılarla bağlanır, böylece paket
  güncellemelerinden sağ çıkarlar. Devre dışı bırakma sınıf farkındadır. Kütüphane indirdiği her
  yapıyı tuttuğu için, bir güncelleme değiştirdiği yapıyı (`server_content.previous_*`) kaydeder ve
  yalnızca yerel dosyalardan geri alınabilir. Bir paket modunu devre dışı bırakmak, paketin hariç
  tutma ortam değişkenini yazar; `packs.applyPack` bunu ve paketin geri kalan ayarlarını
  (`PACK_TUNING_KEYS`) aynı paketin sürüm değişikliği boyunca taşır ve paket değiştiğinde düşürür.
- **Bir Minecraft sürüm yükseltmesinin kazanılması gerekir.** `services/compat.js` bir sunucunun
  modlarını tarar - panel tarafından yüklenen satırlardan, ardından CurseForge paket manifestosundan,
  ardından Modrinth/CurseForge'a karşı içerik karmasıyla çözümlenir - ve CurseForge'un
  `latestFilesIndexes` (istek başına 200 proje) ve Modrinth'in proje başına sürüm listesinden
  (proje başına bir istek, bu da yükleyici ve sürümün eşleşmesini sağlar) proje başına bir (yükleyici,
  Minecraft sürümü) destek matrisi oluşturur. Güncelleme denetleyicisi yalnızca HER modun desteklediği
  en yeni sürümü sunar ve yanıt belirlenemediğinde hiçbir şey sunmaz: tarama yok, farklı bir sürüm
  veya yükleyici için tarama, hiç bitmeyen bir tarama veya hiçbir kayıt defterinin tanımadığı bir
  jar. Taramalar yalnızca manueldir ve ilerlemeleri ve kısmi sonuçları `version_compat` içinde yaşar
  (bellekteki `services/tasks.js` içinde değil), bu nedenle bir yenileme veya panel yeniden başlatma
  bir dönen simgede takılı kalmak yerine devam eder; `reconcileScans()` bir kapatma tarafından
  yetim bırakılan taramaları bir sonraki önyüklemede işaretler.
- **Mod yükleyici sürümü, diğer her şey gibi bir sabittir.** `services/loaderPin.js`, görüntünün
  kendi kurulum manifestosundan (`.forge-manifest.json` ve benzerleri) kurulu yapıyı okur ve sabiti
  yazar: düz bir sunucuda yükleyicinin itzg değişkeni (`FORGE_VERSION`, …) veya Forge veya Fabric
  CurseForge paketinde `CF_MOD_LOADER_VERSION`, bu da paketin bildirdiği sürümü geçersiz kılar.
  Görüntünün CurseForge yükleyicisi NeoForge için bu geçersiz kılmayı yok sayar ve Modrinth ve FTB
  paketlerinin hiçbiri yoktur, bu nedenle yükleyicileri paketi takip eder. `packs.applyPack`, bir
  paket güncellemesi veya geri alma işleminde her `CF_` değişkenini kaldırır, bu da bir geçersiz
  kılmayı diğerleriyle birlikte düşürür. Yazılı bir yapı, önce kayıt defterinin tam listesine karşı
  kontrol edilir (`services/loaderVersions.js`; Forge'unki maven meta verilerinden gelir, bu da
  sayıları atlar; bir eksiklik kayıt defterinin kendisine karşı bir kez daha kontrol edilir),
  ardından değişiklik yedekleme → sabitleme (yedeklemeden sonraki ortam üzerinden) → yeniden
  oluşturma şeklindedir.
- **Portlar** bir temel şemadan tahsis edilir (oyun `PORT_GAME_START`'tan yukarı, RCON = oyun +
  `PORT_RCON_OFFSET`, Bedrock `PORT_BEDROCK_START`'tan), kullanılabilirlik için kontrol edilir ve
  DB'de rezerve edilir. "Alınmış" olan, her sunucunun taleplerinin (canlı portlar, artı aşağıda
  bekleyen bir çift), herhangi bir Docker kapsayıcısının yayınladığı her ana bilgisayar portunun
  (`containers.publishedHostPorts`: çalışan kapsayıcıların canlı bağlamaları artı durdurulmuş her
  kapsayıcının yapılandırılmış olanları, çünkü panelin kendi kapsayıcısından bir işletim sistemi
  bağlama kontrolü yalnızca o kapsayıcının ağ ad alanını görür) ve işletim sistemi kontrolünün
  birleşimidir. Docker kısmı 3 saniye önbelleğe alınır ve sınırlıdır: 2.5 saniyede yanıt vermeyen
  bir liste yalnızca Docker kısmını düşürür ve yavaş bir inceleme yalnızca o kapsayıcının
  portlarına mal olur. Sunucu oluşturmaları ve `servers.changeGamePort`, yalnızca seçimi ve talebini
  (bir oluşturma için satır yazma, bir port değişikliği için bellekteki rezervasyon) kapsayan tek
  bir serileştirme zinciri aracılığıyla portları seçer; BlueMap'in port seçicisi ve ekstra port
  geçersiz kılmaları içinde değildir ve Docker'a danışmaz. Mevcut bir sunucuda bir port değişikliği
  (sunucunun işlem kilidi altında `servers.changeGamePort`), Docker port bağlamalarını kapsayıcı
  oluşturmada sabitlediği için hemen uygulanır: yeni çift (RCON her zaman oyun +
  `PORT_RCON_OFFSET`) kontrol edilir ve port kilidi altında bellekte rezerve edilir
  (`ports.reserve`, hem eski hem de yeni çift, diğer her seçim tarafından onurlandırılır). Diğer
  ayarlar yeniden oluşturmayı beklerken reddedilir (409 `PENDING_CHANGES`), bu nedenle yalnızca
  zaten çalışan bir kapsayıcıyı yeni bir portta yeniden oluşturur; ve çalışan bir sunucu yalnızca
  istek `restart: true` dediğinde değiştirilir (aksi takdirde 409 `NEEDS_CONFIRM`). Görüntü çekilir
  ve özel bir kapsayıcı adı, herhangi bir şeye dokunulmadan önce kontrol edilir. Çalışan bir sunucu
  durdurulur; ardından yeni çift `pending_recreate = 1` ile yazılır (böylece oradan bir panel
  çökmesi dürüst bir "yeniden oluşturma bekleniyor" bırakır), kapsayıcı kaldırılır, yeni çiftte
  yeniden oluşturulur ve başlatılır. Durdurmadan sonra herhangi bir adım başarısız olursa,
  `putBackOnOldPort` eski çifti geri yazar, üzerinde yeniden oluşturur (ve çalışıyorsa yeniden
  başlatır) ve hangi adımın başarısız olduğunu kaydeder; geçmiş ve uyarılar, bunun bile başarısız
  olup olmadığını söyler, bu da sunucuyu biri başlatana kadar durdurulmuş bırakır. `settings`
  yeteneği yeterlidir, çalışan sunucu dahil. Yönetici olmayanlar yalnızca `PORT_GAME_START`'tan
  yukarı seçebilirler. (Geçiş 029'daki `port_*_pending` sütunları daha önceki, yayınlanmamış bir
  tasarıma aittir ve kullanılmaz; 031 onları temizler.) Bir kilit çakışması 409 ile `code: 'BUSY'`
  yanıtlar, bu da aşağıdaki yeniden deneyen çağırıcılar tarafından kelime yerine kontrol edilir.
  Bir çökme otomatik yeniden başlatması (`watcher.restartAfterCrash`) ve başka bir eylemle meşgul
  olan sunucuyu bulan zamanlanmış bir yedekleme veya başlatma (`scheduler.runTaskWithRetry`), 30
  dakikaya kadar her 20 saniye / 60 saniyede bir tekrar dener ve bir paket güncellemesi veya geri
  alması kilitli adımlarını aynı şekilde yeniden dener (`opLock.retryWhileBusy`); bir çökme
  yeniden başlatması veya bekleyen zamanlanmış bir başlatma, biri sunucuyu durdurduğundan,
  öldürdüğünden veya başlattığından beri vazgeçer (`events.lifecycleActionSince`) ve çökme
  yeniden başlatması ayrıca otomatik yeniden başlatma kapalı olduğunda veya sunucu gittiğinde de
  vazgeçer. Zamanlanmış yeniden başlatmalar, durdurmalar ve komutlar yeniden denenmez ve son
  çalışması hala bekleyen bir program bir sonraki tetiklemesini atlar.
- **Disk kotaları** panel tarafından uygulanır çünkü Docker bağlama bağlama kullanımını sınırlayamaz:
  dizinleyici dizin başına boyutları önbelleğe alır ve disk büyütme işlemleri bunlara göre
  kilitlenir.
- **Sırlar** (RCON şifreleri, API anahtarları, TOTP sırları, Discord webhook URL'si)
  AES-256-GCM kullanılarak `$DATA_DIR/.secret-key` adresinde özel bir rastgele anahtarla
  şifrelenir (`0600` modu, otomatik olarak oluşturulur). `SESSION_SECRET`'ten bağımsızdır;
  `SESSION_SECRET`'ten türetilmiş bir anahtar, özel anahtar var olmadan önce yazılan değerler için
  yalnızca şifre çözme yedeklemesi olarak tutulur ve `src/services/secretsMigration.js` bunları
  önyüklemede bir kez özel anahtar altında yeniden şifreler. Var olan ancak ayrıştırılamayan bir
  `.secret-key` sert bir önyükleme hatasıdır (asla sessizce yeniden oluşturulmaz). Şablonlar dışa
  aktarmada tüm sırları kaldırır.
- **`server.properties` panel tarafından yönetilir ancak env tarafından gölgelenir.** itzg görüntüsü,
  her başlangıçta her env destekli özelliği yeniden onaylar (`OVERRIDE_SERVER_PROPERTIES` varsayılan
  olarak doğrudur), bu nedenle panelin doğrudan düzenlediği bir değer - Dünya Kontrolleri PvP/zorluk,
  beyaz liste geçişi, Dosyalar düzenleyicisi - eşleşen env değişkeni kaldırılmadıkça ve kapsayıcı
  yeniden oluşturulmadıkça bir sonraki başlangıçta sessizce geri alınır. Her doğrudan özellik yazımı,
  `src/services/servers.js` içindeki `writeServerProperties()` (tüm dosya) veya
  `setServerProperty()` (bir anahtar) aracılığıyla gerçekleşir, bu da dosyayı atomik olarak yeniden
  yazar, değiştirilen her anahtarın arkasındaki env değişkenini kaldırır (katalog alanlarındaki
  `prop:` özniteliği aracılığıyla, görüntünün kendi özellik tanımlarına karşı testlerde kontrol
  edilir) ve `pending_recreate` bayrağını ayarlar. Zorluk, dosyaya yazıldığı gibi RCON üzerinden de
  gönderilir, çünkü özel bir sunucu her önyüklemede `difficulty` özelliğini yeniden uygular.
  Minecraft'ın kendisi, `whitelist on/off` üzerinde önyükleme zamanı değerlerinden server.properties'i
  yeniden kaydeder, bu da sunucu çalışırken yapılan düzenlemeleri geri alırdı, bu nedenle çalışan
  beyaz liste geçişi önce dosyayı anlık görüntüler ve yalnızca `white-list` değiştirilmiş olarak
  geri yazar. Env değişkenleri oluşturma sırasında tamamen yapılandırılabilir kalır (sihirbaz onları
  oluşturur ve bir kez uygulanırlar); yalnızca panel temel özelliği ilk kez düzenlediğinde sabitlemeyi
  kaldırırlar. MOTD aynı sözleşmedir: doğrudan bir `motd` dosya düzenlemesi onu kaldırır, bu nedenle
  son yazım kazanır.

## Veri ve kablo formatları

- **`data/panel.db`** - SQLite veritabanı. Günlük olarak `VACUUM INTO` aracılığıyla
  `data/backups/_panel/` içine anlık görüntülenir (en yeni 14'ü tutulur); `PRAGMA integrity_check`
  önyüklemede çalışır.
- **`data/.session-secret`** - `SESSION_SECRET` ayarlanmamışsa ilk çalıştırmada oluşturulan
  otomatik olarak oluşturulan çerez imzalama sırrı. Silinmesi sırrı döndürür (bu da oturumları
  geçersiz kılar).
- **`data/.secret-key`** - ilk çalıştırmada otomatik olarak oluşturulan özel 32 baytlık depolama
  şifreleme anahtarı (`0600` modu). `SESSION_SECRET`'ten bağımsızdır; silinmesi depolanan her
  kimlik bilgisini şifre çözülemez hale getirir, bu nedenle yedeklerinizle birlikte olmalıdır.
- **Şablonlar (`.mcserver.zip`)** - yapılandırmayı, kaynakları, sabitlenmiş paket referansını,
  katman manifestosunu (kaynak URL'leri + sha256), seçilen yapılandırma dosyalarını ve isteğe bağlı
  olarak bir dünyayı açıklayan bir `manifest.json` içeren bir zip. İçe aktarma, her modu yeniden
  indirir ve karma doğrulaması yapar ve yeni portlar atar.
- Panel tarafından oluşturulan **Docker kapsayıcıları** adlandırılır ve etiketlenir, böylece izleyici
  onları bulabilir; panel tüm yaşam döngülerini yönetir.

## Önyükleme sırası

1. Her şeyden önce `require('./instrument')` (Sentry dikişi), ardından desteklenmeyen bir Node
   sürümünde açıkça başarısız olmak için `require('./preflight')`.
2. Yapılandırmayı yükle; `.session-secret` **ve** `.secret-key`'yi sağla/oluştur.
3. `ensureDataRoot()` - `./data` düzenini oluştur, `tmp/`'yi sil.
4. DB geçişlerini çalıştır, ardından `PRAGMA integrity_check` (yüksek sesle günlüğe kaydeder,
   başarısızlık durumunda `data/backups/_panel`'i işaret eder).
5. Eski `SESSION_SECRET` anahtarlı sırları `.secret-key` altında yeniden şifrele (`secretsMigration`).
6. API anahtarlarını ortamdan bir kez içe aktar (`apiKeys.importFromEnvOnce()`), hala sabitlenmemiş
   bir mod paketi seçici taşıyan herhangi bir sunucuyu sabitle (`packPins.pinUnpinnedServers()`),
   önceki bir işlem tarafından çalışır durumda bırakılan sürüm uyumluluk taramalarını kesintiye
   uğramış olarak işaretle (`compat.reconcileScans()`), ardından başlangıç şablonlarını tohumla
   (korumalı).
7. HTTP + WS sunucusunu başlat. Açıkta bir bağlamada, ilk çalıştırma `/setup` PIN'ini yazdır.
8. Önyükleme sonrası çalışma zamanı koruyucusunu yükle (yakalanmayan hataları yakalar;
   `MSM_EXIT_ON_FATAL=1` denetimli dağıtımlar için sert çıkış yapar).
9. Arka plan hizmetlerini başlat: WS aracısı, depolama dizinleyici, çökme + envanter izleyicileri,
   zamanlayıcı, Discord olay köprüsü, sohbet botu erişim izleyicisi ve **günlük bakım zamanlayıcısı**
   (eski analiz satırlarını, sohbet botu transkriptlerini, olay geçmişini (365 gün) ve API önbellek
   satırlarını buda, ardından `panel.db`'yi anlık görüntüle).
10. Docker'ı **arka planda** başlat. Daemon kapalıyken UI tamamen kullanılabilir; Docker özellikleri
    erişilebilir hale geldiğinde yanar. Bağlandıktan sonra, `refreshStatuses({ boot })` önbelleğe
    alınmış durumları uzlaştırır, panel yeniden başlatılmadan önce çalışan ve geri getirilemeyecek
    bir sunucu için bir kerelik `offline-after-restart` olayı yayar ve önyükleme döngüsü
    `auto_start` sunucularını başlatır ve kesinti sırasında çökmüş bulunan `auto_restart`
    sunucularını kurtarır (çökme döngüsü geri çekilmesine saygı göstererek).

> Enstrüman-öncesi-ön kontrol sırası kasıtlı bir takasdır: gelecekteki bir Sentry kablolamasının
> çalışma zamanını önce yamalamasına izin verir, gerçekten eski bir Node'da biraz daha az dostça
> bir mesajın maliyetiyle.

## Derleme hattı

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, kod bölmeli ESM). `postinstall` **yalnızca CSS** çalıştırır. `public/css/app.css`
ve `public/dist/` gitignore edilmiş derleme yapıtlarıdır; Dockerfile derleme aşaması tam
`pnpm run build` komutunu çalıştırır ve `public/` dizinini çalışma zamanı görüntüsüne kopyalar.
Statik varlıklar parmak izli dosyalar için `immutable`/uzun önbellek, CSS/JS için kısa önbellek ve
HTML ve `/api` için `no-cache` olarak sunulur.
