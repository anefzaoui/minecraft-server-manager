---
title: 'Varmuuskopiot'
description: 'Varmuuskopiot-sivu näyttää kaikki tilannekuvat koko laivastostasi, sisältäen koon, syyn ja iän, ja ne voi suodattaa palvelimen ja syyn mukaan.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Takaisin dokumenttien indeksiin](/docs/)

**Varmuuskopiot**-sivu näyttää kaikki palvelinklusterisi tilannekuvat koon, syyn ja iän mukaan lajiteltuna, ja voit suodattaa niitä palvelimen ja syyn mukaan.

![Varmuuskopiot](/docs/images/backups.png)

## Varmuuskopion luominen

Palvelimen **Varmuuskopiot**-välilehdeltä (tai [aikataulun](/docs/schedules/) kautta) voit ottaa tilannekuvan koko palvelimen hakemistosta yhdellä napsautuksella. Paneeli pysäyttää maailman ensin (`save-off` → `save-all`), pakkaa tiedot zip-tiedostoon ja ottaa sitten tallennuksen uudelleen käyttöön (`save-on`), joten varmuuskopiot ovat johdonmukaisia myös käynnissä olevasta palvelimesta. Pakkaus suoritetaan taustasäikeessä, joten se ei hidasta paneelia. API:n kautta aloitettu varmuuskopio voi sisältää muistiinpanon.

Jokainen arkisto **tarkistetaan eheyden osalta** heti sen kirjoittamisen jälkeen: paneeli avaa zip-tiedoston uudelleen ja lukee sen sisällysluettelon. Vioittunut tai avaamaton arkisto poistetaan ja varmuuskopiointipyyntö epäonnistuu välittömästi, sen sijaan että ongelma ilmenisi kuukausia myöhemmin, kun palautus on ainoa asia sinun ja tietojen menetyksen välillä. Nollakohteinen arkisto (palvelin, jota ei ole koskaan käynnistetty) sallitaan, mutta se merkitään tapahtumassa.

Valitse **"Pienennä maailmaa myös sen jälkeen"** (Varmuuskopiot-välilehdellä tai varmuuskopiointiaikataulussa) poistaaksesi harvoin käytetyt palaset, kun arkisto on turvallisesti kirjoitettu (katso **[Maailman pienentäminen](/docs/world-shrink/)**). Pienennys suoritetaan vain palvelimen ollessa pysäytettynä; käynnissä olevalla palvelimella varmuuskopiointi tapahtuu silti ja pienennys ohitetaan.

![Palvelimen varmuuskopiot](/docs/images/server-backups.png)

## Varmuuskopioiden syyt

Varmuuskopiot merkitään syyn mukaan, miksi ne otettiin:

- **manuaalinen**: klikkasit **Varmuuskopioi nyt**. Palvelimen aktiivisen maailman korvaaminen kirjaston yhdestä otetulla varmuuskopiolla ottaa ensin `manuaalisen` varmuuskopion.
- **aikataulutettu**: luotu [aikataulun](/docs/schedules/) avulla. Jokaisesta uudesta palvelimesta otetaan myös automaattisesti päivittäinen aikataulutettu varmuuskopio (aikavälillä 02:00–05:59), joten palvelimella on automaattinen suoja ensimmäisestä päivästä lähtien, ei vain ennen päivityksiä.
- **ennen päivitystä**: otettu automaattisesti ennen paketin päivitystä tai Minecraft-version muutosta, joten päivitys on aina peruutettavissa.
- **ennen palautusta**: otettu automaattisesti juuri ennen palautusta tai maailman nollausta, turvaverkkona siltä varalta, että palautus ei ole sitä mitä halusit.

## Säilytys

Säilytys rajoitetaan **palvelinkohtaisesti, syyn mukaan**: kunkin ryhmän uusimmat säilytetään, vanhemmat poistetaan automaattisesti jokaisen onnistuneen varmuuskopion jälkeen:

| Syy              | Oletuksena säilytettävät |
| ---------------- | ------------------------ |
| aikataulutettu   | 10                       |
| ennen päivitystä | 10                       |
| manuaalinen      | 20                       |
| ennen palautusta | 5                        |

`ennen palautusta` (paneelissa turvavarmuuskopioina kutsutut) oma pieni säiliönsä, jotta automaattinen turvavarmuuskopio ei koskaan syrjäyttäisi tarkoituksella säilyttämääsi `manuaalista` varmuuskopiota.

Kahden valinnaisen ylärajan sovelletaan perussyyslukumäärien lisäksi, molemmat oletuksena pois päältä: **maksimi-ikä** (N päivää vanhemmat varmuuskopiot poistetaan syystä riippumatta) ja **maksimi kokonaiskoko** palvelinta kohden (vanhimmat poistetaan, kunnes kokonaisuus mahtuu: ensin turvavarmuuskopiot, sitten aikataulutetut ja lopuksi loput). Palvelimen uusin varmuuskopio ei koskaan poistu kummankaan ylärajan vuoksi.

### Sen muuttaminen

Järjestelmänvalvojat määrittävät paneelin laajuisen käytännön **Asetukset**-sivun **Varmuuskopioiden säilytys** -kortissa (**Täytä sisäänrakennetut** palauttaa oletusarvot lomakkeeseen tallennettavaksi). Palvelin voi poiketa mistä tahansa kuudesta arvosta: avaa sen **Varmuuskopiot**-välilehti ja laajenna **Säilytys tälle palvelimelle**. Jokainen kenttä on tyhjä, ellei kyseinen palvelin aseta sitä, ja tyhjä kenttä noudattaa paneelin laajuista arvoa (näytetään sen sisällä). Palvelin voi siis esimerkiksi säilyttää 3 aikataulutettua varmuuskopiota ja käyttää paneelin laajuisia arvoja kaikkeen muuhun; kentän tyhjentäminen palauttaa sen paneelin laajuiseen arvoon.

![Asetukset-sivun Varmuuskopioiden säilytys -kortti](/docs/images/settings-retention.png)

![Säilytys tälle palvelimelle palvelimen Varmuuskopiot-välilehdellä](/docs/images/server-retention.png)

Tallentaminen ei poista mitään itsestään. Jos uudet rajat jättäisivät olemassa olevat varmuuskopiot yli rajan, paneeli listaa palvelinkohtaisesti, kuinka monta varmuuskopiota kustakin tyypistä menisi, kuinka paljon tilaa se vapauttaa ja kuinka vanha vanhin niistä on. Se kertoo myös, milloin palvelin oli jo ylittänyt rajansa ennen tätä muutosta (esimerkiksi aiemman **Seuraavasta varmuuskopiosta** -asetuksen jälkeen), koska nyt soveltaminen leikkaa kaiken yli rajan menevän, ei vain sitä, mitä tämä muokkaus lisää. Sitten se kysyy, miten ne sovelletaan:

- **Poista nyt** poistaa täsmälleen juuri listaamansa varmuuskopiot, ei enempää: välissä tehty varmuuskopio odottaa seuraavaa leikkausta. Asetukset-sivulta palvelin, joka on kesken palautuksen, varmuuskopioinnin tai vastaavan toiminnon, ohitetaan ja leikkaus tapahtuu seuraavan varmuuskopion jälkeen; palvelimen omalla Varmuuskopiot-välilehdellä sinua pyydetään yrittämään uudelleen, kun kyseinen toiminto on valmis. Palvelimen vanhojen varmuuskopioiden poistamisen aikana (yleensä sekunteja) muut toiminnot kyseisellä palvelimella joutuvat odottamaan: aikataulutettu varmuuskopio tai käynnistys, joka osuu silloin, yrittää uudelleen minuutin välein, kunnes se voi (enintään 30 minuutin ajan), kaatunut palvelin käynnistetään uudelleen noin 20 sekunnin kuluttua sen päättymisestä (enintään 30 minuutin ajan), ja aikataulutettu uudelleenkäynnistys tai pysäytys, joka osuu siihen, ohitetaan seuraavaan ajankohtaan asti.
- **Seuraavasta varmuuskopiosta** säilyttää ne toistaiseksi; jokainen palvelin leikkaa varmuuskopioitaan seuraavan kerran, kun se tekee sellaisen, kuten aina on tehnyt.

![Valintaikkuna, joka listaa, mitä uudet rajat poistaisivat](/docs/images/retention-preview.png)

Palautettavaa varmuuskopiota ei koskaan poisteta palautuksen aikana: säilytys jättää sen rauhaan (eikä poista muita varmuuskopioita tehdäkseen tilaa sille), ja sen poistaminen käsin estetään, kunnes palautus on valmis.

Samat asetukset ovat saatavilla skripteille järjestelmänvalvojan API-päätepisteinä: `GET`/`POST /api/backups/retention` ja `/api/servers/:id/backups/retention`. Paneelin laajuiset arvot eivät voi olla `null`. Palvelimelle arvo `null` (tai `""`) poistaa kyseisen avaimen, jolloin se noudattaa jälleen paneelin laajuista arvoa, ja `{ "reset": true }` poistaa ne kaikki. Kummankin polun alla `POST …/preview` raportoi, mitä muutos poistaisi poistamatta sitä (`backups`, `bytes`, `servers`, `ids` ja palvelinkohtainen `byServer` erittely), ja `POST …/apply` soveltaa tallennettua käytäntöä nyt ja vastaa `{ deleted, skipped }` paneelin laajuisesti (`skipped` laskee kiireiset palvelimet) tai `{ deleted }` yhdelle palvelimelle. Lähetä esikatselun `{ "token": "..." }` (säilyy 10 minuuttia) tai sen `{ "ids": [...] }` poistaaksesi vain ne; ilman kumpaakaan, kaikki yli rajan menevä poistetaan. Palvelinkohtainen soveltaminen kiireisellä palvelimella vastaa 409.

Varmuuskopiot voidaan **nimetä uudelleen** varmuuskopioluettelosta (uudelleennimeämispainike jokaisella rivillä). Levyllä oleva arkisto ja paneelin tietue liikkuvat yhdessä, joten lataus, palautus ja säilytys toimivat edelleen uudella nimellä.

![Varmuuskopion uudelleennimeäminen](/docs/images/backup-rename.png)

> Säilytys on automaattisesti rajattu, mutta suuret modatut arkistot lasketaan edelleen palvelimen [levytilaan](/docs/storage/) sisältyviksi, joten pidä silmällä kokonaismäärää suurille paketeille.

## Palauttaminen

Varmuuskopion palauttaminen pysäyttää palvelimen (tarkistaa, että säiliö todella pysähtyi ennen tiedostojen käsittelyä), ottaa `ennen palautusta` -turvavarmuuskopion, korvaa **koko palvelimen hakemiston** tilannekuvalla ja jättää sen pysäytettynä, jotta voit käynnistää sen uudelleen. Arkisto puretaan ensin sivulle ja vaihdetaan sisään vasta, kun se on täysin purettu, joten osittain epäonnistunut palautus jättää nykyiset tiedostot koskemattomiksi. Koska pakettipäivitykset ottavat aina ensin `ennen päivitystä` -varmuuskopion, voit aina peruuttaa huonon päivityksen.

## Paneelin oma tietokanta

Palvelinvarmuuskopiot kattavat vain kunkin palvelimen oman kansion. Paneelin oma tietokanta (`panel.db`, joka sisältää käyttäjät, roolit, 2FA-salasanat, aikataulut, pakettikiinnitykset ja historian) otetaan erikseen talteen päivittäisellä ylläpitoajastimella:

- `VACUUM INTO` kirjoittaa johdonmukaisen, eheytyneen kopion datahakemiston `backups/_panel/`-kansioon; uusimmat **14** säilytetään.
- Käynnistyksen yhteydessä paneeli suorittaa `PRAGMA integrity_check` ja kirjaa äänekkäästi, jos se epäonnistuu, ohjaten sinut `backups/_panel`-kansioon uusimman hyvän kopion löytämiseksi.

Varmuuskopioi koko datahakemisto (se sisältää myös `.secret-key`, levossa olevan salausavaimen), niin olet varmuuskopioinut kaiken.
