---
title: 'Maailman pienentäminen'
description: 'Ajan myötä maailma leviää: jokainen paikka, jossa pelaaja on koskaan kävellyt, lentänyt tai'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Takaisin dokumenttien hakemistoon](/docs/)

Ajan myötä maailma laajenee: jokainen paikka, jossa pelaaja on kävellyt, lentänyt tai joutunut Ender-helmen kuljettamaksi, jättää levylle generoituja paloja, vaikka kukaan ei enää palaisi sinne. **Pienennä maailmaa** poistaa palat, joissa kukaan ei ole juuri viettänyt aikaa, joten maailma vie vähemmän tilaa. Minecraft rakentaa poistetun alueen uudelleen maailman siemenestä sillä hetkellä, kun joku matkustaa sinne uudelleen, joten tämä on turvallista käyttämättömälle maalle. Kaikki, mitä pelaaja on _rakentanut_ paikassa, jossa hän tuskin seisoi, katoaisi myös, minkä vuoksi sinun tulisi ottaa varmuuskopio ensin (varmuuskopio on peruutus).

## Mikä lasketaan "harvoin vierailluksi"

Jokainen pala tallentaa, kuinka kauan pelaajat ovat viettäneet aikaa siinä (Minecraft kutsuu tätä `InhabitedTime`). Pienennä maailmaa poistaa oletuksena kaikki palat, joiden kokonaispelaajaaika on alle **30 sekuntia**; pienennysvalintaikkuna antaa sinun muuttaa tätä rajaa (1 sekunnista 1 tuntiin) ja kuinka monta palaa spawnin ympäriltä säilytetään (oletus 8, `0` poistaa spawn-suojauksen käytöstä).

Mikä säilytetään, aina:

- Alue maailman **spawn-pisteen** ympärillä (luetaan `level.dat`-tiedostosta) yli-maailmassa. Netherissä, Endissä ja mukautetuissa ulottuvuuksissa ei ole spawn-aluetta.
- Kaikki palat, joiden käyntiaikaa ei voitu lukea, esimerkiksi maailma, joka on tallennettu pakkausmuodossa, jota paneeli ei pura (LZ4). Esikatselu ja tulos kertovat, kuinka monta tällaista palaa ohitettiin.

Maailman jokainen ulottuvuus katetaan: Bukkit-tyyliset sisarhakemistot (`world_nether`, `world_the_end`) sekä vanilla- ja Forge/Fabric-asettelu (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Kun pala poistetaan, sen olennot ja kyläläisten kiinnostavat kohteet katoavat sen mukana, joten uudelleen generoitu pala ei peri vanhentuneita hirviöitä, raitiovaunuja tai työpaikkoja.

## Tekeminen Maailmat-välilehdeltä

1. Ota varmuuskopio **Varmuuskopiot**-välilehdeltä. Maailman pienentäminen Maailmat-välilehdeltä ei ota sitä automaattisesti.
2. Avaa **Maailma → Maailmat**, etsi maailma ja napsauta pienennyskuvaketta.
3. Napsauta **Esikatselu** nähdäksesi karkeasti, kuinka monta palaa (ja kuinka monta megatavua) poistettaisiin. Mitään ei ole vielä muutettu; esikatselu toimii palvelimen ollessa käynnissä.
4. Napsauta **Pienennä maailmaa**. Pienentäminen muokkaa maailmatiedostoja suoraan, joten palvelin on pysäytettävä: pysäytä se ensin tai valitse vaihtoehto pysäyttää se, pienentää ja käynnistää se uudelleen yhdellä kertaa (palvelin käynnistetään uudelleen, vaikka pienennys epäonnistuisi). Edistyminen näkyy tehtäväpalkissa.

![Pienennä maailmaa](/docs/images/world-shrink.png)

## Tekeminen osana varmuuskopiota

Varmuuskopiot-välilehdellä valitse **"Pienennä maailmaa myös sen jälkeen"** ennen **Varmuuskopioi nyt** -painiketta. Varmuuskopioarkisto kirjoitetaan ensin (arkisto on peruutus), sitten maailma pienenee, mutta vain jos palvelin on pysäytetty. Jos palvelin on käynnissä, varmuuskopio suoritetaan silti ja pienennys ohitetaan huomautuksella.

Aikataulutetut varmuuskopiot sisältävät saman vaihtoehdon: valitse aikataulueditorissa **Varmuuskopio**-tehtävä ja valitse **"Pienennä maailmaa jokaisen varmuuskopion jälkeen"**. Yhdistä se **Pysäytä palvelin** -aikatauluun muutamaa minuuttia aiemmin, jos haluat sen suoritettavan ilman valvontaa.
