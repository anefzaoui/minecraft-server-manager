---
title: 'Canlı harita'
description: 'Sunucunun dünyasının BlueMap canlı 3B haritasını tek tıkla etkinleştirin, yalnızca panelin oturum açma işlemi aracılığıyla sunulur.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Belgelere geri dön](/docs/)

Bir sunucunun **Dünya → Harita** sekmesi, [BlueMap](https://bluemap.bluecolored.de/) (ücretsiz ve açık kaynak) tarafından çizilen, oyuncu konumları ve her boyutu içeren, dünyanın canlı, yakınlaştırılabilir bir 3B haritasını gösterir. Panel onu kurar, yapılandırır ve sunar; bunun için asla bir port açmaz veya bir yapılandırma dosyasını düzenlemezsiniz.

## Açma

1. Sunucuyu açın, ardından **Dünya → Harita**.
2. **Canlı Haritayı Etkinleştir**'e basın. Panel, sunucunun yükleyicisi ve Minecraft sürümüyle eşleşen BlueMap yapısını Modrinth'ten kurar, BlueMap'in kaynak indirmesini sizin için kabul eder ve bunun için boş bir port seçer.
3. Sunucuyu yeniden başlatın (değişiklik bir sonraki başlatmada uygulanır ve sunucu bir sonraki başlatmayı bekliyor olarak işaretlenir).

BlueMap arka planda render yapar, bu nedenle yeni bir haritanın ilk döşemelerini çizmesi birkaç dakika sürer. O zamana kadar sekme, haritanın henüz hazır olmadığını söyler ve kendi kendine tekrar kontrol eder. Hazır olduğunda, **Tam Ekran** haritayı kendi tarayıcı sekmesinde açar.

Mod yükleyicisi olan sunucularda (Fabric, Quilt, Forge, NeoForge) ve eklenti sunucularında (Paper, Purpur ve Paper ailesinin geri kalanı, Spigot), modpack sunucuları dahil olmak üzere çalışır. Vanilla sunucularında BlueMap yapısı yoktur ve sekme bunu belirtir.

## Kimler görebilir

Harita yalnızca panel aracılığıyla, oturum açma arkasında sunulur: panelde sunucuyu görüntüleyebilen herkes haritasını açabilir ve başka hiç kimse açamaz. BlueMap'in kendi portu asla internete açılmak için tasarlanmamıştır ([portlara genel bakış](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Haritayı açmak veya kapatmak, sunucunun **Ayarlar** iznini gerektirir ([kullanıcılar ve roller](/docs/users-and-roles/#per-server-permissions)).

Panelin kendisi Docker'da çalıştığında, sunucunun kapsayıcısının içindeki BlueMap'e ulaşır; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) ters proxy kurulumları için ayrıntıları açıklar.

## Kapatma

**Haritayı Devre Dışı Bırak**, panelin kurduğu BlueMap jar'ını kaldırır ve portunu serbest bırakır, yine bir sonraki yeniden başlatmadan itibaren. Dünyanın kendisi dokunulmaz; render edilmiş harita döşemeleri, siz onları **Dosyalar** sekmesinden silene kadar sunucunun klasöründe kalır.

İlgili: [dünyalar ve dosyalar](/docs/worlds-and-files/), [davetler ve durum sayfası](/docs/invites-and-status-page/).
