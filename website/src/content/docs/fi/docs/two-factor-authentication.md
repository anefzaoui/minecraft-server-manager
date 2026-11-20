---
title: 'Kaksivaiheinen tunnistautuminen'
description: 'Kaksivaiheinen tunnistautuminen (2FA) lisää toisen vaiheen kirjautumiseen: salasanasi jälkeen syötät lyhyen koodin puhelimesi tunnistussovelluksesta.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Kaksivaiheinen tunnistautuminen (2FA) lisää toisen vaiheen kirjautumiseen: salasanasi jälkeen syötät lyhyen koodin puhelimesi tunnistussovelluksesta. Vaikka joku saisi salasanasi selville, hän ei pääse sisään ilman laitettasi.

Se toimii minkä tahansa standardin TOTP-tunnistussovelluksen (Google Authenticator, Authy, 1Password, Microsoft Authenticator ja muut) kanssa, ja se on saatavilla **jokaiselle** tilille, ei vain ylläpitäjille. Oman kirjautumisesi suojaaminen ei ole palvelimen hallintatoiminto, joten katsojat ja operaattorit voivat ottaa sen käyttöön myös.

## 2FA:n käyttöönotto

Avaa tilivalikko (alkukirjaimesi tai profiilikuvasi, oikeassa yläkulmassa) ja valitse **2FA**.

![Tilin valikko](/docs/images/2fa-user-menu.png)

Näet rekisteröintivalintaikkunan:

![Rekisteröinti](/docs/images/2fa-enroll.png)

1. **Skannaa QR-koodi** tunnistussovelluksellasi tai napauta **Kopioi** ja syötä manuaalinen avain käsin.
2. Kirjoita **6-numeroinen koodi**, jonka sovelluksesi nyt näyttää.
3. **Vahvista salasanasi.** 2FA:n käyttöönotto tarkistaa salasanasi uudelleen, joten irrallinen avoin istunto ei voi ottaa sitä käyttöön jonkun toisen laitteella.
4. Napsauta **Ota käyttöön**.

### Tallenna varmuuskoodisi

Heti kun 2FA on otettu käyttöön, paneeli näyttää joukon kertakäyttöisiä **varmuuskoodia**.

![Varmuuskoodit](/docs/images/2fa-backup-codes.png)

Jokainen koodi toimii **kerran** kirjautumiseen, jos menetät pääsyn tunnistussovellukseesi. Tallenna ne turvalliseen paikkaan (salasananhallintaohjelma on ihanteellinen), koska niitä ei näytetä uudelleen. Voit luoda uuden joukon milloin tahansa (mikä mitätöi vanhat).

## Kirjautuminen 2FA:lla

Sen jälkeen kirjautumisessa on toinen vaihe. Käyttäjätunnuksesi ja salasanasi jälkeen paneeli pyytää koodiasi:

![2FA-kirjautuminen](/docs/images/2fa-login-challenge.png)

Syötä sovelluksesi nykyinen 6-numeroinen koodi (tai jokin varmuuskoodistasi) ja olet sisällä. Ennen tämän vaiheen suorittamista istunto **ei** ole kirjautunut sisään: se ei pääse mihinkään sivuun tai API:in.

## 2FA:n hallinta tai poistaminen käytöstä

Avaa sama **2FA**-kohta tilivalikosta, kun se on käytössä. Salasanasi vahvistamisen jälkeen voit:

- **Luo varmuuskoodit uudelleen** antaa uuden joukon ja poistaa vanhat käytöstä.
- **Poista 2FA käytöstä** poistaa sen tililtäsi.

Molemmat tarkistavat ensin nykyisen salasanasi.

## Puhelin _ja_ varmuuskoodit hukassa?

**Ylläpitäjä** voi nollata toisen käyttäjän 2FA:n kohdasta **Asetukset → Käyttäjät** (**Nollaa 2FA** kyseisen käyttäjän toimintovalikossa). Tämä tyhjentää tilin 2FA:n, jotta käyttäjä voi kirjautua sisään pelkällä salasanallaan ja ottaa sen uudelleen käyttöön. Ylläpitäjät eivät voi nollata _omaa_ 2FA:taan ilman salasanaa. He käyvät läpi normaalin salasanasuojatun käytöstäpoiston, joten kaapattu ylläpitäjäistunto ei voi poistaa omaa toista tekijäänsä.

## Hyvä tietää

- Koodit ovat aikasidonnaisia ja vaihtuvat 30 sekunnin välein; paneeli hyväksyy pienen kellonajan poikkeaman ja palautuu hiljaa, jos palvelimen kello korjataan myöhemmin.
- Koodia ei voi toistaa: kun se on käytetty kirjautumiseen, sama koodi ei toimi uudelleen sen ikkunan aikana.
- Vääriä koodeja rajoitetaan. Rajoitin on **jaettu** salasanavaiheen kanssa (tilikohtainen lukitus sekä IP-kohtainen `RATE_LIMIT_AUTH_PER_15MIN` -rajoitin), joten oikean salasanan syöttäminen ei voi nollata laskuria juuri ennen 6-numeroisen koodin arvaamista.
- 2FA-muutokset (käyttöönotto, käytöstä poisto, nollaus, varmuuskoodin käyttö) tallennetaan kaikki [Toimintalokiin](/docs/activity/).
