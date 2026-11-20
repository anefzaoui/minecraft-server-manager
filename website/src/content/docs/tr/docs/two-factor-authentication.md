---
title: 'İki faktörlü kimlik doğrulama'
description: 'İki faktörlü kimlik doğrulama (2FA), oturum açmaya ikinci bir adım ekler: parolanızdan sonra telefonunuzdaki bir kimlik doğrulama uygulamasından kısa bir kod girersiniz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Geri dön belgeler dizinine](/docs/)

İki faktörlü kimlik doğrulama (2FA), oturum açmaya ikinci bir adım ekler: parolanızdan sonra, telefonunuzdaki bir kimlik doğrulama uygulamasından kısa bir kod girersiniz. Birisi parolanızı öğrense bile, cihazınız olmadan giremez.

Herhangi bir standart TOTP kimlik doğrulama uygulamasıyla (Google Authenticator, Authy, 1Password, Microsoft Authenticator ve diğerleri) çalışır ve yalnızca yöneticiler değil, **her** hesap için kullanılabilir. Kendi oturumunuzu korumak bir sunucu yönetimi eylemi değildir, bu nedenle izleyiciler ve operatörler de bunu etkinleştirebilir.

## 2FA'yı Etkinleştirme

Hesap menüsünü (başlangıç veya profil resminiz, sağ üst köşe) açın ve **2FA**'yı seçin.

![Hesap menüsü](/docs/images/2fa-user-menu.png)

Bir kayıt iletişim kutusu alacaksınız:

![Kayıt](/docs/images/2fa-enroll.png)

1. Kimlik doğrulama uygulamanızla **QR kodunu tarayın** veya **Kopyala**'ya dokunup anahtar anahtarını elle girin.
2. Uygulamanızın şimdi gösterdiği **6 haneli kodu** yazın.
3. **Parolanızı onaylayın.** 2FA'yı etkinleştirmek parolanızı yeniden kontrol eder, bu nedenle yanlışlıkla açık bir oturum başkasının cihazıyla etkinleştiremez.
4. **Etkinleştir**'e tıklayın.

### Yedek kodlarınızı kaydedin

2FA etkinleştirildiği anda, panel tek kullanımlık **yedek kodlar** bir dizi gösterir.

![Yedek kodlar](/docs/images/2fa-backup-codes.png)

Her kod, kimlik doğrulama uygulamanıza erişimi kaybederseniz oturum açmak için **bir kez** çalışır. Tekrar gösterilmeyecekleri için güvenli bir yere kaydedin (bir parola yöneticisi idealdir). Herhangi bir zamanda yeni bir dizi oluşturabilirsiniz (bu, eskileri geçersiz kılar).

## 2FA ile Oturum Açma

O andan itibaren, oturum açma ikinci bir adıma sahip olur. Kullanıcı adınız ve parolanızdan sonra, panel kodunuzu ister:

![2FA oturum açma](/docs/images/2fa-login-challenge.png)

Uygulamanızdan geçerli 6 haneli kodu (veya yedek kodlarınızdan birini) girin ve hazırsınız. Bu adımı tamamlayana kadar oturum **açılmamıştır**: hiçbir sayfaya veya API'ye erişemez.

## 2FA'yı Yönetme veya Kapatma

Etkinleştirildiğinde hesap menüsündeki aynı **2FA** girişini açın. Parolanızı onayladıktan sonra şunları yapabilirsiniz:

- **Yedek Kodları Yeniden Oluştur** yeni bir dizi yayınlar ve eskileri emekliye ayırır.
- **2FA'yı Devre Dışı Bırak** hesabınızdan kaldırır.

Her ikisi de önce geçerli parolanızı yeniden kontrol eder.

## Telefonunuzu _ve_ yedek kodlarınızı mı kaybettiniz?

Bir **yönetici**, **Ayarlar → Kullanıcılar**'dan başka bir kullanıcının 2FA'sını sıfırlayabilir (o kullanıcının eylemler menüsünde **2FA'yı Sıfırla**). Bu, kullanıcının yalnızca parolasını kullanarak oturum açıp yeniden kurabilmesi için hesap için 2FA'yı temizler. Yöneticiler kendi 2FA'larını parola olmadan sıfırlayamazlar. Normal parola korumalı devre dışı bırakma işlemini yaparlar, böylece ele geçirilen bir yönetici oturumu kendi ikinci faktörünü kaldıramaz.

## Bilmekte Fayda Var

- Kodlar zamana dayalıdır ve her 30 saniyede bir döner; panel küçük bir saat sapmasına izin verir ve sunucunun saati daha sonra düzeltilirse sessizce kurtarılır.
- Bir kod tekrar kullanılamaz: oturum açmak için kullanıldıktan sonra, aynı kod penceresi içinde tekrar çalışmaz.
- Yanlış kodlar hız sınırlıdır. Sınırlayıcı, parola adımıyla **paylaşılır** (hesap başına bir kilitleme artı IP başına `RATE_LIMIT_AUTH_PER_15MIN` sınırlayıcı), bu nedenle doğru bir parola girmek, 6 haneli kodu tahmin etmeden hemen önce sayacı sıfırlayamaz.
- 2FA değişiklikleri (etkinleştirme, devre dışı bırakma, sıfırlama, yedek kod kullanımı) hepsi [Etkinlik günlüğünde](/docs/activity/) kaydedilir.
