---
title: 'Kullanıcılar ve roller'
description: 'Panel çok kullanıcılıdır.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Geri dön](/docs/)

Panel çok kullanıcılıdır. Hesapları **Ayarlar → Kullanıcılar** altından yönetin.

![Kullanıcılar](/docs/images/settings-users.png)

## Üç rol

| Rol          | Ne yapabilir                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Her şeyi: kullanıcıları, API anahtarlarını, genel dosyaları, gelişmiş Docker geçersiz kılmalarını ve her sunucu eylemini yönetir.                      |
| **operator** | Sunucuları çalıştırır ve yapılandırır (başlat/durdur, konsol, yedeklemeler, dünyalar, modlar, çoğu ayar), ancak yalnızca yönetici alanlarına erişemez. |
| **viewer**   | Salt okunur. Sunucuları ve durumlarını görür, ancak değişiklik yapamaz.                                                                                |

Bir görüntüleyici dahil her kullanıcı, kendi [iki faktörlü kimlik doğrulamasını](/docs/two-factor-authentication/) yönetebilir, çünkü kendi oturumunu korumak bir sunucu yönetimi eylemi değildir.

## Yalnızca yöneticilere özel ve neden

Birkaç şey kasıtlı olarak yöneticilere kısıtlanmıştır:

- **Kullanıcı yönetimi, API anahtarları ve genel dosyalar.**
- **[Genel API](/docs/public-api/)** - `/api/v1`'i etkinleştirme ve salt okunur Bearer belirteçleri oluşturma, kapsam belirleme veya iptal etme.
- **Gelişmiş Docker geçersiz kılmaları** - özel kapsayıcı adı, ek port yayınları ve bağlama noktaları. Bir bağlama noktası, herhangi bir ana bilgisayar yolunu bir kapsayıcıya eşleyebilir ve panelin Docker erişimiyle birleştiğinde bu, ana bilgisayarda etkili bir şekilde root yetkisi verir. Bu alanlar yalnızca yöneticiler için görünür.

Özel kapsayıcı adları, panelin kendi `msm-` ad alanında yaşayamaz, bu nedenle elle adlandırılmış bir kapsayıcı asla başka bir sunucunun kapsayıcısını gölgeleyemez ve durdurma veya komutu yanlış örneğe yönlendiremez.

## Hesap yönetimi

![Profil resmi](/docs/images/profile-picture.png)

Yöneticiler, Kullanıcılar tablosundan kullanıcı oluşturabilir, rolleri değiştirebilir, şifreleri sıfırlayabilir ve hesapları silebilir. **2FA** sütunu, her kullanıcının iki faktörlü kimlik doğrulamasının etkin olup olmadığını gösterir; bir yönetici, başka bir kullanıcının 2FA'sını sıfırlayabilir (kayıp telefon ve yedek kodlar durumu için), ancak kendi hesabını şifresi olmadan asla devre dışı bırakamaz; bu işlem kendi kendine hizmet akışı tarafından halledilir.

Başarısız oturum açmalar, kaba kuvvet denemelerini yavaşlatmak için hesap başına hız sınırlıdır (hem IP başına hem de hesap genel sayacı olarak) ve aynı sınır 2FA kodu adımını da kapsar, böylece doğru bir şifre kod tahmininden önce sayacı sıfırlayamaz. Bunun önünde, oturum açma / 2FA / kurulum uç noktalarında daha kaba bir istemci IP başına istek sınırlayıcısı bulunur ve bu, `RATE_LIMIT_AUTH_PER_15MIN` (varsayılan 100; ters proxy arkasında, gerçek istemci IP'sini anahtarlamak için `TRUST_PROXY`'yi ayarlayın) ile ayarlanabilir.
