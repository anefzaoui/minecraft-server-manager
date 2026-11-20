---
title: 'Kutsut ja tilasivu'
description: 'Kutsu ystäviä palvelimelle osoitteen, version ja asiakasmodipakkauksen avulla ja jaa julkinen tilasivu, joka näyttää vain sen, mitä itse valitset.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Palvelimen **Asetukset**-ryhmän kaksi välilehteä auttavat pelaajia löytämään ja liittymään siihen: **Kutsut** sisältää kaiken, mitä ystävä tarvitsee yhteyden muodostamiseen, ja **Tila-sivu** julkaisee pienen julkisen sivun, joka näyttää, onko palvelin käynnissä. Molemmat vaativat palvelimen **Asetukset**-oikeuden ([käyttäjät ja roolit](/docs/users-and-roles/#per-server-permissions)).

## Kutsut

**Asetukset → Kutsut** sisältää **Kutsu ystäviä** -kortin:

- **Jaettava osoite** listaa koneesi osoitteet paikallisessa verkossasi palvelimen pelisataman kanssa, julkisen osoitteesi, kun paneeli pystyi tunnistamaan sen (verkon ulkopuoliset pelaajat tavoittavat sen vain porttiohjauksen kautta), ja **Mukautettu osoite…** omalle verkkotunnuksellesi tai osoitteellesi, kuten `play.example.com:25565`.
- **Kutsuviesti** on valmis liitettäväksi tarkoitettu viesti, joka sisältää palvelimen nimen, valitsemasi osoitteen sekä sen Minecraft-version ja tyypin. **Kopioi kutsuviesti** kopioi sen leikepöydälle. Kun valkoinen lista on käytössä, viesti pyytää ystäviä antamaan Minecraft-käyttäjänimensä, ja kortti muistuttaa sinua lisäämään jokaisen ystävän **Pelaajat**-välilehdellä ennen heidän liittymistään.
- **Mitä ystävät tarvitsevat** kertoo, mitä pelaajan puolella tarvitaan: ei mitään muuta kuin oikea Minecraft-versio tavalliselle tai lisäosapalvelimelle (Paper ja vastaavat), tai palvelimen modit modatulle palvelimelle.

### Asiakasmodpack

Modatulla palvelimella kortti tarjoaa myös **Lataa asiakasmodpack (.mrpack)**. Ystävät tuovat sen Prism Launcheriin tai Modrinth Appiin, joka asentaa palvelimen Minecraft-version ja modilataajan, lataa modit ja lisää palvelimen heidän moninpelilistaansa valitsemallasi osoitteella.

Tiedosto rakennetaan itse palvelimeen lisäämistäsi modeista (mukautettu mod-overlay), jotka tulevat Modrinthista. Muualta tulevat modit listataan sen sijaan kortissa, joten ystävät voivat lisätä kyseiset tiedostot `mods`-kansioonsa käsin. Modpackista luodulla palvelimella ystävien tulisi asentaa kyseinen pack, palvelimen käyttämässä versiossa, heidän launcherinsa, **Yleiskatsaus**-välilehti näyttää version.

### Pelaaminen internetin yli

**Pelaaminen internetin yli (porttiohjaus)** kortin alareunassa selittää reitittimen puolen: ohjaa palvelimen pelisatama (TCP ja UDP) koneelle, joka ajaa paneelia, ja jaa sitten julkinen osoitteesi sataman kanssa. Jos internet-palveluntarjoajasi käyttää CGNAT:ia, porttiohjaus ei toimi, ja tunnelipalvelu (esimerkiksi playit.gg) on tapa päästä sisään. Paneeli ei avaa reitittimen portteja itsestään. Vain pelisatamat kuuluvat internetiin; pidä paneelin oma portti ja RCON-portit suljettuina ([portit pikakatsauksena](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Tila-sivu

**Asetukset → Tila-sivu** kytkee päälle julkisen sivun yhdelle palvelimelle, oletuksena pois päältä:

1. Kytke kortti päälle.
2. Valitse **Sivun osoite**: sivu sijaitsee paneelissasi osoitteessa `/status/<osoite>`, ja osoite on 3–40 pientä kirjainta, numeroa tai väliviivaa, yksilöllinen kaikissa palvelimissasi.
3. Paina **Tallenna**. **Avaa sivu** ja **Kopioi linkki** antavat sinulle jaettavan linkin.

Kuka tahansa linkin haltija näkee palvelimen nimen, sen MOTD:n, version, onko se käynnissä, pelaajamäärän ja käyttöajan, eikä mitään muuta. Sivulla ei ole linkkiä paneeliin eikä se vaadi kirjautumista. Se lukee paneelin muistissa olevaa tilaa, joten kävijät eivät koskaan aiheuta työtä Docker-daemonille.

Sivun pois kytkeminen säilyttää sen osoitteen, joten sen takaisin kytkeminen palauttaa saman linkin. Omalle sivulle tai botille [julkinen API](/docs/public-api/) palauttaa samanlaista tilaa JSON-muodossa.

Liittyvät: [Discord-ilmoitukset](/docs/integrations/), [reaaliaikainen kartta](/docs/live-map/), [palvelinten luominen ja hallinta](/docs/servers/).
