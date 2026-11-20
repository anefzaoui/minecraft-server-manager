---
title: 'Minecraft-palvelimen siirtäminen toiseen palvelimeen'
description: 'Maailman siirtäminen on helppoa. Palvelimen siirtäminen niin, että pelaajat voivat edelleen kirjautua sisään, inventaariot, kodit ja käyttöoikeudet ennallaan, on se osa, joka menee pieleen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Maailman siirtäminen on helppoa. Palvelimen siirtäminen niin, että pelaajat voivat edelleen kirjautua sisään, heidän inventaarionsa, kotinsa ja käyttöoikeutensa ennallaan, on se osa, joka menee pieleen. Alla oleva järjestys pitää käyttökatkon muutamassa minuutissa ja säilyttää paluutien, jos uusi kone pettää.

## Tarkista ensin tilanne

Kirjoita nämä ylös ennen kuin kosket mihinkään. Jokainen niistä on pilannut siirron pahasti, kun niitä on oletettu tarkistamisen sijaan:

- **Minecraft-versio ja lataaja**, tarkasti. 1.20.1 NeoForge ei ole 1.20.1 Forge.
- **Modien tai lisäosien luettelo versioineen.** Maailma ei lataudu ilman modeja, jotka sen loivat.
- **Java-versio**, joka seuraa Minecraft-versiota.
- **`level-name`** tiedostosta `server.properties`. Maailma-kansiota ei usein kutsuta nimellä `world`.
- **Online-tila.** Jos vanha palvelin toimi asetuksella `online-mode=false` ja uusi toimii asetuksella `online-mode=true`, tai päinvastoin, jokainen pelaaja saa eri UUID:n ja siten täysin uuden, tyhjän inventaarion. Tämä on sivun tuskallisin virhe.
- **Kaikki palvelinkansion ulkopuolella oleva**, kuten lisäosan MySQL-tietokanta.

## Kopioi palvelimen ollessa käynnissä, kopioi sitten uudelleen sen ollessa pysäytettynä

Lyhyen käyttökatkon salaisuus on hitaan kopioinnin tekeminen ensin.

1. **Palvelimen ollessa käynnissä**, kopioi koko palvelinkansio uuteen koneeseen. Suurella maailmalla tämä voi kestää tunnin; kukaan ei huomaa sitä, koska mikään ei ole pysähtynyt.
2. **Ilmoita uudelleenkäynnistyksestä ja pysäytä palvelin asianmukaisesti.** Asianmukainen pysäytys saa pelin tallentamaan maailman; prosessin tappaminen ei.
3. **Kopioi uudelleen.** Tällä kertaa siirtyvät vain muuttuneet tiedostot, joten se kestää sekunteja tai minuutteja.
4. **Käynnistä se uudessa koneessa**, jos mahdollista ei-julkisessa portissa, ja liity siihen itse. Tarkista tuttu tukikohta, oma inventaariosi ja että lisäosat tai modit latautuivat ilman virheitä.
5. **Sitten** ohjaa pelaajat siihen.

`rsync -a --delete` on yleinen työkalu vaiheisiin 1 ja 3. Säilytä käyttöoikeudet ja aikaleimat: väärän käyttäjän kopioima maailma on palvelin, joka ei käynnisty, eikä virhe kerro sitä selvästi.

## Älä poista vanhaa vielä

Pidä vanha kone pysäytettynä, mutta ehjänä, vähintään muutaman päivän ajan. Se on ainoa todellinen palautuskeino. Pidä se sammutettuna mieluummin kuin käynnissä, jotta kukaan ei vahingossa liity hylättyyn kopioon ja rakenna sinne viikon ajan.

## Tee osoitteesta pysyvä siirrosta huolimatta

Jos pelaajat yhdistävät pelkkään IP-osoitteeseen, jokainen siirto pakottaa jokaisen pelaajan muokkaamaan palvelinlistaa, ja jotkut heistä eivät koskaan tee sitä.

Käytä hallitsemaasi verkkotunnusta, joka osoittaa palvelimeen. Siirto muuttuu silloin DNS-muutokseksi, ja jokaisen asiakkaan osoite pysyy samana. Laske tietueen TTL (time-to-live) päivää ennen siirtoa, jotta muutos leviää nopeasti.

Jos haluat pelaajien kirjoittavan pelkän verkkotunnuksen palvelimen toimiessa epästandardissa portissa, SRV-tietue tekee sen. Se on sama mekanismi, jota kaupalliset palveluntarjoajat käyttävät jakaessaan `play.something.net`.

## Tarkista uusi kone ennen sen luottamista

Kolme asiaa, jotka eroavat palveluntarjoajien välillä ja purevat siirron jälkeen:

- **Palomuuri.** Pelisi portin on oltava auki, ja vain pelisi portin. Älä paljasta hallintapaneelia tai karttaa internetiin vain siksi, että se toimi paikallisesti.
- **Yhden ytimen nopeus.** Minecraft välittää enemmän yhden ytimen nopeudesta kuin niiden määrästä. Kahdeksan hidasta ydintä tuntuu huonommalta kuin kaksi nopeaa.
- **Levy.** Pyörivällä tallennustilalla tai voimakkaasti jaetulla asemalla oleva maailma pätkii lohkojen latautumisen aikana.

## Hallitusta paneelista poistuminen

Jos olet tulossa palveluntarjoajalta, joka antoi sinulle ohjauspaneelin koneen sijaan, etsi lataus- tai tiedostonhallinta ja ota koko palvelinkansio sen sijaan, että ottaisit vain maailman. Hanki itse lisäosa- ja modijärjestelmät, älä listaa: versiot ovat tärkeitä, ja "uusin" on ensi kuussa eri tiedosto.

Tarkista myös, että varmuuskopiosi ovat sinun. Varmuuskopio, joka on olemassa vain lähtevän paneelin sisällä, ei ole varmuuskopio, jonka omistat.

## Minecraft Server Managerissa

Koko paneeli on yksi hakemisto. Sen kopioiminen toiseen koneeseen ja paneelin käynnistäminen siellä tuo kaikki palvelimet, maailmat, varmuuskopiot ja asetukset mukanaan, mikä tekee itse paneelin siirtämisestä kopioinnin eikä siirron.

Yhdelle palvelimelle kaikkien sijaan, "blueprint" tallentaa sen konfiguraation, modijoukon ja kiinnitetyn pakettiversion (ja, jos valitset sen, aktiivisen maailman) yhdeksi `.mcserver.zip`-tiedostoksi, joka voidaan tuoda toiseen paneeliin saman palvelimen uudelleenrakentamiseksi. Maailmat voidaan ladata ja asentaa erikseen, kun vain maailma tarvitsee siirtyä.

Jos palvelimen käyttämä pelipaikka on jo varattu uudessa koneessa, tai haluat testata ensin ei-julkisessa portissa, muuta se kohdassa **Asetukset → Konfiguraatio**: **Pelipaikka**-kortissa on **Käytä seuraavaa vapaata porttia**, käynnissä oleva palvelin kysyy ennen uudelleenkäynnistystä uudessa portissa, ja jos se ei voi käynnistyä siellä, se palaa vanhaan. Vaihda se julkiseen porttiin, kun ohjaat pelaajat siihen.

Liittyvät: [blueprints](/docs/blueprints/), [varmuuskopiot, jotka todella palautuvat](/docs/guide-backups/),
[maailmat ja tiedostot](/docs/worlds-and-files/).
