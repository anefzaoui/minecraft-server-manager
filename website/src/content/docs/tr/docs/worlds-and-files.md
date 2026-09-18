---
title: 'Dünyalar ve dosyalar'
description: 'Dünyalar sayfası, sunucularınızdaki dünya verilerini yönetir: aktif dünyayı değiştirin, bir dünya yükleyin veya birini indirin.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Geri belgeler dizinine](/docs/)

## Dünyalar

**Dünyalar** sayfası, sunucularınızdaki dünya verilerini yönetir: aktif dünyayı değiştirin, bir dünya yükleyin veya birini indirin.

![Dünyalar](/docs/images/worlds.png)

## Dosya yöneticisi

Bir sunucunun **Dünya** bölümü altında, **Dosyalar** sekmesi, o sunucunun veri dizini için tam tarayıcı içi dosya yöneticisidir. Dosyaları listeleyin, okuyun, düzenleyin, oluşturun, yeniden adlandırın, taşıyın, kopyalayın, silin ve yükleyin: SSH üzerinden normalde yapacağınız her şeyi tarayıcıdan yapın.

![Dosya yöneticisi](/docs/images/server-files.png)

Metin dosyaları 2 MB sınırıyla bir düzenleyicide açılır; daha büyük dosyalar indirilebilir. Yüklemeler aynı anda birden fazla dosyayı kabul eder.

### Sandbox içinde kalmak

Her dosya işlemi, sunucunun kendi veri diziniyle sınırlıdır. Panel her yolu çözer ve dışarı çıkmaya neden olacak her şeyi reddeder: `..` geçişi, mutlak yollar ve hatta dizinin dışını işaret eden sembolik bağlantılar (henüz var olmayan sarkanlar dahil). Bir mod veya eklenti, dosya yöneticisini ana bilgisayarda başka bir yere okumaya veya yazmaya kandırmak için bir bağlantı ekleyemez.

## Modlar

Modlu sunucular için, **Modlar** sekmesi (sunucu kenar çubuğunda kendi grubu) mod setini yönetir: modları göz atın ve ekleyin ve nelerin yüklü olduğunu görün. Mod ve paket güncellemeleri [Güncellemeler](/docs/updates/) sayfasında görünür.

### Mod ekleme

![Modlar](/docs/images/mods.png)

Dört giriş yolu, hepsi Modlar sekmesi araç çubuğundan:

- **Modları ara** - **Modrinth veya CurseForge**'da arama yapın (CurseForge çipi Ayarlar → API anahtarları altında bir API anahtarı depolandığında görünür) ve eklenti sunucularında ayrıca **Hangar** (PaperMC'nin kendi eklenti kayıt defteri) ve **SpigotMC** (Spiget'in CDN proxy'si aracılığıyla) - her ikisi de anahtarsızdır. Her şey sunucunun yükleyicisi ve Minecraft sürümü için filtrelenir; Quilt sunucuları otomatik olarak fabric etiketli sürümleri de görür, çünkü Quilt Fabric modlarını çalıştırır. Sunucuda zaten bulunan sonuçlar bir **Yüklendi** rozeti gösterir. Bir CurseForge yazarı otomatik indirmelere izin vermezse - veya bir SpigotMC kaynağı siteden barındırılıyorsa - panel bunu önceden belirtir ve yükleme ortasında başarısız olmak yerine bir **Sayfayı aç** + **Jar yükle** yolu sunar.

  ![Hangar araması](/docs/images/mods-search-hangar.png)

- **Zip içe aktar** - tek düğme, üç şekil, otomatik algılama:
  - Bir **Modrinth mod paketi (`.mrpack`)**: sabitlenmiş her dosya, karma arama yoluyla Modrinth projesine geri dönüştürülür (böylece içe aktarılan modlar gerçek adlarını, simgelerini korur ve güncellenebilir kalır; Modrinth'in bilmediği dosyalar paketin kendi URL'sinden yüklenir), indirilirken paketin sha512 sağlama toplamlarına karşı doğrulanır ve uygunluk kararlarıyla önizlenir. Yalnızca istemciye yönelik dosyalar görünür şekilde atlanır ve her iki geçersiz kılma ağacı (`overrides/`, ardından `server-overrides/` - sunucuya özgü kopya kazanır) uygulanabilir.

    ![mrpack içe aktarma](/docs/images/mrpack-import.png)

  - Bir **CurseForge mod paketi dışa aktarma** (CurseForge uygulamasının ürettiği zip, `manifest.json` ile): sabitlenmiş her mod toplu olarak çözülür, uyarılarla önizlenir (bu sunucu için yanlış yükleyici/MC, artık CurseForge'da olmayan dosyalar, manuel indirme gerektiren modlar) ve gerçek ilerlemeyle yüklenir. Paketin `overrides/` (yapılandırmalar, komut dosyaları) isteğe bağlı olarak uygulanabilir - üzerine yazılacak herhangi bir dosya önce sunucu klasörünün içine `.import-backups/<zaman damgası>/` olarak yedeklenir.
  - Kendiniz topladığınız **jar'ların düz bir zip'i**: her jar tanımlanır (Modrinth karma eşleşmesi → CurseForge parmak izi → jar'ın kendi meta verileri) ve sunucuya karşı yargılanır - _uygun / yanlış yükleyici / yanlış MC sürümü / zaten yüklü / tanımlanamadı_ - böylece herhangi bir şey yüklenmeden önce gerçekten ait olanı seçersiniz.
- **Bağlantı ile ekle** - neredeyse her şeyi yapıştırın: Modrinth, CurseForge, Hangar veya SpigotMC proje sayfaları, bir GitHub deposu veya sürüm URL'si (yalnızca `sahip/repo` da çalışır - GitHub yüklemeleri en yeni kararlı sürümü tercih eder ve `-sources`/`-javadoc` yan jar'larını atlar), çıplak bir Modrinth slug'ı veya herhangi bir doğrudan `.jar` URL'si. Panel, sunucunun yükleyicisi ve MC sürümü için doğru yapıyı çözer.

  ![Bağlantı ile ekle](/docs/images/mods-add-by-link.png)

- **Jar yükle** (arama yedeklemesinden veya bekleyen indirme çözümleyicisinden) - yüklenen jar'lar aynı şekilde tanımlanır, böylece gerçek adlarını, sürümlerini, simgelerini korurlar ve güncellenebilir hale gelirler.

Her kayıt defteri yüklemesi, **indirilirken sağlama toplamı doğrulaması yapılır**: akış, kayıt defterinin yayınladığı en güçlü özetle (sha512 → sha256 → sha1 → md5) kontrol edilir ve bir eşleşmezlik, herhangi bir şey sunucuya inmeden iptal edilir.

Tüm bir zip (`.mrpack` dahil) ayrıca **bir sunucu oluşturabilir**: sihirbazın _Mod paketinden_ sekmesinde, onu ve paket bildirimini (veya tanımlanan jar'lar arasındaki çoğunluk oyu) yükleyin ve yükleyici, Minecraft sürümü ve yükleyici yapısını doldurur.
