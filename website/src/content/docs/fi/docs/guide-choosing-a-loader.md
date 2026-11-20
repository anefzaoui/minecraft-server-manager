---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: kumpi?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge vai Quilt: kumpi Minecraft-palvelintyyppi ajetaan, valittuna sen perusteella, mitä pelaajasi asentavat.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Valitse sen perusteella, mitä haluat pelaajien asentavan, älä sen perusteella, mikä kuulostaa nopeimmalta.

| Haluatko                                                     | Suorita tämä          | Pelaajat asentavat |
| ------------------------------------------------------------ | --------------------- | ------------------ |
| Selviytymistä ystävien kanssa, ei mitään erikoista           | Vanilla               | Ei mitään          |
| Julkisen palvelimen, jossa on tasoja, alueita ja moderointia | Paper                 | Ei mitään          |
| Tietyn modipaketin CurseForgesta tai Modrinthista            | Mitä tahansa se sanoo | Paketin            |
| Itse rakentamasi moderni modipaketti                         | Fabric tai NeoForge   | Samat modit        |
| Vanha paketti aikakaudelta 1.7–1.12                          | Forge                 | Samat modit        |

Useimmille tämä riittää päätökseksi. Loput sivusta selittää miksi.

## Plugin-lisäosat ja modit eivät ole sama asia

Tämä ero on kaiken muun perusta.

**Plugin-lisäosat** toimivat vain palvelimella. Paper, Spigot ja Bukkit lataavat ne. Pelaajat liittyvät tavallisella, muokkaamattomalla asiakasohjelmalla eivätkä tiedä mitään. Kaikki, mikä liittyy olennaisesti sääntöihin, käyttöoikeuksiin, talouteen, alueisiin, minipeleihin tai moderointiin, on plugin-lisäosa, ja siksi lähes kaikki julkiset palvelimet käyttävät Paperia.

**Modit** muuttavat itse peliä: uusia lohkoja, uusia ulottuvuuksia, uusia koneita. Asiakasohjelman on ladattava samat modit kuin palvelimen, muuten se ei ymmärrä, mitä palvelin sille kertoo. Kuka tahansa, joka liittyy modattuun palvelimeen, asentaa ensin paketin.

Palvelin ei voi merkityksellisesti olla molempia. On olemassa hybridiprojekteja, jotka liittävät plugin-rajapinnan modilataajaan, ja ne toimivat, kunnes ne eivät toimi, yleensä pahimmalla hetkellä. Jos tarvitset molempia, käytä välityspalvelinta modatun palvelimen ja plugin-palvelimen kanssa sen sijaan, että käyttäisit yhtä hybridiä.

## Plugin-lisäosien puoli

**Paper** on oletusvastaus. Se on Spigotin haara, johon on vuosien suorituskykytyö ja konfiguraatiotiedosto lähes jokaiselle käyttäytymiselle, joka on koskaan ärsyttänyt ylläpitäjää. Vanhan Bukkit-aikakauden plugin-lisäosat toimivat edelleen suurimmaksi osaksi.

**Purpur** on Paperin haara, jossa on vielä enemmän säätimiä, mukaan lukien pelillisiä. Ota se, jos haluat nuo tietyt kytkimet; muuten Paper.

**Vanilla** on syytä suorittaa, kun kyse on muuttumattomasta pelistä. Se on hitaampi monilla pelaajilla, eikä siinä ole käyttöoikeusjärjestelmää, joten moderointi on manuaalista.

Paper muuttaa oletuksena joitakin vanilla-käyttäytymisiä suorituskyvyn nimissä. Jos punakivikoneisto videosta ei toimi palvelimellasi, se johtuu yleensä siitä, ja se on yleensä asetus.

## Modien puoli

**Fabric** on pieni, päivittyy uuteen Minecraft-versioon päivien kuluessa ja sisältää useimmat modernit suorituskykymodit. Lähes kaikki Fabric-modit vaativat myös Fabric API:n, joka on erillinen lataus. Jos tavoitteenasi on nopea palvelin muutamalla laadun parannusmodilla, tämä on se.

**NeoForge** on paikka, jossa vanha Forge-ekosysteemi nyt tekee työnsä nykyisille versioille. Se erkani Forgesta version 1.20.1 aikana, ja useimmat suuret paketit, jotka on rakennettu versioille 1.20.2 ja uudemmille, kohdistuvat siihen. Jos aloitat uuden raskaasti modatun paketin tänään, tämä on se.

**Forge** omistaa edelleen menneisyyden. Kaikki aikakausilta 1.7.10, 1.12.2 ja 1.16.5, mikä on suuri osa rakastetuista paketeista, on Forge ja tulee aina olemaan. Pidä se niitä varten.

**Quilt** on Fabricin haara, joka suorittaa useimmat Fabric-modit. Se on olemassa hyvistä syistä, mutta jos sinulla ei ole erityistä syytä valita sitä, valitse Fabric.

Yhdelle lataajalle tarkoitetut modit eivät toimi toisella. Modisivu, jossa lukee Fabric, tarkoittaa Fabricia.

## Jos asennat paketin, paketti päättää

Älä valitse. Paketti listaa lataajansa ja tarkan Minecraft-versionsa, ja molempien on täsmättävä. "Lähellä tarpeeksi" ei ole asia täällä: paketti versiolle 1.20.1 ei toimi versiolla 1.20.4, ja 1.20.1 NeoForge-paketti ei toimi 1.20.1 Forgella.

Asenna paketti sen tunnisteen tai linkin perusteella sen sijaan, että valitsisit modit käsin, ja kiinnitä versio. Paketit päivittyvät, ja päivitys, joka ilmestyy jalkoihisi kauden puolivälissä, on tapa, jolla maailmat vioittuvat.

## Mikä Java-versio

Minecraftin vaatimus liikkuu pelin mukana, ja väärän version käyttäminen tuottaa hyödyttömän `UnsupportedClassVersionError`-virheen selkeän viestin sijaan.

| Minecraft-versio  | Java |
| ----------------- | ---- |
| 1.16.5 ja aiemmat | 8    |
| 1.17              | 16   |
| 1.18 ja 1.19      | 17   |
| 1.20–1.20.4       | 17   |
| 1.20.5–1.21.x     | 21   |
| 26.1 ja uudemmat  | 25   |

Vanhat paketit todella tarvitsevat Java 8:aa; tämä on yksi harvoista paikoista ohjelmistossa, jossa uusin versio on väärä.

## Minecraft Server Managerissa

Luontivelho kysyy, mitä haluat suorittaa, ja valitsee Java-version yllä olevasta taulukosta, joten yhteensopimattomuus ei koskaan tapahdu vahingossa. Vanilla, Paper ja Purpur ovat **Vanilla**-välilehdellä; **From Mods** -välilehti ottaa vastaan Fabricin, Forgen, NeoForgn tai Quiltin, Minecraft-version ja lataajan rakennuksen (viimeisimmän tai kiinnittämäsi). Paketin asentaminen CurseForgesta, Modrinthista tai GT New Horizonsista kiinnittää sen tarkkaan versioon. Päivitys tapahtuu vain, kun otat sen käyttöön (tai päivittäisen tarkistuksen jälkeen, jos palvelimen päivityskäytäntö on **Auto-Update**), ottaa aina ensin varmuuskopion ja sen voi peruuttaa.

Modiselain tietää, mitä lataajaa palvelin käyttää, ja suodattaa tarjottavat sen mukaisesti, joten Fabric jar ei voi vahingossa päätyä NeoForge-palvelimelle.

Aiheeseen liittyvät: [palvelinten luominen ja hallinta](/docs/servers/), [modipaketit](/docs/modpacks/),
[kuinka paljon RAM-muistia palvelin tarvitsee](/docs/guide-server-memory/).
