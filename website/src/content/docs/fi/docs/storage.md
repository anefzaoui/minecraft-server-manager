---
title: 'Tallennustila'
description: 'Näe, mihin levytila kuluu, aseta kiintiörajat jokaiselle palvelinkansiolle ja siivoa tarpeettomat tiedostot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

**Tallennustila**-sivu näyttää, mihin levytilaasi menee: käyttö luokittain, kukin palvelin kiintiönsä mukaan, suurimmat tiedostot ja miten kokonaiskäyttö on kehittynyt viimeaikaisissa skannauksissa. Se on vain ylläpitäjille.

![Tallennustila](/docs/images/storage.png)

## Levytilakiintiöt ovat paneelin valvonnassa

Docker ei voi rajoittaa bind mountin levytilan käyttöä, joten paneeli tekee sen. Taustalla toimiva kokonaiskäytön indeksoija käy läpi datakansion (15 minuutin välein, muutosten jälkeen tai kun painat **Skannaa uudelleen nyt**), tallentaa välimuistiin kunkin palvelimen tilantarpeen ja valvoo palvelinkohtaista levytilakiintiötä, jonka olet asettanut. Toiminto, joka veisi palvelimen kansion (maailma, modit, asetukset, lokit ja kaikki muu siellä) yli kiintiönsä, kuten modin tai maailman asentaminen tai tiedostojen lataaminen, estetään, kunnes tilaa vapautetaan tai kiintiötä nostetaan, sen sijaan että yksi palvelin täyttäisi isäntäsi.

Aseta palvelimen kiintiö sen [asetuksissa](/docs/servers/#server-settings). **Pysäytä palvelin kiintiön ylittyessä** -valinnan käyttöönotto siellä pysäyttää myös käynnissä olevan palvelimen, kun sen kansio kasvaa yli 10 % kiintiöstä, ja kirjaa sen palvelimen historiaan. Modatut palvelimet voivat olla suuria, joten anna niille tilaa. [Varmuuskopiot](/docs/backups/) tallennetaan erikseen eivätkä ne vaikuta kiintiöön.

## Siivous

**Kertasiivous**-kortti vapauttaa tilaa, jonka paneeli voi turvallisesti ottaa takaisin: tunnin vanhemmat väliaikaistiedostot, orvot kirjastotiedostot ja 30 päivää vanhemmat arkistoidut lokit ja kaatumisraportit. Jokainen niistä näyttää, kuinka paljon tilaa se vapauttaa, ja avaa esikatselun ennen kuin mitään poistetaan. **Luokittain** ja **Suurimmat tiedostot** -listat linkittävät suoraan tiedostonhallintaan, jotta voit löytää, mitä muuta voit karsia ennen kuin tila loppuu.
