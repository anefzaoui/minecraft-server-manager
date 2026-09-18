---
title: 'Blueprints'
description: 'Bir blueprint, bir sunucunun tüm yapılandırmasını (tür, sürüm, kaynaklar, ortam, paket sabitlemesi ve isteğe bağlı olarak yapılandırması ve dünyası) tek bir po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Dokümanlar dizinine dön](/docs/)

Bir **şablon**, bir sunucunun tüm yapılandırmasını (tür, sürüm, kaynaklar, ortam, paket sabitlemesi ve isteğe bağlı olarak yapılandırması ve dünyası) tek bir taşınabilir dosyaya kaydeder; bu dosyadan yeni sunucular oluşturabilirsiniz.

![Şablonlar](/docs/images/blueprints.png)

## Dışa Aktarma

Bir sunucudan, neleri dahil edeceğinizi seçerek bir şablon dışa aktarın: yapılandırma her zaman ve isteğe bağlı olarak yerleştirilmiş dosyalar ve dünya. Sonuç, şablon kitaplığınıza kaydedilir ve paylaşmak üzere indirilebilir.

## Şablondan İçe Aktarma ve Oluşturma

Orijinaliyle tam olarak aynı şekilde önceden yapılandırılmış yeni bir sunucu oluşturmak için bir şablon dosyası içe aktarın (veya kitaplıktan birini seçin). En hızlı yol şudur:

- Aynı sunucuları başlatmak (bir minigame sunucusu ağı, üretim ortamının hazırlık kopyaları).
- Bir sunucuyu paneller arasında taşımak.
- Her zaman geri dönebileceğiniz bilinen iyi bir şablonu saklamak.

Bir şablon, tam olarak [paket sabitlemesini](/docs/modpacks/) kaydettiği için, bir şablondan yeniden oluşturulan bir mod paketi sunucusu, sürpriz yükseltmeler olmadan aynı sabitlenmiş sürümü yükler.
