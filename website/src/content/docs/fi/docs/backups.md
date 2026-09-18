---
title: 'Varmuuskopiot'
description: 'Varmuuskopiot-sivu näyttää kaikki tilannekuvat koko laivastostasi, sisältäen koon, syyn ja iän.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Varmuuskopiot**-sivu näyttää kaikki laitekannassasi olevat tilannekuvat koon, syyn ja iän mukaan.

![Varmuuskopiot](/docs/images/backups.png)

## Varmuuskopion luominen

Palvelimen **Varmuuskopiot**-välilehdeltä (tai [aikataulun](/docs/schedules/) kautta) voit ottaa tilannekuvan koko palvelimen hakemistosta yhdellä napsautuksella. Paneeli pysäyttää maailman ensin (`save-off` → `save-all`), pakkaa tiedot zip-tiedostoon ja ottaa sitten tallennuksen uudelleen käyttöön (`save-on`), joten varmuuskopiot ovat johdonmukaisia jopa käynnissä olevasta palvelimesta. Pakkaus suoritetaan taustasäikeessä, joten se ei hidasta paneelia. Jokaiseen varmuuskopioon voi liittää muistiinpanon.

Jokainen arkisto **tarkistetaan eheydeltään** heti sen kirjoittamisen jälkeen: paneeli avaa zip-tiedoston uudelleen ja lukee sen sisällysluettelon. Vaurioitunut tai avaamaton arkisto poistetaan ja varmuuskopion kutsu epäonnistuu välittömästi sen sijaan, että ongelma ilmenisi kuukausia myöhemmin, kun palautus on ainoa asia sinun ja tietojen menetyksen välillä. Nollakohteinen arkisto (palvelin, jota ei ole koskaan käynnistetty) sallitaan, mutta se merkitään tapahtumassa.

Valitse **"Kutista maailma myös sen jälkeen"** (Varmuuskopiot-välilehdellä tai varmuuskopiointiaikataulussa) poistaaksesi harvoin käytetyt palaset, kun arkisto on turvallisesti kirjoitettu (katso **[Maailman kutistaminen](/docs/world-shrink/)**). Kutistaminen suoritetaan vain palvelimen ollessa pysäytettynä; käynnissä olevassa palvelimessa varmuuskopiointi tapahtuu silti ja kutistaminen ohitetaan.

![Palvelimen varmuuskopiot](/docs/images/server-backups.png)

## Varmuuskopioiden syyt

Varmuuskopiot merkitään sen mukaan, miksi ne otettiin:

- **manuaalinen** - painoit painiketta.
- **aikataulutettu** - luotu [aikataulun](/docs/schedules/) avulla. Jokaiselle uudelle palvelimelle luodaan myös automaattisesti päivittäinen aikataulutettu varmuuskopio (ajoitettu klo 02:00 ja 05:59 välille), joten palvelimella on automaattinen suoja ensimmäisestä päivästä lähtien, ei vain ennen päivityksiä.
- **ennen päivitystä** - otettu automaattisesti ennen paketin päivitystä, joten päivitys on aina peruutettavissa.
- **ennen palautusta** - otettu automaattisesti juuri ennen palautusta tai maailman nollausta, turvaverkkona siltä varalta, että palautus ei ollut sitä, mitä halusit.

## Säilytys

Säilytys on rajattu **palvelinkohtaisesti, syyn mukaan**: kunkin ryhmän uusimmat säilytetään, vanhemmat poistetaan automaattisesti jokaisen onnistuneen varmuuskopion jälkeen:

| Syy              | Säilytetään |
| ---------------- | ----------- |
| aikataulutettu   | 10          |
| ennen päivitystä | 10          |
| manuaalinen      | 20          |
| ennen palautusta | 5           |

`ennen palautusta` -syylle on oma pieni säiliö juuri siksi, että automaattinen turvavarmuuskopio ei koskaan poistaisi manuaalista varmuuskopiota, jonka olet tarkoituksella säilyttänyt.

Kahden valinnaisen ylärajan sovelletaan syyn mukaisten määrien lisäksi, molemmat oletuksena pois päältä: **maksimi-ikä** (N päivää vanhemmat varmuuskopiot poistetaan syystä riippumatta) ja **maksimi kokonaiskoko** palvelinta kohden (vanhimmat varmuuskopiot poistetaan, kunnes kokonaisuus mahtuu, ensin `ennen palautusta` -varmuuskopiot). Palvelimen uusin varmuuskopio ei koskaan poistu kummankaan ylärajan vuoksi. Kaikkia näitä voidaan muuttaa globaalisti Asetukset-sivulla ja ohittaa palvelinkohtaisesti sen Varmuuskopiot-välilehdellä.

Varmuuskopioita voidaan **nimetä uudelleen** varmuuskopioluettelosta (uudelleennimeämispainike jokaisella rivillä). Levyllä oleva arkisto ja paneelin tietue liikkuvat yhdessä, joten lataus, palautus ja säilytys toimivat edelleen uudella nimellä.

![Varmuuskopion uudelleennimeäminen](/docs/images/backup-rename.png)

> Säilytys on automaattisesti rajattu, mutta suuret modatut arkistot lasketaan edelleen palvelimen [levytilaan](/docs/storage/) sisältyvään kiintiöön, joten pidä silmällä kokonaismäärää suurille paketeille.

## Palauttaminen

Varmuuskopion palauttaminen pysäyttää palvelimen (tarkistaa, että säiliö todella pysähtyi ennen tiedostojen käsittelyä), ottaa `ennen palautusta` -turvavarmuuskopion, korvaa **koko palvelimen hakemiston** tilannekuvalla ja jättää sen pysäytettynä, jotta voit käynnistää sen uudelleen. Koska pakettien päivitykset ottavat aina ensin `ennen päivitystä` -varmuuskopion, voit aina peruuttaa huonon päivityksen.

## Paneelin oma tietokanta

Palvelinvarmuuskopiot kattavat vain palvelinkohtaiset maailman hakemistot. Paneelin oma tietokanta (`panel.db`, joka sisältää käyttäjät, roolit, 2FA-salaisuudet, aikataulut, pakettien kiinnitykset ja historian) otetaan erikseen tilannekuvana päivittäisellä ylläpitoajastimella:

- `VACUUM INTO` kirjoittaa johdonmukaisen, fragmentoituneen kopion hakemistoon `data/backups/_panel/`; uusimmat **14** säilytetään.
- Käynnistyksen yhteydessä paneeli suorittaa `PRAGMA integrity_check` ja kirjaa äänekkäästi, jos se epäonnistuu, ohjaten sinut hakemistoon `data/backups/_panel` uusimman hyvän kopion löytämiseksi.

Varmuuskopioi koko `data/`-puu (se sisältää myös `.secret-key`, levossa olevan salausavaimen) ja olet varmuuskopioinut kaiken.
