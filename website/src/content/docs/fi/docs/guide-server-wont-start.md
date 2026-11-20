---
title: 'Minecraft-palvelimesi ei käynnisty'
description: 'Minecraft-palvelin, joka ei käynnisty, korjattuna todennäköisyysjärjestyksessä: loki, Java-versio, muisti, EULA ja portti sekä modit.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Työstä tätä listaa alaspäin. Se on järjestetty sen mukaan, kuinka usein kukin kohta on ratkaisu, ja neljä ensimmäistä kattavat suurimman osan ongelmista.

## 1. Lue viimeiset kaksikymmentä riviä, älä ensimmäisiä

Vieritä lokin **loppuun**. Java-pinon jäljitys tulostuu sisimmästä ulospäin, joten tekstiseinän yläosa on vähiten kiinnostava osa. Haluat löytää viimeisen `Caused by:` -rivin ja sen, mitä sen jälkeen tulee. Yksi rivi yleensä kertoo ongelman.

Kaksi muotoa kertoo, missä olet:

- `Exception in thread "main"` tai kaatoraportin polku lähellä loppua tarkoittaa, että itse peli epäonnistui.
- Lokin yksinkertainen keskeytyminen kesken rivin, ilman poikkeusta, tarkoittaa, että jokin tappoi prosessin ulkopuolelta. Siirry kohtaan 3.

## 2. UnsupportedClassVersionError tarkoittaa väärää Javaa

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Luokkatiedosto 52 on Java 8, 60 on 16, 61 on 17, 65 on 21, 69 on 25. Viesti tarkoittaa, että palvelin tarvitsee uudemman Javan kuin millä se toimii; päinvastoin, vanha paketti uudella Javalla epäonnistuu yleensä sekoitus- tai heijastusvirheellä.

| Minecraft-versio  | Java |
| ----------------- | ---- |
| 1.16.5 ja aiemmat | 8    |
| 1.17              | 16   |
| 1.18 ja 1.19      | 17   |
| 1.20 – 1.20.4     | 17   |
| 1.20.5 – 1.21.x   | 21   |
| 26.1 ja uudemmat  | 25   |

Vanhat paketit tarvitsevat todella Java 8:aa. Uudempi ei ole parempi tässä.

## 3. Poistumiskoodi 137 on ydin, ei modi

Loki pysähtyy kesken lauseen, kaatoraporttia ei ole, ja säiliö raportoi 137. Se on muistin loppumisen aiheuttama tappo: prosessi pyysi muistia, jota koneella ei ollut, joten se lopetettiin.

Lähes aina Java-kasa oli asetettu samalle luvulle kuin koneen muisti. Kasa tarvitsee koneen muistin **miinus** JVM:n oman ylikuorman, joka on 0,5–1,5 Gt modatulla palvelimella. Pienennä kasaa tai kasvata konetta. [Kuinka paljon RAM-muistia palvelin tarvitsee](/docs/guide-server-memory/) sisältää luvut.

## 4. EULA ja portti

Kaksi klassikkoa yhden rivin korjauksilla:

- `You need to agree to the EULA in order to run the server.` Aseta `eula=true` tiedostoon `eula.txt` tai ympäristömuuttujaan, jota asetuksesi käyttää.
- `Address already in use` tai `FAILED TO BIND TO PORT`. Jokin muu käyttää porttia 25565, usein sama palvelin edellisestä kopiosta, joka ei koskaan täysin pysähtynyt. Etsi se ja pysäytä se portin vaihtamisen sijaan, tai saat kaksi.

## 5. Modilta puuttuu riippuvuus

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric-modit tarvitsevat ylivoimaisesti Fabric API:n erillisenä tiedostona. Forge ja NeoForge -modit listaavat riippuvuutensa itse virheessä. Asenna nimetty versio, ei uusinta: "requires 0.91.x" tarkoittaa kyseistä riviä, ja 0.92 epäonnistuu samassa tarkistuksessa.

Joskus puuttuva riippuvuus on itse lataaja:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Korjaus on uudempi lataajaversio, ei eri modi. "47.4.14 tai uudempi" tarkoittaa mitä tahansa rakennusta siitä ylöspäin, ja Forge ei julkaise jokaista numeroa, joten asennettava rakennus voi olla seuraava. Modipaketissa päivitä ensin paketti: paketti, jonka oma lataajaversio on liian vanha modeilleen, on sen tekijän korjattava virhe.

## 6. Modi on väärälle lataajalle tai versiolle

Eri lataajalle tarkoitettu jar-tiedosto ei epäonnistu kohteliaasti. Odotettavissa on sekoitusvirhe, `NoClassDefFoundError` tai kaatuminen luokassa, josta et ole koskaan kuullut. Tarkista jar-tiedoston sivu: lataajan ja Minecraft-version on täsmättävä täsmälleen. 1.20.1 ja 1.20.4 ovat eri pelejä modien kannalta.

## 7. Maailma on uudemmasta versiosta

```
This world was created by a newer version of Minecraft
```

Maailmat päivittyvät eteenpäin eivätkä koskaan taaksepäin. Palauta varmuuskopio ennen päivitystä tai suorita versio, jota maailma odottaa. Ei ole olemassa alaspäin päivittämispolkua, joka säilyttäisi palaset ehjinä.

## Kun se kaatui viikkojen ajan toimiessaan hyvin

Eri kysymys, yleensä eri vastaus:

- **Se kaatui kuormituksessa**, ajoitukset näyttäen pitkiä taukoja: roskienkeruu, joten tarkastele kekomuistia ennen modeja.
- **Se kaatui samassa kohdassa maailmaa**: vioittunut palanen tai rikkinäinen entiteetti. Kaatoraportti yleensä kertoo koordinaatit.
- **Se kaatui heti päivityksen jälkeen**: päivittynyt modi on epäilty, vaikka jäljitys osoittaisi muualle. Palauta se ja katso.
- **Se kaatui uudelleenkäynnistyksen yhteydessä, oltuaan aiemmin kunnossa**: tarkista levy. Täysi levy tuottaa näyttäviä ja harhaanjohtavia virheitä.

## Avun hankkiminen, joka todella auttaa

Lähetä **koko loki**, älä viimeistä riviä, ja kerro, mitä muutit ennen kuin se hajosi. Liitä se johonkin siihen tarkoitettuun paikkaan, kuten [mclo.gs](https://mclo.gs), sen sijaan että liittäisit sen chattiin. Sisällytä Minecraft-versio, lataaja, paketti ja sen versio sekä kuinka paljon kekomuistia palvelimella on. Neljä asiaa sisältävä raportti saa vastauksen yhdessä viestissä; ilman niitä se vaatii viisi.

## Minecraft Server Managerissa

Kaatumiset havaitaan säiliön omasta poistumisesta, joten yöllä kolmelta kuollut palvelin tallennetaan lokin katkelmalla sen sijaan, että se löydettäisiin seuraavana päivänä. Tämän sivun tavalliset epäillyt (EULA, väärä Java, uudemmasta versiosta oleva maailma, jo käytössä oleva portti, Java-muistin loppuminen) tunnistetaan lokista ja nimetään historiatiedossa, ja kerrotaan mitä niille tehdä, ja automaattinen uudelleenkäynnistys jättää ne rauhaan, koska uudelleenkäynnistys ei korjaa niitä. Kaatoraportit jäsennetään saapuessaan: poikkeus korostetaan, pino on laajennettavissa ja jäljityksessä esiintyvät modit listataan epäillyiksi.

Mikä tahansa raportti voidaan jakaa mclo.gs:ään sen kortista, kun tarvitset apua (vahvistuksen jälkeen, koska liite on julkinen), ja konsolin **Lataa**-valikossa on kaikki lokitiedostot yhtenä zip-tiedostona, joten "lähetä koko loki" on lataus eikä arkeologinen projekti. Muistin loppumisen aiheuttama tappo tallennetaan muistin loppumisen aiheuttamana tappona, mikä säästää tavallisen tunnin modien syyttämisessä. Jos jokin muu todella tarvitsee porttia, **Asetukset → Konfiguraatio** -kohdan **Pelipaikka**-kortti siirtää palvelimen vapaaseen porttiin.

Liian vanha lataaja vaihdetaan palvelimen **Versiot**-välilehdeltä, joka tarkistaa rakennuksen olemassaolon ja ottaa varmuuskopion ennen palvelimen uudelleenrakentamista ([modilataajan version vaihtaminen](/docs/updates/#changing-the-mod-loader-version)).

Liittyvät: [kuinka paljon RAM-muistia palvelin tarvitsee](/docs/guide-server-memory/), [lataajan valinta](/docs/guide-choosing-a-loader/),
[palvelimien luominen ja hallinta](/docs/servers/).
