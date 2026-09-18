---
title: 'Konsoli ja chat-komennot'
description: 'Konsoli-välilehti näyttää palvelimen lokin reaaliaikaisesti ja tarjoaa komentoruudun, johon voit lähettää minkä tahansa palvelinkomennon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

## Reaaliaikainen konsoli

**Konsoli**-välilehti näyttää palvelimen lokin reaaliaikaisesti ja tarjoaa komentokentän palvelimen komentojen lähettämiseen. Ei `docker exec`, ei SSH:ta. Tuloste tulee takaisin suoraan, väreineen kaikkineen.

![Konsoli](/docs/images/server-console.png)

Konsoli on myös paikka, josta paneeli lukee palvelimen tilan: se tarkkailee lokia luokitellakseen käynnistysvaiheen ("Ladataan modeja", "Luodaan maailmaa", "Viimeistellään käynnistystä") ja kutsuu `list`-komentoa seuratakseen, ketkä ovat online-tilassa, joten kojelauta ja palvelinkortit heijastavat aina todellisuutta.

Tämä kysely avaa lyhytikäisen RCON-yhteyden joka syklissä, jonka palvelin kirjaa lokiin `Thread RCON Client … started` / `shutting down` -parina noin 20 sekunnin välein, ja (palvelimilla, joiden ydin tai lisäosat toistavat sen) `Rcon issued server command: …` -rivinä jokaiselle vain luku -kyselylle - `list` pelaajamäärille, sekä `time query …` ja `gamerule <name>` -luvut, kun Maailmanohjaimet-sivu on auki. Lokiruudun yläpuolella oleva **Piilota RCON-kohina** -kytkin suodattaa nämä rivit pois (yhdessä RCON-kuuntelijan käynnistysrivien kanssa). Se on oletuksena päällä ja muistetaan per selain; kytke se pois päältä nähdäksesi raa'an syötteen.

Paneelista lähetetyt komennot voidaan ilmoittaa pelissä palvelinkohtaisen tunnisteen alla, jotta pelaajat tietävät operaattorin toimineen eikä mysteerikonsolin.

## Chat-komennot

Chat-komennot antavat pelaajien käynnistää paneelin toimintoja kirjoittamalla etuliitteen komennon pelin chatissa, esimerkiksi `!spawn` satunnaista teleporterointia varten. Tunnistus perustuu lokiin ja suoritus tapahtuu palvelimen kautta, joten **modeja ei vaadita**.

![Chat-komennot](/docs/images/chat-commands.png)

Jokaisella komennolla on:

- **Käynnistin** (esim. `spawn`) ja **etuliite** (`!` oletuksena).
- **Toiminto**: satunnainen teleporterointi, teleporterointi rakenteeseen, teleporterointi biomiin tai raa'an konsolikomennon suorittaminen.
- **Lupataso**: kaikki, valkoisella listalla olevat pelaajat tai vain operaattorit.
- **Jäähdytysaika** ja muokattavat odotus-/onnistumis-/epäonnistumisviestit paikkamerkeillä kuten `{distance}`.

### Huomautus turvallisuudesta

Palvelinta tuhoavat komennot (`stop`, `op`, `ban`, `whitelist` ja vastaavat) sallitaan vain **vain operaattoreille** tarkoitetuilla käynnistimillä. Paneeli tarkistaa nämä, vaikka ne olisivat sisäkkäin `execute … run …` -ketjussa, joten matalan luvan käynnistin ei voi salakuljettaa vaarallista komentoa läpi. Tavallinen chat-teksti, joka vain mainitsee kyseiset sanat (kuten `say`-viesti), jätetään huomiotta.
