---
title: 'Palvelinten luominen ja hallinta'
description: 'Luo, käynnistä, pysäytä, rakenna uudelleen ja määritä Minecraft-palvelimia ohjauspaneelissa: luontivelho, asetukset, muisti ja pelin portti.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

## Palvelimen luominen

Avaa ohjattu toiminto napsauttamalla **Luo palvelin** (yläpalkki) tai **Luo palvelin** -korttia.

![Luo palvelin](/docs/images/create-wizard.png)

Ohjattu toiminto esitäyttää Java-pinon ja levyn kiintiön asetussivun **Oletukset uusille palvelimille** -kohdasta, jota ylläpitäjä voi muuttaa milloin tahansa. Uusi palvelin saa myös suorituskyvyn rajoituksensa sieltä.

![Oletukset uusille palvelimille](/docs/images/settings-defaults.png)

Valitset:

- **Nimi** (ja valinnainen kuvaus, kuvake ja tehosteväri). Laivaston järjestämiseen käytettävät tunnisteet lisätään myöhemmin palvelimen asetuksissa.
- **Palvelintyyppi**: Vanilla, Paper tai Purpur **Vanilla**-välilehdellä. Modatulle palvelimelle **Modien kautta** -välilehti valitsee latausohjelman (Fabric, Forge, NeoForge tai Quilt), Minecraft-version ja latausohjelman koontiversion (viimeisin tai tietty), ja antaa sitten etsiä modeja.
- **Minecraft-versio**: `LATEST`, snapshot tai tietty versio (beta- ja alfaversiot mukaan lukien).
- **Peliportti**: ehdotetaan vapaata porttia. Etäkonsoli (RCON) käyttää porttia 1000 korkeampana (oletuksena). Voit muuttaa sitä myöhemmin (katso [Peliportin muuttaminen](#changing-the-game-port)).
- **Resurssit**: Java-pino (kontin muistiraja on asetettu 50 % korkeammaksi) ja levyn kiintiö.

**Lisäasetukset** avaa kaikki muut palvelinkuvan tukemat asetukset, sekä ylimääräiset ympäristömuuttujat ja (ylläpitäjille) edistyneet Docker-asetukset.

Haluatko mieluummin modpackin? **Modpackin kautta** -välilehti asentaa CurseForge-, Modrinth- tai GT New Horizons -paketin sen sijaan (katso [Modpackit](/docs/modpacks/)) tai ottaa **mukautetun zip-tiedoston, jonka lataat**: Modrinth `.mrpack`, CurseForge-modpack-vienti (`manifest.json`) tai mikä tahansa mod-jar-tiedostojen zip-paketti. Manifesti (tai enemmistön mielipide tunnistetuista jar-tiedostoista) täyttää latausohjelman ja Minecraft-version, ja jokainen modi asennetaan yhdessä tehtävässä. Voit myös aloittaa tallennetusta [Blueprintista](/docs/blueprints/) **Blueprintin kautta** -välilehdellä.

Paneeli valitsee automaattisesti järkevän Java-ajoympäristön versiollesi, lataa kuvan, luo kontin ja käynnistää sen, kaikki yhdestä lomakkeesta.

## Palvelinluettelo

**Palvelimet**-sivu listaa koko laivastosi tilan ja nopeiden tilastojen kera.

![Palvelinluettelo](/docs/images/servers-list.png)

## Yksittäinen palvelin

![Pelaajat](/docs/images/players.png)

Palvelimen avaaminen antaa sinulle välilehdellisen työtilan:

- **Yleiskatsaus**: osoite jaettavaksi pelaajien kanssa, kuvaus, reaaliaikainen käyttö ja kuka on online-tilassa.
- **Konsoli**: reaaliaikainen lokivirta ja komentosyöttö, pelin sisäinen chat ja [chat-komennot](/docs/console-and-chat/).
- **Pelaajat**: luettelo sekä inventaario ja tilastot.
- **Modit**: asennettujen modien luettelo, [modiselain](/docs/modpacks/) ja sisältöpäivitykset. Modatulla palvelimella sen **Versiot**-välilehti tarkistaa, mille tuleville Minecraft-versioille modisi ovat saatavilla ([päivitykset](/docs/updates/#minecraft-version-compatibility)).
- **Maailma**: [maailmat, reaaliaikainen kartta ja tiedostonhallinta](/docs/worlds-and-files/).
- **Varmuuskopiot**: [tilannekuvat ja palautus](/docs/backups/) tälle palvelimelle.
- **Valvonta**: palvelinkohtainen historia ja reaaliaikaiset mittarit, mukaan lukien kaatumisraportit (alla).
- **Asetukset**: **Määritykset** (kaikki palvelimen toimintaan liittyvä), sekä [integraatiot](/docs/integrations/) (Discord, Tilasivu, Kutsut ja ylläpitäjille Chatbot).

Käynnistys-, pysäytys- ja uudelleenkäynnistyspainikkeet sijaitsevat jokaisen välilehden yläpuolella olevassa otsikossa. Se, mitä voit tehdä kullakin välilehdellä, riippuu [oikeuksistasi kyseisellä palvelimella](/docs/users-and-roles/#per-server-permissions): esimerkiksi **Tiedostot**-välilehti vaatii Tiedostot-oikeuden, ja konsolikomentojen lähettäminen vaatii Konsoli-oikeuden.

![Palvelimen yleiskatsaus](/docs/images/server-overview.png)

**Maailman hallinta** -kisko kulkee mukana jokaisella välilehdellä: pelin sisäinen kello, sää, yleiset pelisäännöt kytkinpiireinä ja "Näytä kaikki maailman säännöt" loput.

![Maailman hallinta](/docs/images/world-controls.png)

**Valvonta → Reaaliaikainen** näyttää TPS:n ja millisekunnit per tikki, terveys- ja vakauskortin kaatumisilla (viimeiset 24 h ja 7 d), muistin loppumisen aiheuttamat tappamiset ja automaattiset uudelleenkäynnistykset, sekä maailmakohtaiset koot.

![Reaaliaikainen valvonta](/docs/images/monitoring-live.png)

## Palvelimen asetukset

**Asetukset → Määritykset** on täydellinen määrityspinta: nimi, kuvaus, MOTD, kuvake, väri ja tunnisteet, resurssit, peliportti, päivityskäytäntö, käynnistys paneelin käynnistyessä ja automaattinen uudelleenkäynnistys kaatumisen yhteydessä, jokainen ympäristömuuttuja, jota palvelinkuva tukee, edistyneet Docker-asetukset sekä blueprint-vienti, kloonaus, uudelleenrakennus ja poisto. Muutokset, jotka tulevat voimaan vasta palvelimen uudelleenrakentamisen jälkeen, tallennetaan heti ja odottavat: **Ota muutokset käyttöön** -painike ilmestyy palvelimen otsikkoon, ja ne otetaan käyttöön myös seuraavan kerran, kun palvelin käynnistyy.

**Automaattinen uudelleenkäynnistys kaatumisen yhteydessä** käynnistää kaatuneen palvelimen uudelleen, odottaen pidempään jokaisen yrityksen välillä (5, 10, sitten 20 sekuntia) ja pysähtyen 3 yrityksen jälkeen 10 minuutin sisällä. Se ohittaa kaatumiset, jotka paneeli tunnistaa asennusongelmaksi (EULA, väärä Java, uudemmasta versiosta peräisin oleva maailma, käytössä oleva portti, muistin loppuminen, puuttuva CurseForge-avain), koska ne vaativat ensin korjausta. Jos jokin muu toiminto on varattuna palvelimen kanssa (varmuuskopiointi, palautus, portin vaihto), se odottaa jopa 30 minuuttia ja luovuttaa heti, kun joku pysäyttää tai käynnistää palvelimen itse.

Suorat asetusmuutokset pysyvät aina uudelleenkäynnistyksissä. PvP- tai vaikeustason muutos, joka on tehty **Maailman hallinta** -kiskolla, valkoisen listan kytkin **Pelaajat**-välilehdellä tai `server.properties`-muokkaus **Tiedostot**-editorissa, poistaa vastaavan ympäristömuuttujan (jos sellainen oli asetettu) ja merkitsee palvelimen uudelleenrakennettavaksi, jolloin levyn päällä oleva arvo voittaa sen sijaan, että konttikuva vahvistaisi sen uudelleen seuraavalla käynnistyksellä.

![Palvelimen asetukset](/docs/images/server-settings.png)

**Muistimittarista.** "RAM (Java-pino)" annetaan Javalle sekä sen aloitus- että enimmäispinoina, ja Java täyttää sille etukäteen annetun pinon ensimmäisen minuutin aikana, Aikar / MeowIce -lippujen esiasetuksilla tai ilman. Joten muistimittari asettuu noin pinon kokoon ja pysyy siellä, vaikka kukaan ei pelaisikaan; mittarin tikki merkitsee, missä pino sijaitsee kontin rajan alla, ja sen alla oleva huomautus kertoo sen. Jos haluat muistin seuraavan todellista käyttöä, anna palvelimelle pienempi aloituspino **Alkupino**-kohdassa **Asetukset → Määritykset** -kohdan Resurssit-kortissa (tai ohjatun toiminnon **Lisäasetukset**-kohdassa), esimerkiksi 512 Mt: 2 Gt:n pinolla, joka toi tyhjäkäytön 2,6 Gt:sta noin 1,3 Gt:iin mittauksissamme. Java tarvitsee myös muistia pinon ulkopuolella (noin 0,5 Gt vanilla-versiossa, 1,5–2 Gt suuressa modpackissa), mihin kontin rajan liikkumavara on tarkoitettu. Katso README:n "Kaksi muistirajaa" numeroita varten.

> **Edistyneet Docker-asetukset** (kontin nimi, Docker-verkko, ylimääräiset porttimääritykset ja ylimääräiset volyymisidokset) ovat **vain ylläpitäjille**, koska sidottu liitos yhdistettynä paneelin Docker-käyttöoikeuteen on tehokkaasti root-käyttöoikeus isännällä. Katso [Käyttäjät ja roolit](/docs/users-and-roles/).

### Peliportin muuttaminen

**Asetukset → Määritykset** -kohdan **Peliportti**-kortti siirtää palvelimen toiseen porttiin milloin tahansa, omalla **Tallenna portti** -painikkeellaan. **Käytä seuraavaa vapaata porttia** valitsee alhaisimman vapaan portin, ja kortti tarkistaa minkä tahansa syöttämäsi portin ennen sen tallentamista. RCON seuraa aina 1000 korkeammalla kuin peliportti (oletuspoikkeama). Ylläpitäjät voivat valita minkä tahansa portin 1024 ylöspäin; kaikki muut valitsevat ensimmäisestä peliportista (oletuksena 25565) ylöspäin. Tallentaminen ottaa muutoksen käyttöön heti: pysäytetty palvelin vain siirtyy, ja käynnissä oleva palvelin kysyy ensin, ja käynnistyy sitten uudelleen uudessa portissa (maailma tallennetaan ensin, ja pelaajat yhdistävät uudelleen uudessa portissa). Jos palvelin ei käynnisty uudessa portissa, se palaa vanhaan. Muutos evätään, kun muut muutokset odottavat **Ota muutokset käyttöön** -painiketta, joten ota ne ensin käyttöön. Portin muuttaminen vaatii Asetukset-oikeuden kyseisellä palvelimella.

![Peliportti-kortti](/docs/images/server-port.png)

![Kehote ennen kuin käynnissä oleva palvelin käynnistyy uudelleen uudessa portissa](/docs/images/port-restart.png)

## Kaatumisraportit & mclo.gs-analyysi

Kaatumisraportit (`crash-reports/*.txt` ja JVM `hs_err_pid*.log` -tiedostot) poimitaan automaattisesti, jäsennetään yksiriviseksi yhteenvedoksi poikkeuksineen ja epäiltyine modeineen, ja listataan **Valvonta → Historia** -kohdassa:

![Kaatumisraportti-kortti](/docs/images/crash-mclogs-card.png)

Jokainen raporttikortti tarjoaa sisäänrakennetun katseluohjelman (laajennettavilla osioilla ja korostetuilla poikkeuksilla), pinon jäljennöksen kopioinnin ja latauksen, sekä kaksi [mclo.gs](https://mclo.gs) -toimintoa:

- **Jaa mclo.gs:ään** julkaisee raportin julkisena liitteenä ja kopioi linkin: täsmälleen sen, mitä modien tekijät ja tukichatit pyytävät. Linkki muistetaan raportissa, joten mitään ei koskaan ladata kahdesti.
- **Analysoi** suorittaa mclo.gs:n automaattiset oivallukset liitteen yli: tunnetut ongelmat ehdotetuilla korjauksilla (puuttuvat riippuvuudet, versioristiriidat, yleiset modikonfliktit), jotka näytetään suoraan paneelissa.

![mclo.gs-oivallukset](/docs/images/crash-insights.png)

Molemmat toiminnot ovat eksplisiittisen vahvistuksen takana, koska liite on julkinen: kaatumisraportit voivat sisältää pelaajien nimiä ja koko modilistasi. Paneeli ei koskaan lataa mitään itsestään.
