---
title: 'Şablonlar'
description: 'Şablonlar, yeni sunucular oluşturmak için yeniden kullanılabilir bir tarif olarak Minecraft sunucusunun tüm yapılandırmasını kaydeder. Sırlar asla dahil edilmez.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Dokümanlar dizinine dön](/docs/)

Bir **şablon**, bir sunucunun tüm yapılandırmasını (tür, sürüm, kaynaklar, ortam, paket sabitlemesi, özel modlar ve isteğe bağlı olarak yapılandırması ve dünyası) taşınabilir tek bir `.mcserver.zip` dosyasına kaydeder; bu dosyadan yeni sunucular oluşturabilirsiniz. Sırlar (ortamdaki parolalar, jetonlar ve anahtarlar) asla bir şablona yazılmaz.

![Şablonlar](/docs/images/blueprints.png)

## Dışa Aktarma

Bir sunucunun **Ayarlar → Yapılandırma** sekmesinden, **Şablon Olarak Dışa Aktar** seçeneğini kullanın ve neleri dahil edeceğinizi seçin: her zaman sunucunun yapılandırması, yapılandırma dizinleri (varsayılan olarak açık) ve isteğe bağlı olarak özel mod dosyalarının kendileri (her şeyi indirmeden kurulan daha büyük bir dosya) ve aktif dünya. Sonuç, şablon kitaplığınıza kaydedilir ve paylaşmak üzere indirilebilir.

Aynı karttaki **Sunucuyu Klonla**, dünyasıyla veya dünyası olmadan sunucunun bir kopyasını oluşturmak için tek adımda dışa aktarma ve içe aktarma işlemi yapar.

## Bir şablondan içe aktarma ve oluşturma

Bir şablon dosyasını içe aktarın (**Şablonlar** sayfasındaki **Şablon İçe Aktar**) veya yeni bir sunucu oluşturmak için kitaplıktan birini seçin (kartındaki **Sunucu Oluştur** veya sihirbazın **Şablondan** sekmesi), orijinaliyle tam olarak aynı şekilde önceden yapılandırılmış olarak. Yeni sunucu kendi bağlantı noktalarını ve yeni bir RCON parolasını alır. Gömülü olmayan özel modlar, şablonun kaydettiği karma değerlere karşı tekrar indirilir ve kontrol edilir. Kitaplık ayrıca biri Paper ve biri Fabric olmak üzere iki başlangıç şablonuyla başlar.

Aşağıdakiler için en hızlı yoldur:

- Birebir aynı sunucuları başlatmak (oyun sunucuları ağı, üretim ortamlarının test kopyaları).
- Bir sunucuyu paneller arasında taşımak.
- Her zaman geri dönebileceğiniz bilinen iyi bir şablonu saklamak.

Bir şablon, tam olarak [paket sabitlemesini](/docs/modpacks/) kaydettiği için, bir şablondan oluşturulan bir mod paketi sunucusu, sürpriz yükseltmeler olmadan aynı sabitlenmiş sürümü yükler.
