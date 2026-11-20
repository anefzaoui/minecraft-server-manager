---
title: 'Konsoli ja chat-komennot'
description: 'Konsoli-välilehti näyttää palvelimen lokin reaaliaikaisesti ja tarjoaa komentoruudun, johon voit lähettää minkä tahansa palvelinkomennon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

## Reaaliaikainen konsoli

**Konsoli**-välilehti näyttää palvelimen lokin reaaliaikaisesti ja tarjoaa komentokentän palvelimen komentojen lähettämiseen. Ei `docker exec`iä, ei SSH:ta. Tuloste tulee takaisin suoraan, väreineen kaikkineen. Komentojen lähettäminen vaatii kyseisen palvelimen Console-oikeuden; ilman sitä voit silti seurata lokia.

Lokin yläpuolella voit suodattaa rivejä tekstin (tai `/regex/`) ja tason (INFO, WARN, ERROR) perusteella, ja **Lataa** tarjoaa viimeisimmän tulosteen, koko `latest.log`-tiedoston tai kaikki lokitiedostot zip-pakattuna.

![Konsoli](/docs/images/server-console.png)

Konsoli on myös paikka, josta paneeli lukee palvelimen tilan: se seuraa lokia luokitellakseen käynnistysvaiheen ("Loading mods", "Generating world", "Finishing startup") ja kutsuu `list`-komentoa seuratakseen, ketkä ovat online-tilassa, joten kojelauta ja palvelinkortit heijastavat aina todellisuutta.

Tämä kysely avaa lyhytikäisen RCON-yhteyden joka syklissä, jonka palvelin kirjaa lokiin `Thread RCON Client … started` / `shutting down` -parina noin 20 sekunnin välein, ja (palvelimilla, joiden ydin tai lisäosat toistavat sen) `Rcon issued server command: …` -rivinä jokaiselle vain luku -kyselylle (`list` pelaajamäärille, sekä `time query …` ja `gamerule <name>` -luvut World Controlsin ollessa auki). **Piilota konsolin kohina** -kytkin lokin yläpuolella suodattaa nämä rivit pois (sekä RCON-kuuntelijan käynnistysrivit). Se on oletuksena päällä ja muistetaan per selain; kytke se pois päältä nähdäksesi raa'an syötteen.

Paneelista lähetetyt komennot voidaan ilmoittaa pelissä palvelinkohtaisen tunnisteen alla (**Ilmoita nimellä…** -kenttä), jotta pelaajat tietävät operaattorin toimineen, eikä salaperäisen konsolin.

## Chat

**Konsoli → Chat** lähettää viestejä peliin palvelimen ollessa käynnissä: **Muotoillut** viestit ottavat värit ja muotoilut ja voivat mennä kaikille tai yhdelle online-pelaajalle, ja **Selkeä** lähettää yksinkertaisen `[Server]` -lähetyksen kaikille.

![Konsoli → Chat](/docs/screenshots/04-chat.png)

## Chat-komennot

Chat-komennot (**Konsoli → Komennot**) antavat pelaajien käynnistää paneelin toiminnot kirjoittamalla etuliitteen komennon pelichatissa, esimerkiksi `!spawn` satunnaista teleporterointia varten. Tunnistus perustuu lokiin ja suoritus tapahtuu palvelimen kautta, joten **lisäosia ei vaadita**.

![Chat-komennot](/docs/images/chat-commands.png)

Jokaisella komennolla on:

- **Käynnistin** (esim. `spawn`), kirjoitetaan palvelimen **etuliitteen** (`!` oletuksena, yksi tai kaksi merkkiä, ei koskaan `/`) jälkeen.
- **Toiminto**: satunnainen teleporterointi, teleporterointi rakenteeseen, teleporterointi biomiin tai raakojen konsolikomentojen suorittaminen.
- **Oikeustaso**: kaikki, valkoisella listalla olevat pelaajat tai vain operaattorit.
- Pelaajakohtainen **viive** (oletuksena 30 sekuntia) ja muokattavat odotus-/onnistumis-/virheviestit paikkamerkeillä kuten `{distance}`.

### Huomautus turvallisuudesta

Palvelinta tuhoavat komennot (`stop`, `op`, `ban`, `whitelist` ja vastaavat) ovat sallittuja vain **vain operaattoreille** tarkoitettujen käynnistimien kautta. Paneeli tarkistaa nämä, vaikka ne olisivat sisäkkäin `execute … run …` -ketjussa, joten matalan oikeustason käynnistin ei voi salakuljettaa vaarallista komentoa läpi. Tavallinen chat-teksti, joka vain mainitsee nuo sanat (kuten `say`-viesti), jätetään huomiotta.
