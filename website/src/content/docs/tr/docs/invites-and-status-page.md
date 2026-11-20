---
title: 'Davetler ve Durum Sayfası'
description: 'Arkadaşlarınızı sunucu adresi, sürümü ve bir istemci mod paketi ile sunucuya davet edin ve yalnızca sizin seçtiğiniz bilgileri gösteren herkese açık bir durum sayfası paylaşın.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Dokümanlar dizinine dön](/docs/)

Bir sunucunun **Ayarlar** grubundaki iki sekme, oyuncuların sunucuyu bulmasına ve bağlanmasına yardımcı olur: **Davetler**, bir arkadaşın bağlanması için gereken her şeyi yazar ve **Durum Sayfası**, sunucunun açık olup olmadığını gösteren küçük bir genel sayfa yayınlar. Her ikisi de sunucunun **Ayarlar** iznini gerektirir ([kullanıcılar ve roller](/docs/users-and-roles/#per-server-permissions)).

## Davetler

**Ayarlar → Davetler**, bir **Arkadaş Davet Et** kartına sahiptir:

- **Paylaşılacak Adres**, makinenizin yerel ağdaki adreslerini sunucunun oyun bağlantı noktasıyla, panelin algılayabildiği genel adresinizi (ağ dışındaki oyuncular yalnızca bağlantı noktası yönlendirme yoluyla ulaşabilir) ve kendiniz ayarladığınız alan adı veya adres için **Özel adres…**, örneğin `play.example.com:25565`'i listeler.
- **Davet Metni**, sunucunun adını, seçtiğiniz adresi, Minecraft sürümünü ve türünü içeren, yapıştırılmaya hazır bir mesajdır. **Davet Metnini Kopyala**, bunu panoya koyar. Beyaz liste açık olduğunda, metin arkadaşlardan Minecraft kullanıcı adlarını ister ve kart, her arkadaşı katılmadan önce **Oyuncular** sekmesinde eklemeniz gerektiğini hatırlatır.
- **Arkadaşların İhtiyacı Olanlar**, oyuncu tarafında ne gerektiğini söyler: vanilla veya eklenti sunucusu (Paper ve benzerleri) için doğru Minecraft sürümü, ya da modlu bir sunucu için sunucunun modları.

### İstemci mod paketi

Modlu bir sunucuda kart ayrıca **İstemci Mod Paketini İndir (.mrpack)** seçeneğini sunar. Arkadaşlar bunu Prism Launcher veya Modrinth Uygulamasına aktarır, bu da sunucunun Minecraft sürümünü ve mod yükleyicisini yükler, modları indirir ve seçtiğiniz adresle birlikte sunucuyu çok oyunculu listelerine ekler.

Dosya, sunucuya kendiniz eklediğiniz (özel mod kaplaması) ve Modrinth'ten gelen modlardan oluşturulur. Başka yerlerden gelen modlar bunun yerine kartta listelenir, böylece arkadaşlar bu dosyaları elle `mods` klasörlerine ekleyebilir. Bir mod paketinden oluşturulan bir sunucuda, arkadaşlar bu paketi, sunucunun çalıştığı sürümde, başlatıcılarına yüklemelidir; **Genel Bakış** sekmesi sürümü gösterir.

### İnternet üzerinden oynamak

Kartın altındaki **İnternet üzerinden oynamak (bağlantı noktası yönlendirme)**, yönlendirici tarafını açıklar: sunucunun oyun bağlantı noktasını (TCP ve UDP) paneli çalıştıran makineye yönlendirin, ardından genel adresinizi bağlantı noktasıyla paylaşın. İnternet servis sağlayıcınız CGNAT kullanıyorsa, bağlantı noktası yönlendirme çalışmaz ve bir tünel hizmeti (örneğin playit.gg) giriş yoludur. Panel, yönlendirici bağlantı noktalarını kendi başına açmaz. Yalnızca oyun bağlantı noktaları internette olmalıdır; panelin kendi bağlantı noktasını ve RCON bağlantı noktalarını kapalı tutun ([bağlantı noktalarına genel bakış](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Durum Sayfası

**Ayarlar → Durum Sayfası**, varsayılan olarak kapalı olan bir sunucu için genel bir sayfayı açar:

1. Kartı açın.
2. **Sayfa Adresi**'ni seçin: sayfa panelinizde `/status/<adres>` adresinde bulunur ve adres, sunucularınız arasında benzersiz, 3 ila 40 küçük harf, rakam veya kısa çizgiden oluşur.
3. **Kaydet**'e basın. **Sayfayı Aç** ve **Bağlantıyı Kopyala** daha sonra paylaşacağınız bağlantıyı size verir.

Bağlantıya sahip herkes sunucunun adını, MOTD'sini, sürümünü, çalışıp çalışmadığını, oyuncu sayısını ve çalışma süresini görür ve başka hiçbir şey görmez. Sayfanın panele bir bağlantısı yoktur ve oturum açma gerektirmez. Panel belleğindeki durumu okur, bu nedenle ziyaretçiler Docker arka plan programında asla iş yükü oluşturmaz.

Sayfayı kapatmak adresini saklar, bu nedenle tekrar açmak aynı bağlantıyı geri yükler. Kendi sayfanız veya botunuz için, [genel API](/docs/public-api/) JSON olarak aynı türde durumu döndürür.

İlgili: [Discord bildirimleri](/docs/integrations/), [canlı harita](/docs/live-map/), [sunucu oluşturma ve yönetme](/docs/servers/).
