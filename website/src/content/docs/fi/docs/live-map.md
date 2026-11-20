---
title: 'Live-kartta'
description: 'Ota käyttöön BlueMap-live 3D-kartta palvelimen maailmasta yhdellä napsautuksella, tarjoiltuna vain paneelin kirjautumisen kautta.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

Palvelimen **Maailma → Kartta** -välilehti näyttää palvelimen maailman reaaliaikaisen, zoomattavan 3D-kartan, jonka piirtää [BlueMap](https://bluemap.bluecolored.de/) (ilmainen ja avoimen lähdekoodin ohjelmisto). Kartta näyttää myös pelaajien sijainnit ja kaikki ulottuvuudet. Paneeli asentaa ja konfiguroi sen sekä tarjoilee sen; sinun ei tarvitse avata porttia tai muokata asetustiedostoja.

## Käyttöönotto

1. Avaa palvelin ja siirry kohtaan **Maailma → Kartta**.
2. Paina **Ota käyttöön reaaliaikainen kartta**. Paneeli asentaa BlueMap-version, joka vastaa palvelimen lataajaa ja Minecraft-versiota Modrinthista, hyväksyy BlueMapin resurssien latauksen puolestasi ja valitsee sille vapaan portin.
3. Käynnistä palvelin uudelleen (muutos astuu voimaan seuraavalla käynnistyksellä, ja palvelin merkitään odottamaan sitä).

BlueMap piirtää karttaa taustalla, joten uuden kartan ensimmäisten ruutujen piirtäminen kestää muutaman minuutin. Siihen asti välilehti ilmoittaa, että kartta ei ole vielä valmis, ja tarkistaa tilanteen uudelleen itsestään. Kun kartta on valmis, **Koko näyttö** avaa kartan omaan selainvälilehteensä.

Se toimii palvelimilla, joissa on modilataaja (Fabric, Quilt, Forge, NeoForge) ja lisäosapalvelimilla (Paper, Purpur ja muu Paper-perhe, Spigot), mukaan lukien modpack-palvelimet. Vanilla-palvelimilla ei ole BlueMap-versiota, ja välilehti ilmoittaa siitä.

## Kuka voi nähdä sen

Karttaa tarjoillaan vain paneelin kautta, sen kirjautumisen takana: kuka tahansa, joka voi tarkastella palvelinta paneelissa, voi avata sen kartan, eikä kukaan muu. BlueMapin omaa porttia ei ole tarkoitettu avattavaksi internetiin ([portit pikakatsauksena](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Kartan käyttöönotto tai poistaminen vaatii palvelimen **Asetukset**-oikeuden ([käyttäjät ja roolit](/docs/users-and-roles/#per-server-permissions)).

Kun paneeli itse toimii Dockerissa, se tavoittaa BlueMapin palvelimen säiliön sisällä; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) selittää yksityiskohdat käänteisen välityspalvelimen (reverse proxy) asennuksille.

## Poistaminen käytöstä

**Poista kartta käytöstä** poistaa paneelin asentaman BlueMap-jar-tiedoston ja vapauttaa sen portin, jälleen seuraavasta uudelleenkäynnistyksestä alkaen. Itse maailma pysyy koskemattomana; piirretyt karttalaatat säilyvät palvelimen kansiossa, kunnes poistat ne **Tiedostot**-välilehdeltä.

Liittyvät: [maailmat ja tiedostot](/docs/worlds-and-files/), [kutsut ja tilasivu](/docs/invites-and-status-page/).
