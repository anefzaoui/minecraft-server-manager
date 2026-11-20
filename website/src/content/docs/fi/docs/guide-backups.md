---
title: 'Minecraft-palvelimen varmuuskopiot, jotka todella palautuvat'
description: 'Kuinka tehdä Minecraft-palvelimen varmuuskopioita, jotka todella palautuvat: johdonmukaiset kopiot, säilytetty muualla ja testattu vähintään kerran.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

Useimmilla palvelimilla on varmuuskopioita. Harvemmilla on varmuuskopioita, jotka toimivat, ja ero paljastuu vain pahimpana päivänä. Kolme asiaa erottaa ne: kopio on yhtenäinen, se sijaitsee jossain muualla ja joku on palauttanut sen vähintään kerran.

## Kopioi maailma sen kirjoittamisen aikana

Käynnissä oleva palvelin kirjoittaa aluetiedostoja jatkuvasti. Kopioi ne kesken kirjoittamisen, niin saat tiedoston, joka on puoliksi vanha ja puoliksi uusi, ja joka joko epäonnistuu latautumaan tai latautuu aukolla maassa, missä jonkun tukikohta oli. Mikään ei varoita sinua, koska kopio onnistui.

On kaksi oikeaa tapaa ottaa kopio:

1. **Pysäytä palvelin**, kopioi, käynnistä se uudelleen. Yksinkertainen, rehellinen ja epäsuosittu käyttökatkon vuoksi.
2. **Käske pelin lopettaa kirjoittaminen ensin.** Suorita `save-off`, sitten `save-all flush`, odota sen valmistumista, kopioi, sitten `save-on`. Maailma on valmis ja hiljainen kopioinnin ajan.

Älä koskaan ohita suoraan kopiointiin. Tiedostojärjestelmän tai levyn tason tilannekuva on hyvä vain, jos se on aidosti atominen, ja `cp -r` pelaajien asettaessa lohkoja ei ole.

## Varmuuskopioi enemmän kuin maailma

Pelkän maailman palauttaminen antaa sinulle maaston ja menettää palvelimen. Haluat myös:

- `server.properties` ja mitä tahansa muuta, mikä määrittää säännöt.
- Modin tai lisäosan jar-tiedostot, täsmälleen niillä versioilla, jotka olivat käytössä. Maailma ei lataudu ilman modeja, jotka loivat sen lohkot.
- Pelaajatietoja, mukaan lukien `whitelist.json`, `ops.json` sekä tilasto- ja saavutuskansiot.
- Paketin version, jos se tuli paketista. Sen ylös kirjaaminen lasketaan.

Nopein järkevyystarkistus mille tahansa varmuuskopiolle: voisitko rakentaa tämän palvelimen uudelle koneelle pelkästä arkistosta? Jos vastaus vaatii lauseen, joka alkaa "ja sitten asentaisin uudelleen", se ei ole täydellinen varmuuskopio.

## Yksi kopio samalla levyllä ei ole varmuuskopio

Varmuuskopio, joka sijaitsee suojattavalla koneella, kattaa täsmälleen yhden vian: poistit jotain. Se ei kata levyn hajoamista, palveluntarjoajan tilin jäädyttämistä tai virhettä, joka poistaa koko hakemiston.

Pidä se yksinkertaisena täydellisen sijaan:

- Yksi paikallinen kopio, yleistä tapausta varten, joka on jonkun vahingoittaminen tai huono päivitys.
- Yksi kopio jossain muualla. Toinen kone, objektitallennus tai kotiverkon tallennuslaite, joka hakee yöllä SSH:n yli.
- Riittävästi historiaa selviytyäksesi ongelmasta, jota et huomannut heti. Vioittuminen havaitaan usein päiviä myöhemmin, ja jos säilytät kolmen päivän varmuuskopiot, olet jo ylikirjoittanut hyvän.

Seitsemän päivittäistä kopiota plus neljä viikoittaista kattavat lähes kaikki todelliset tapaukset ja maksavat hyvin vähän tilaa.

## Testaa palautusta ennen kuin tarvitset sitä

Valitse varmuuskopio, palauta se varapalvelimelle ja liity. Se on koko testi, se kestää viisitoista minuuttia ja se havaitsee kaikki klassiset virheet: arkisto, josta puuttuu modikansio, maailma, joka vaatii versiota, jota et enää käytä, käyttöoikeudet, jotka tekevät tiedostoista lukukelvottomia, katkennut lataus.

Tee se kerran, kun otat varmuuskopiot käyttöön, ja kerran uudelleen minkä tahansa suuren palvelimen muutoksen jälkeen.

## Koko ja miten sitä hallitaan

Maailmat kasvavat, koska pelaajat tutkivat. Maailma, jossa joku on lentänyt kymmenentuhatta lohkoa suoraan, kantaa jokaista lohkoa tuota linjaa pitkin ikuisesti, ja useimpia näistä lohkoista ei enää koskaan vierailla.

Kolme vipua, järjestyksessä sen mukaan, kuinka paljon ne antavat takaisin:

1. **Leikkaa käymättömät lohkot.** Työkalut, jotka leikkaavat viimeksi kosketetun ajan mukaan, poistavat tyypillisesti suuren osan paljon matkustetusta maailmasta ilman näkyvää vaikutusta pelissä.
2. **Pakkaa asianmukaisesti.** Aluetiedostot pakkaantuvat hyvin; niiden arkistot eivät hyödy mistään eksoottisesta.
3. **Älä säilytä jokaista tuntikohtaista kopiota vuodeksi.** Säilytys on parempi kuin pakkaus.

## Minecraft Server Managerissa

Varmuuskopiot käyttävät `save-off`, flush, copy, `save-on` -polkua, ja kesken varmuuskopion pyydetty pysäytys tai uudelleenkäynnistys evätään, kunnes kopio valmistuu, sen sijaan että kilpailtaisiin sen kanssa. Arkisto kattaa koko palvelimen hakemiston, joten modit, konfiguraatio ja pelaajatiedot kulkevat maailman mukana.

Varmuuskopiot voivat toimia aikataulun mukaisesti uudelleenkäynnistysten ja komentojen rinnalla, ja jokainen uusi palvelin alkaa päivittäisellä varmuuskopiointiaikataululla. Säilytys laskee jokaisen tyypin erikseen, joten kymmenen aikataulun mukaista kopiota, jotka kasaantuvat itsestään, eivät voi syrjäyttää sitä, jonka otit käsin ennen riskialtista muutosta, ja ikä- ja kokorajat pätevät lisäksi. Järjestelmänvalvojat muuttavat kaikkea tätä Asetukset-sivulla tai palvelinkohtaisesti sen Varmuuskopiot-välilehdellä. Palauttaminen ottaa ensin uuden varmuuskopion, joten virheelliseen ajankohtaan palauttaminen on itsessään peruutettavissa. Maailmaa voidaan pienentää itsestään tai osana varmuuskopiota, mikä on tärkein vipu koon kannalta.

Koko paneeli, mukaan lukien jokainen varmuuskopio, sijaitsee yhden hakemiston alla. Tuon hakemiston kopioiminen muualle on koneen ulkopuolinen puoli tarinasta, ja se on tarkoituksella ainoa asia, joka sinun tarvitsee kopioida.

Liittyvät: [varmuuskopiot paneelissa](/docs/backups/), [aikataulut](/docs/schedules/),
[maailman pienentäminen](/docs/world-shrink/), [palvelimen siirtäminen toiseen isäntään](/docs/guide-moving-a-server/).
