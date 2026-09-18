---
title: 'İki faktörlü kimlik doğrulama'
description: 'İki faktörlü kimlik doğrulama (2FA), oturum açmaya ikinci bir adım ekler: parolanızdan sonra telefonunuzdaki bir kimlik doğrulama uygulamasından kısa bir kod girersiniz.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Dokümanlar dizinine dön](/docs/)

İki faktörlü kimlik doğrulama (2FA), oturum açmaya ikinci bir adım ekler: parolanızdan sonra, telefonunuzdaki bir kimlik doğrulama uygulamasından kısa bir kod girersiniz. Birisi parolanızı öğrense bile, cihazınız olmadan giremez.

Herhangi bir standart TOTP kimlik doğrulama uygulamasıyla (Google Authenticator, Authy, 1Password, Microsoft Authenticator ve diğerleri) çalışır ve yalnızca yöneticiler için değil, **her** hesap için kullanılabilir. Kendi oturumunuzu korumak bir sunucu yönetimi eylemi olmadığından, görüntüleyiciler ve operatörler de bunu etkinleştirebilir.

## 2FA'yı Etkinleştirme

Hesap menüsünü (sağ üstteki adınız) açın ve **İki faktörlü kimlik doğrulama**'yı seçin.

![Hesap menüsü](/docs/images/2fa-user-menu.png)

Bir kayıt iletişim kutusu alacaksınız:

![Kayıt](/docs/images/2fa-enroll.png)

1. Kimlik doğrulama uygulamanızla **QR kodunu tarayın** veya **Kopyala**'ya dokunup manuel anahtarı elle girin.
2. Uygulamanızın şimdi gösterdiği **6 haneli kodu** yazın.
3. **Parolanızı onaylayın.** 2FA'yı etkinleştirmek parolanızı yeniden kontrol eder, böylece açık bir oturum başkasının cihazıyla etkinleştiremez.
4. **Etkinleştir**'e tıklayın.

### Yedek kodlarınızı kaydedin

2FA etkinleştirildiği anda, panel tek kullanımlık **yedek kodlar** bir set gösterir.

![Yedek kodlar](/docs/images/2fa-backup-codes.png)

Her kod, kimlik doğrulama uygulamanıza erişimi kaybederseniz oturum açmak için **bir kez** çalışır. Tekrar gösterilmeyecekleri için güvenli bir yere (ideal olarak bir parola yöneticisi) kaydedin. Her zaman yeni bir set oluşturabilirsiniz (bu, eskileri geçersiz kılar).

## 2FA ile Oturum Açma

Ondan sonra, oturum açmanın ikinci bir adımı olur. Kullanıcı adınız ve parolanızdan sonra, panel kodunuzu ister:

![2FA oturum açma](/docs/images/2fa-login-challenge.png)

Uygulamanızdaki geçerli 6 haneli kodu (veya yedek kodlarınızdan birini) girin ve hazırsınız. Bu adımı tamamlayana kadar oturum **açılmamış** olur: hiçbir sayfaya veya API'ye erişemez.

## 2FA'yı Yönetme veya Kapatma

Etkinleştirildiğinde hesap menüsündeki aynı **İki faktörlü kimlik doğrulama** girişini açın. Parolanızı onayladıktan sonra şunları yapabilirsiniz:

- **Yedek kodları yeniden oluştur** - yeni bir set yayınlar ve eskileri emekliye ayırır.
- **2FA'yı devre dışı bırak** - hesabınızdan kaldırır.

Her ikisi de önce geçerli parolanızı yeniden kontrol eder.

## Telefonunuzu VE yedek kodlarınızı mı kaybettiniz?

Bir **yönetici**, **Ayarlar → Kullanıcılar**'dan başka bir kullanıcının 2FA'sını sıfırlayabilir (2FA sütunundaki **Sıfırla** düğmesi). Bu, kullanıcının yalnızca parolasını kullanarak oturum açıp yeniden kurabilmesi için hesabın 2FA'sını temizler. Yöneticiler kendi 2FA'larını parola olmadan sıfırlayamazlar. Normal parola korumalı devre dışı bırakma işlemini yaparlar, böylece ele geçirilen bir yönetici oturumu kendi ikinci faktörünü kaldıramaz.

## Bilmekte Fayda Var

- Kodlar zamana dayalıdır ve her 30 saniyede bir döner; panel küçük bir saat sapmasına izin verir ve sunucunun saati daha sonra düzeltilirse sessizce kurtarılır.
- Bir kod tekrar kullanılamaz - oturum açmak için kullanıldıktan sonra, aynı kod penceresi içinde tekrar çalışmaz.
- Yanlış kodlar hız sınırına tabidir. Sınırlayıcı, parola adımıyla **paylaşılır** (hesap başına bir kilitleme artı IP başına `RATE_LIMIT_AUTH_PER_15MIN` sınırlayıcısı), bu nedenle doğru bir parola girmek, 6 haneli kodu tahmin etmeden hemen önce sayacı sıfırlayamaz.
- 2FA değişiklikleri (etkinleştirme, devre dışı bırakma, sıfırlama, yedek kod kullanımı) [Etkinlik günlüğünde](/docs/activity/) kaydedilir.
