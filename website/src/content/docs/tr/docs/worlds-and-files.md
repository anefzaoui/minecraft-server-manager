---
title: 'Dünyalar & dosyalar'
description: 'Dünya kütüphanesi, dünya yüklemeleri ve değişimleri, modlar ve eklentiler sekmesi ve tarayıcı içi dosya yöneticisi.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Geri belgeler dizinine](/docs/)

## Dünyalar

**Dünyalar** sayfası, dünya kütüphanesidir: kaydedilmiş her dünya tek bir yerde. **Dünya Yükle**, bir `.zip` veya `.tar` arşivini alır ve içindeki dünyayı otomatik olarak bulur, **Kütüphaneye Kaydet** bir sunucunun canlı dünyasının anlık görüntüsünü alır (sunucu çalışırken çalışır) ve her kütüphane dünyası indirilebilir veya **... yükle** ile herhangi bir sunucuya kurulabilir. Kurulum, sunucunun dünyasını değiştirir (sunucu durdurulmalı ve mevcut dünyası önce yedeklenmelidir) veya daha sonra etkinleştirmek üzere yanına ekler. Her kurulumdan önce bir uyumluluk kontrolü çalışır.

Bir sunucunun kendi **Dünya → Dünyalar** sekmesi, o sunucudaki dünyaları listeler. Oradan başka bir dünyayı etkinleştirebilir (sunucu durdurulmuşken), indirebilir, çoğaltabilir, yeniden adlandırabilir veya bir dünyayı [küçültebilir](/docs/world-shrink/) , başka bir sunucuya kopyalayabilir, aktif olmayan birini silebilir ve aktif dünyayı yeni, tutulan veya özel bir tohumla sıfırlayabilirsiniz (önce bir güvenlik yedeği sunulur). Aynı kütüphane, **Buraya Yükle** ile aşağıda yer alır.

![Dünyalar](/docs/images/worlds.png)

## Dosya yöneticisi

Bir sunucunun **Dünya** bölümü altında, **Dosyalar** sekmesi, o sunucunun veri dizini için tam tarayıcı içi dosya yöneticisidir. Dosyaları listele, oku, düzenle, yeniden adlandır, taşı, kopyala, sil, yükle, klasör oluştur ve bir klasör altındaki dosyaların metnini **Dosyalarda Bul** ile ara: normalde SSH üzerinden yaptığınız her şey, tarayıcıdan.

![Dosya yöneticisi](/docs/images/server-files.png)

Metin dosyaları 8 MB sınırıyla bir düzenleyicide açılır; daha büyük dosyalar indirilebilir. Yüklemeler aynı anda 20 dosyaya kadar kabul eder.

### Korumalı alanda kalma

Her dosya işlemi, sunucunun kendi veri diziniyle sınırlıdır. Panel, her yolu çözer ve dışarı çıkacak herhangi bir şeyi reddeder: `..` geçişi, mutlak yollar ve hatta dizinin dışını işaret eden sembolik bağlantılar (henüz var olmayan sarkanlar dahil). Bir mod veya eklenti, dosya yöneticisini başka bir yere okumaya veya yazmaya kandırmak için bir bağlantı ekleyemez.

## Modlar

Modlu ve eklenti sunucuları için, **Modlar** sekmesi (sunucu kenar çubuğunda kendi grubu) mod setini yönetir: modları göz atın ve ekleyin ve nelerin yüklü olduğunu görün. Yüklü her modun satırından onu güncelleyebilir (veya bu güncellemeyi yok sayabilir), [geri alabilir](/docs/updates/#undoing-a-mod-update) , devre dışı bırakabilir veya kaldırabilir ve **Tümünü Güncelle** tek bir yeniden başlatmayla mevcut her güncellemeyi uygular. Mod ve paket güncellemeleri ayrıca [Güncellemeler](/docs/updates/) sayfasında da görünür.

### Mod ekleme

![Modlar](/docs/images/mods.png)

Dört giriş yolu, hepsi Modlar sekmesi araç çubuğundan:

- **Modları Ara**: **Modrinth veya CurseForge** (CurseForge çipi **Ayarlar → API Anahtarları** altında bir API anahtarı saklandığında görünür) ve eklenti sunucularında ayrıca **Hangar** (PaperMC'nin kendi eklenti kayıt defteri) ve **SpigotMC** (Spiget'in CDN proxy'si aracılığıyla), her ikisi de anahtarsız olarak aranır. Bir **Veri Paketleri** sekmesi Modrinth'in veri paketlerini arar. Her şey sunucunun yükleyicisine ve Minecraft sürümüne göre filtrelenir (bir onay kutusu, risk size ait olmak üzere uyumlu olarak listelenmeyen derlemeleri de gösterir); Quilt sunucuları otomatik olarak fabric etiketli derlemeleri de görür, çünkü Quilt Fabric modlarını çalıştırır. Sunucuda zaten bulunan sonuçlar bir **Yüklendi** rozeti gösterir. Bir CurseForge yazarı otomatik indirmelere izin vermezse (veya bir SpigotMC kaynağı siteden barındırılıyorsa), panel bunu önceden belirtir ve başarısız olmak yerine **CurseForge Aç** (veya **SpigotMC Aç**) + **Jar Yükle** yolunu sunar.

  ![Hangar araması](/docs/images/mods-search-hangar.png)

- **Zip İçe Aktar**: tek düğme, üç şekil, otomatik algılama:
  - Bir **Modrinth mod paketi (`.mrpack`)**: her sabitlenmiş dosya, karma arama yoluyla Modrinth projesine geri dönüştürülür (böylece içe aktarılan modlar gerçek adları, simgeleri korur ve güncellenebilir kalır; Modrinth'in bilmediği dosyalar paketin kendi URL'sinden yüklenir), indirilirken paketin sha512 sağlama toplamlarına karşı doğrulanır ve uygunluk kararlarıyla önizlenir. Yalnızca istemciye yönelik dosyalar görünür şekilde atlanır ve her iki geçersiz kılma ağacı da (`overrides/`, ardından `server-overrides/`; sunucuya özgü kopya kazanır) uygulanabilir.

    ![mrpack içe aktarma](/docs/images/mrpack-import.png)

  - Bir **CurseForge mod paketi dışa aktarma** (CurseForge uygulaması tarafından üretilen zip, `manifest.json` ile): sabitlenmiş her mod toplu olarak çözülür, uyarılarla önizlenir (bu sunucu için yanlış yükleyici/MC, artık CurseForge'da olmayan dosyalar, manuel indirme gerektiren modlar) ve gerçek ilerlemeyle yüklenir. Paketin `overrides/` (yapılandırmalar, komut dosyaları) isteğe bağlı olarak da uygulanabilir; üzerine yazılacak herhangi bir dosya önce sunucu klasörünün içinde `.import-backups/<zaman damgası>/` içine yedeklenir.
  - Kendiniz topladığınız **jar'ların düz bir zip'i**: her jar tanımlanır (Modrinth karma eşleşmesi → CurseForge parmak izi → jar'ın kendi meta verileri) ve sunucuya karşı yargılanır (_uyar / yanlış yükleyici / yanlış MC sürümü / zaten yüklü / tanımlanamadı_), böylece herhangi bir şey yüklenmeden önce gerçekten ait olanı seçersiniz.
- **URL ile Ekle**: neredeyse her şeyi yapıştırın: Modrinth, CurseForge, Hangar veya SpigotMC proje sayfaları, bir GitHub deposu veya sürüm URL'si (yalnızca `sahip/repo` da çalışır; GitHub yüklemeleri en yeni kararlı sürümü tercih eder ve `-sources`/`-javadoc` yan jar'larını atlar), çıplak bir Modrinth slug'ı veya herhangi bir doğrudan `.jar` URL'si. Panel, sunucunun yükleyicisi ve MC sürümü için doğru derlemeyi çözer.

  ![Bağlantı ile ekle](/docs/images/mods-add-by-link.png)

- **Jar Yükle** (arama yedeklemesinden veya bekleyen indirmeler çözümleyicisinden): yüklenen jar'lar aynı şekilde tanımlanır, böylece gerçek adlarını, sürümlerini, simgelerini korurlar ve güncellenebilir hale gelirler.

Her kayıt defteri yüklemesi **indirilirken sağlama toplamı doğrulanır**: akış, kayıt defterinin yayınladığı en güçlü özetle (sha512 → sha256 → sha1 → md5) kontrol edilir ve bir eşleşmezlik, herhangi bir şey sunucuya inmeden önce iptal edilir.

Tüm bir zip (`.mrpack` dahil) ayrıca **bir sunucu oluşturabilir**: sihirbazın **Mod Paketinden** sekmesinde, onu yükleyin ve paket bildirimi (veya tanımlanan jar'lar arasında çoğunluk oyu) yükleyiciyi, Minecraft sürümünü ve yükleyici derlemesini doldurur.
