---
title: 'Päivitykset'
description: 'Seuraa ja asenna Minecraft-versioiden, modpackien, modien ja lisäosien päivitykset jokaiselle palvelimelle palvelinkohtaisella käytännöllä.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

**Päivitykset**-sivu seuraa yhdessä paikassa, mikä on vanhentunutta laitteistossasi:

- **Modpack**-versiot ([modpackit](/docs/modpacks/)) verrattuna Modrinth / CurseForge / GTNH-julkaisuindeksiin.
- Itse lisäämäsi **mukautettu sisältö** (modit, datapackit, resurssipackit, plugin-lisäosat), kukin verrattuna sen lähteeseen: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) tai GitHub Releases. GitHub-haut käyttävät ETag-uudelleenvahvistusta, joten päivittäiset tarkistukset tuskin koskettavat sen nopeusrajoitusta.
- **Docker-imagen** vanhentuneisuus: kunkin palvelincontainerin imagen ID verrattuna äskettäin haettuun tunnisteeseen (deduplikoidaan palvelinten välillä samalla tunnisteella), tarjotaan uudelleenrakennusta vaativana päivityksenä.
- **Itsenäiset versiopinnit**: palvelimelle ilman hallittua pakettia, eksplisiittinen `mc_version`-pinni verrattuna Mojangin manifestiin ja eksplisiittinen latausohjelman ympäristömuuttuja (`PAPER_BUILD`, `FORGE_VERSION` ja vastaavat) verrattuna latausohjelman rekisteriin. Paper-rakennukset tulevat PaperMC:n nykyisestä **Fill v3 API**:sta (vanha v2-pääte lopetti uusien Minecraft-versioiden vastaanottamisen). Modien palvelimella uudempaa Minecraft-versiota tarjotaan vasta, kun [versiotarkistus](#minecraft-version-compatibility) on osoittanut, että jokaiselle asennetulle modille on olemassa rakennusversio. Pinnattu Forge-palvelin tarjoaa Forgen suositellun rakennuksen, ei koskaan pinniä vanhempaa rakennusta, ja julkaisuun pinattuun palvelimeen ei koskaan tarjota esijulkaisua (beta-vaiheessa oleva voi saada uudemman betan tai julkaisun). Latausohjelman rakennuksen käyttö ottaa ensin varmuuskopion ennen päivitystä. Forge- tai NeoForge-palvelimen siirtäminen uuteen Minecraft-versioon tyhjentää sen pinnatun latausohjelman rakennusnumeron, koska rakennus tehdään yhdelle Minecraft-versiolle; avainsana, kuten `latest`, säilyy, koska se seuraa versiota itsestään. Valitaksesi tietyn rakennuksen itse, katso [modilatausohjelman version muuttaminen](#changing-the-mod-loader-version).

![Päivitykset](/docs/images/updates.png)

## Miten se toimii

Paneeli tarkistaa kunkin palvelimen pinnatut versiot ylävirran lähteeseen ja listaa kaiken, millä on uudempi julkaisu. Vastaava määrä näkyy myös [koontinäytön](/docs/dashboard/)' "Päivityksiä saatavilla" -ruudussa.

Tarkistukset suoritetaan päivittäin oletusarvoisella [aikataululla](/docs/schedules/) ja tarvittaessa **Tarkista kaikki nyt** -toiminnolla. **Ohita** rivillä lopettaa kyseisen version tarjoamisen; uudempi tarjotaan uudelleen. Päivityspolitiikka on palvelinkohtainen: paneeli jättää kaiken manuaaliseksi (oletus, joka myös pitää palvelimen poissa tästä sivusta), vain ilmoittaa sinulle, tai soveltaa pakettipäivityksiä itse ([päivityspolitiikka](/docs/modpacks/#update-policy)).

## Minecraft-version yhteensopivuus

Uudempi Minecraft-versio ei ole päivitys, jos modisi eivät voi tulla mukana. Jokaisella palvelimella on oma **Versiot**-välilehti (Modien alla), joka vastaa tähän kysymykseen:

- Palvelimen nykyinen versio ja **korkein versio, jolle jokaisella asennetulla modilla on rakennusversio**.
- Yksi laajennettava rivi tulevaa Minecraft-versiota kohden, näyttäen kuinka monta modia on valmiina ja kuinka monelle ei ole vielä julkaistu mitään. Avaa rivi nähdäksesi, mitkä modit jäisivät jälkeen ja mitkä ovat kunnossa.

![Version yhteensopivuus](/docs/images/server-versions.png)

Paina **Tarkista tulevat versiot** suorittaaksesi sen. Mikään ei skannaa itsestään: tarkistus lukee jokaisen jar-tiedoston palvelimen mod-kansiosta ja kysyy Modrinthilta ja CurseForgelta jokaisesta, joten se tapahtuu vain pyydettäessä. Edistyminen ja osittaiset tulokset kirjoitetaan sen edetessä, joten sivun sulkeminen tai päivittäminen ei menetä mitään, ja paneelin uudelleenkäynnistyksen keskeyttämä tarkistus ilmoittaa siitä ja tarjoaa uudelleenajon. Kaikki, minkä keskeytynyt tarkistus oli jo selvittänyt, säilyy, joten uudelleenajaminen ei toista työtä.

Raportti kuvaa vain palvelinta, jolle se tehtiin. Muuta Minecraft-versiota, latausohjelmaa tai itse modeja (lisää yksi, poista yksi, päivitä yksi) ja raportti merkitään vanhentuneeksi ja lakkaa olemasta käytössä, kunnes suoritat tarkistuksen uudelleen.

Modit tunnistetaan modipakin omasta tiedostoluettelosta, jos sellainen on, ja muuten tiedoston sisällön perusteella, samalla tavalla kuin käynnistysohjelma tunnistaa jar-tiedoston. Kahden tyyppisiä modeja ei voida vastata, eikä kumpaakaan arvata:

- **Ei voitu tunnistaa**: käsin rakennettu jar-tiedosto tai yksityinen rakennus, jota kumpikaan rekisteri ei tunnista.
- **Ei voitu tarkistaa**: mod GitHub Releasesista, Hangartista tai SpigotMC:stä, tai sellainen, jonka projekti on poistettu. Nämä eivät julkaise luetteloa siitä, mille Minecraft-versiolle kukin rakennus on tarkoitettu.

Kun jompikumpi on asennettu, paneeli ei tarjoa yhden klikkauksen Minecraft-version päivitystä lainkaan, koska se ei voi rehellisesti sanoa, mikä rikkoutuisi. Modien tukeman version ylittävän version käyttöönotto evätään ja nimetään sitä estävät modit.

**Poistamasi** modit eivät osallistu: palvelin ei lataa niitä, joten modin poistaminen käytöstä on todellinen tapa päästä esteen ohi. Modin päälle- tai poiskytkeminen merkitsee raportin uudelleentarkistettavaksi.

Tämä kattaa modien kanssa toimivat palvelimet: Fabric, Forge, NeoForge ja Quilt. Paper-tyyliset plugin-palvelimet säilyttävät tavallisen uusimman julkaisun käyttäytymisen eivätkä niillä ole Versiot-välilehteä, koska kaksi rekisteriä, joista plugin-lisäosat tulevat, eivät julkaise mitään, mitä tarkistus voisi lukea.

![Versio avattuna, näyttäen mitkä modit jäisivät jälkeen](/docs/images/server-versions-expanded.png)

Version avaaminen listaa ensin modit, joille ei ole rakennusversiota (ne, jotka määrittävät vastauksen), ja pitää valmiit modit klikkauksen takana. Suuret paketit lataavat modisivun kerrallaan, joten 300 modin palvelin avautuu yhtä nopeasti kuin viiden modin palvelin.

## Modilatausohjelman version muuttaminen

**Versiot**-välilehdellä on myös **Latausohjelman versio** -kortti. Se näyttää, mikä Forge-, NeoForge-, Fabric- tai Quilt-rakennus palvelimella on asennettuna ja, missä se voidaan muuttaa, valitsimen toiseen vaihtamiseksi.

- **Forge-, NeoForge-, Fabric- tai Quilt-palvelin** voi käyttää mitä tahansa julkaistua rakennusta. Valitsin listaa palvelimen Minecraft-versiolle viimeisimmät rakennukset, merkittyinä Forgen suositelluilla ja uusimmilla rakennuksilla. **Muu rakennus…** ottaa minkä tahansa vanhemman rakennuksen sen numeron perusteella, ja **Oletus** palaa siihen, että palvelin valitsee itse.
- **Forge- tai Fabric CurseForge-modipakkaus** asentaa latausohjelman version, jonka oma manifesti ilmoittaa, joten tavallinen tapa muuttaa sitä on päivittää paketti. Kun paketti itse listaa väärän version (sisällä oleva modi pyytää uudempaa Forgea kuin paketti asentaa), kortti voi ohittaa sen, ja **Modipakkauksen versio** poistaa ohituksen uudelleen. Paketin päivittäminen poistaa sen myös, koska uusi versio ilmoittaa oman latausohjelmansa. Jos uusi versio edelleen listaa väärän, aseta ohitus uudelleen.
- **NeoForge CurseForge-modipakkaus tai Modrinth-modipakkaus** näyttää latausohjelmansa, mutta sitä ei voi ohittaa: palvelinimage soveltaa ohitusta vain Forge- ja Fabric-paketteihin. Sen latausohjelma seuraa paketin versiota, joten päivitä paketti sen sijaan. FTB-paketin latausohjelmaa ei myöskään voi muuttaa täällä. Sen kortti ei yleensä ilmesty, koska FTB:n oma asentaja säilyttää tietoja, joita paneeli ei lue.

Paneeli tarkistaa, että rakennus on olemassa, ennen kuin se kysyy sinulta mitään. Forge- tai NeoForge-rakennus tehdään yhdelle Minecraft-versiolle, joten uusinta julkaisua seuraavalla palvelimella sen pinnittäminen pitää myös palvelimen senhetkisessä Minecraft-versiossa (vahvistus sanoo niin). **Oletus**-valinnan tekeminen sen jälkeen poistaa pinnin, mutta säilyttää kyseisen Minecraft-version. Uusinta julkaisua seurannut palvelin voi myös siirtyä eri Java-imageen, kun se rakennetaan uudelleen, sen tarvitsemaan versioon. Tällaiselta palvelimelta, joka ei ole koskaan käynnistynyt, pyydetään ensin käynnistymään kerran, jotta paneeli tietää version. Forge ohittaa rakennusnumerot (ei ole 47.4.14 välillä 47.4.13 ja 47.4.15), joten modi, joka "vaatii 47.4.14 tai korkeamman", tyydytetään seuraavalla rakennuksella, ja kieltäytyminen nimeää sen. Muutos ottaa varmuuskopion ennen päivitystä ja rakentaa palvelimen uudelleen. Uusi rakennus asennetaan seuraavan kerran, kun palvelin käynnistyy, ja kortti sanoo niin siihen asti.

## Modipäivityksen peruuttaminen

Jokainen modi, josta modi on päivitetty, pysyy jaetussa kirjastossa, joten päivitys, joka rikkoo jotain, on peruutettavissa. Modin rivi **Modit**-välilehdellä saa **Peruuta**-painikkeen, joka palauttaa edellisen rakennuksen. Latausta ei ole, joten se toimii, vaikka projekti olisi sittemmin poistettu rekisteristään. Rakennus, josta peruutit, lakkaa olemasta tarjolla, kunnes uudempi ilmestyy.

![Peruuta modi rakennukseen, josta se päivitettiin](/docs/images/mods-revert.png)

## Päivityksen käyttöönotto

Päivitykset eivät ole koskaan hiljaisia. Kun valitset paketin päivittämisen (tai [sen vaihtamisen toiseen versioon](/docs/modpacks/#changing-the-pack-version), vanhemmat mukaan lukien), paneeli:

1. Ottaa **varmuuskopion ennen päivitystä** (joten se on peruutettavissa; oletuksena viimeiset 10 varmuuskopiota ennen päivitystä per palvelin säilytetään, katso [säilytys](/docs/backups/#retention)).
2. Pinnaa tarkan uuden version uudelleen.
3. Rakentaa palvelimen uudelleen, ratkaisten Java-ajoympäristön tarvittaessa uudelleen.
4. Valvoo ensimmäistä käynnistystä, alustakohtaisella aikarajalla.

Jos se ei käynnisty terveesti, palautat varmuuskopion ennen päivitystä. Vakaata versiota seuraavalle palvelimelle ei koskaan tarjota beta-versiota, ja muutoshistorian linkki osoittaa todelliseen versioiden väliseen eroon, jossa lähde tarjoaa sellaisen. Epäonnistunut päivitys laukaisee myös Discord-hälytyksen [hälytyksen](/docs/integrations/), jos integraatio on määritetty.
