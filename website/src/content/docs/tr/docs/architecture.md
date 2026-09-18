---
title: 'Mimari'
description: 'Minecraft Server Manager, tek süreçli, sunucu taraflı oluşturulan bir Node.js uygulamasıdır.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Geri belgeler dizinine](/docs/)

Minecraft Server Manager, tek süreçli, sunucu taraflı işlenen bir Node.js uygulamasıdır. Docker kapsayıcıları olarak çalışan Minecraft sunucularını,
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) görüntüsünü kullanarak yönetir ve Docker cinine API üzerinden (asla `docker` CLI'ını kabuk komutuyla çalıştırmaz) konuşur.

## Çalışma Zamanı Yapısı

- **Express + Handlebars** sayfaları sunucu tarafında işler. Tek Sayfa Uygulaması (SPA) yoktur; `public/js/` içindeki tarayıcı JS'si elle yazılmış aşamalı bir geliştirmedir. Bir esbuild adımı (`pnpm run build:js`) bunu paketler ve `public/dist/js/` içine küçültür; uygulama mevcut olduğunda bu paketi ve aksi takdirde ham kaynağı sunar, böylece bir derleme olmadan geliştirme çalıştırması da çalışır.
- **`node:sqlite`** (Node'a yerleşik; panel Node ≥ 24 gerektirir) veritabanıdır - senkron, sıfır yerel modül, WAL modu. Küçük sürümlü bir geçiş çalıştırıcısı, önyüklemede `src/db/migrations/*` uygular. Hazırlanmış ifadeler SQL metnine göre anahtarlanan `src/db/index.js` içinde önbelleğe alınır.
- **`ws`** canlı konsol ve istatistik akışlarını taşır. Her ikisi de **aracılıdır**: sunucu başına bir yukarı akış `docker logs --follow` (veya `docker stats`) (bir kez ayrıştırılır ve her bağlı sekmeye yayılır), görüntüleyen başına bir yukarı akış yerine. Konsol aracısı, geç katılan sekmeler için küçük bir tekrar oynatma arabelleği tutar ve paylaşılan akışı yavaşlatmak yerine çok geride kalan bir abonenin soketini düşürür.
- **dockerode**, uygulamanın Docker ile konuştuğu tek yoldur. Uç nokta platforma göre otomatik olarak algılanır (Windows adlandırılmış kanal vs. unix soketi).
- **Tüm kalıcı durum tek bir dizin altında yaşar** (`$DATA_DIR`, varsayılan `./data`). Bu dizini kopyalamak tüm paneli taşır.

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

- **`web/routes/`** - alan başına bir yönlendirici (`servers`, `players`, `worlds`, `crashes`, `blueprints`, `files`, …), `web/app.js` içinde monte edilir. Yönlendiriciler zod ile doğrular, bir hizmeti çağırır ve JSON döndürür veya bir görünüm işler. İş mantığı buraya ait değildir. İki yönlendirici **genel bölgede**, `requireAuth` öncesinde monte edilir: `routes/status.js` (sunucu başına isteğe bağlı HTML durum sayfaları) ve `routes/apiV1.js` (`/api/v1`, `services/apiTokens.js`'den yönetici tarafından basılmış bir Bearer belirteciyle kimliği doğrulanmış salt okunur bir JSON API, Ayarlar'da etkinleştirilmedikçe kapalıdır; bkz. `docs/public-api.md`).
- **`services/`** - uygulamanın kalbi. Her hizmet bir alana sahiptir ve altyapıya ve diğer hizmetlere bağımlı olabilir.
- **`docker/`** - dockerode sarmalayıcıları: `connect` (uç nokta algılama + cin sağlığı), `containers` (bağlama bağları, bellek/CPU sınırları ve etiketlerle oluşturma/başlatma/durdurma/yeniden oluşturma), `logs`, `stats`, `images` ve Docker olaylarını geçmiş + çökme tespitine dönüştüren bir `watcher`.
- **`db/`** - SQLite sarmalayıcısı ve geçiş çalıştırıcısı.
- **`storage/`** - `./data` önyüklemesi, **yol koruması** (`safeJoin`, dosya güvenliği omurgası) ve arka plan boyut-indeksleyici + kota zorlaması.

Kesitler:

- **`config/`** - ortam yapılandırması artı **alan kataloğu**: sunucu ayarları için tek doğruluk kaynağı. Her itzg ortam değişkeni kataloglanır (etiket, yardım, tür, birim, varsayılan, doğrulama, bölüm, tehlike bayrakları). Sihirbaz, ayarlar formları ve zod doğrulaması hepsi bundan türetilir, bu nedenle yeni bir ayar sunmak yeni bir UI tesisatı değil, bir veri değişikliğidir.
- **`events/`** - `recordEvent()` geçmiş günlüğü için tek giriş noktasıdır; yaşam döngüsü olayları ayrıca kapsayıcı-günlük alıntılarını `data/logs/<id>/events/` içine yakalar.
- **`ws/`** - kimliği doğrulanmış konsol + istatistik WebSockets (yükseltmede doğrulanan oturum çerezi, çapraz site kaçırma girişimlerini engellemek için kontrol edilen `Origin`), sunucu başına aracılı (bkz. "Çalışma Zamanı Yapısı").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` modül başına bir [Pino](https://getpino.io) günlükleyici döndürür; `LOG_LEVEL`'den seviye, `makeFailureThrottle()` sürekli başarısız olan bir arka plan döngüsünü tek bir günlük satırına artı bir "kurtarıldı" satırına tutar. `src/utils/logSanitize.js` yapılandırılmış meta verilerden kimlik bilgisi şeklindeki anahtarları ve webhook belirteçlerini sansürler; `src/config/logLevel.js` paylaşılan seviye izin listesidir (günlükleyici mevcut olmadan önce çalıştığı için gereksiz bir döngüden kaçınmak üzere ayrı tutulur). `src/instrument.js` uykuda bir Sentry dikişidir, `src/server.js`'de ilk yüklenir. `src/web/middleware/requestLog.js` istek başına tek bir erişim günlüğü satırı yazar (`/healthz` ve statik varlıkları atlar). ESLint, `src/**` altında `no-console`'u zorlar, `preflight.js`, `instrument.js` ve `config/index.js` muaf tutulur (günlükleyici mevcut olmadan önce çalışırlar).
- **Hız sınırlama** - `src/web/middleware/rateLimit.js`, `express-rate-limit`'i `/api` (`RATE_LIMIT_API_PER_MIN`, varsayılan 1200) ve oturum açma / 2FA / kurulum POST'larının (`RATE_LIMIT_AUTH_PER_15MIN`, varsayılan 100) önüne yerleştirir; `0` bir sınırlayıcıyı devre dışı bırakır. `req.ip`'ye göre anahtarlanır, bu nedenle bir proxy arkasında `TRUST_PROXY` önemlidir. `/api/v1`'in kendi sunucu başına belirteç sınırlayıcısı vardır (`RATE_LIMIT_PUBLIC_API_PER_MIN`, varsayılan 120), Bearer belirtecinin bir karmasına göre anahtarlanır ve IP yedeklemesi vardır. `src/web/middleware/auth.js` içindeki ayrı bir sunucu başına yumuşak sayaç, oturum açma kilitlemesini (sunucu başına IP ve hesap genelinde, azalan) işler.

## Ana Alan Davranışları

- **Mod paketleri her zaman sabitlenir.** Görüntü, yeniden başlatma sırasında sabitlenmemiş paketleri otomatik olarak yükseltir, bu nedenle panel "en son" sürümü kurulum zamanında somut bir sürüm kimliğine çözer ve sabitler. Yükseltmeler açıkça düzenlenmiş bir akıştır (`updates/`): önizleme → güncelleme öncesi yedekleme → zarif durdurma → yeniden sabitleme → yeniden oluşturma → sağlık izleyici → tek tıklamayla geri alma.
- **Özel mod kaplaması** panel tarafından yönetilir: kullanıcı tarafından eklenen modlar tekilleştirilmiş kütüphaneye iner ve sunucuya sabitlenir, böylece paket güncellemelerinden sağ çıkarlar. Devre dışı bırakma sınıf bilincidir.
- **Bağlantı noktaları** bir temel şemadan (oyun `PORT_GAME_START`'tan yukarı, RCON = oyun + `PORT_RCON_OFFSET`, Bedrock `PORT_BEDROCK_START`'tan) tahsis edilir, kullanılabilirlik için taranır ve veritabanında rezerve edilir.
- **Disk kotaları** panel tarafından zorlanır çünkü Docker bağlama bağlarının kullanımını sınırlayamaz: indeksleyici dizin başına boyutları önbelleğe alır ve disk büyütme işlemleri bunlara göre engellenir.
- **Gizli bilgiler** (RCON şifreleri, API anahtarları, TOTP sırları, Discord webhook URL'si) `$DATA_DIR/.secret-key`'de (mod `0600`, otomatik oluşturulmuş) özel, rastgele bir anahtar kullanılarak AES-256-GCM ile depolama sırasında şifrelenir. `SESSION_SECRET`'ten bağımsızdır; `SESSION_SECRET`-türetilmiş bir anahtar, özel anahtar mevcut olmadan önce yazılan değerler için yalnızca şifre çözme amaçlı bir yedek olarak tutulur ve `src/services/secretsMigration.js` önyüklemede bir kez bu değerleri özel anahtar altında yeniden şifreler. Mevcut ancak ayrıştırılamayan bir `.secret-key` sert bir önyükleme hatasıdır (asla sessizce üzerine yazılmaz). Blueprint'ler dışa aktarımda tüm gizli bilgileri kaldırır.

## Veri ve Tel Formatları

- **`data/panel.db`** - SQLite veritabanı. Günlük olarak `VACUUM INTO` aracılığıyla `data/backups/_panel/`'e anlık görüntülenir (en yenisi 14 tane tutulur); önyüklemede `PRAGMA integrity_check` çalışır.
- **`data/.session-secret`** - otomatik oluşturulan çerez imzalama sırrı, ilk çalıştırmada `SESSION_SECRET` ayarlanmamışsa oluşturulur. Silinmesi sırrı döndürür (oturumları geçersiz kılar).
- **`data/.secret-key`** - özel 32 baytlık depolama şifreleme anahtarı (mod `0600`), ilk çalıştırmada otomatik oluşturulur. `SESSION_SECRET`'ten bağımsızdır; silinmesi, depolanan her kimlik bilgisini şifrelenemez hale getirir, bu nedenle yedeklerinizle birlikte saklanmalıdır.
- **Blueprint'ler (`.mcserver.zip`)** - yapılandırmayı, kaynakları, sabitlenmiş paket referansını, kaplama manifestini (kaynak URL'leri + sha256), seçilen yapılandırma dosyalarını ve isteğe bağlı olarak bir dünyayı açıklayan bir `manifest.json` içeren bir zip. İçe aktarma, her modu yeniden indirir ve karma doğrulamasını yapar ve yeni bağlantı noktaları atar.
- Panel tarafından oluşturulan Docker kapsayıcıları, izleyicinin onları bulabilmesi için adlandırılır ve etiketlenir; panel tam yaşam döngülerinden sorumludur.

## Önyükleme Sırası

1. Her şeyden önce `require('./instrument')` (Sentry dikişi), ardından desteklenmeyen bir Node sürümünde net bir şekilde hata vermek için `require('./preflight')`.
2. Yapılandırmayı yükleyin; `.session-secret` **ve** `.secret-key`'yi sağlayın/oluşturun.
3. `ensureDataRoot()` - `./data` düzenini oluşturun, `tmp/`'yi silin.
4. Veritabanı geçişlerini çalıştırın, ardından `PRAGMA integrity_check` (yüksek sesle günlüğe kaydeder, hatada `data/backups/_panel`'i işaret eder).
5. Eski `SESSION_SECRET`-anahtarlı gizli bilgileri `.secret-key` altına yeniden şifreleyin (`secretsMigration`).
6. Başlangıç blueprint'lerini ekleyin (korumalı).
7. HTTP + WS sunucusunu başlatın. Açık bir bağda, ilk çalıştırma `/setup` PIN'ini yazdırın.
8. Önyükleme sonrası çalışma zamanı koruyucusunu yükleyin (yakalanmayan hataları yakalar; `MSM_EXIT_ON_FATAL=1` denetimli dağıtımlar için sert çıkış yapar).
9. Arka plan hizmetlerini başlatın: WS aracısı, depolama indeksleyici, çökme + envanter izleyicileri, zamanlayıcı, Discord olay köprüsü ve **günlük bakım zamanlayıcısı** (eski analitik satırlarını temizler + `panel.db`'yi anlık görüntüler).
10. Docker'ı **arka planda** başlatın. Daemon kapalıyken UI tamamen kullanılabilir; Docker özellikleri erişilebilir hale geldiğinde ışıklandırılır. Bağlandıktan sonra, `refreshStatuses({ boot })` önbelleğe alınmış durumları yeniden düzenler, panel yeniden başlatılmadan önce açık olan ve geri getirilmeyecek bir sunucu için tek seferlik bir `offline-after-restart` olayı yayar ve önyükleme döngüsü, önyükleme sırasında çökmüş bulunan `auto_start` sunucularını başlatır ve `auto_restart` sunucularını kurtarır (çökme-döngü geri beslemesini dikkate alarak).

> Enstrüman-öncesi-ön kontrol sırası kasıtlı bir ödünleşmedir: gelecekteki bir Sentry kablolama yaması çalışma zamanını ilk önce yamalamasına izin verir, maliyeti ise gerçekten eski bir Node'da biraz daha az samimi bir mesajdır.

## Derleme Hattı

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild → `public/dist/js/`, kod bölmeli ESM). `postinstall` **yalnızca CSS** çalıştırır. `public/css/app.css` ve `public/dist/` git'e göz ardı edilen derleme artefaktlarıdır; Dockerfile derleme aşaması tam `pnpm run build`'i çalıştırır ve `public/`'yi çalışma zamanı görüntüsüne kopyalar. Statik varlıklar parmak izli dosyalar için `immutable`/uzun önbellek, CSS/JS için kısa önbellek ve HTML ve `/api` için `no-cache` olarak sunulur.
