---
title: 'Kuinka paljon RAM-muistia Minecraft-palvelin tarvitsee?'
description: 'Kuinka paljon RAM-muistia Minecraft-palvelin tarvitsee vanilla-, Paper-, kevyeen modaukseen ja suuriin modipaketteihin, ja kuinka paljon jätetään koneelle.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Takaisin dokumenttien luetteloon](/docs/)

Lyhyt vastaus, palvelimelle, jolla todella pelataan:

| Käytössäsi oleva                            | Java-pino | Anna koneelle |
| ------------------------------------------- | --------- | ------------- |
| Vanilla tai Paper, enintään 10 pelaajaa     | 2 Gt      | 4 Gt          |
| Paperi lisäosilla, 10–30 pelaajaa           | 4 Gt      | 6 Gt          |
| Kevyt modipakkaus, 40–80 modia              | 4 Gt      | 6 Gt          |
| Suuri "kitchen-sink"-pakkaus, 150–300 modia | 6–8 Gt    | 10 Gt         |
| GregTech New Horizons ja vastaavat hirviöt  | 8–12 Gt   | 16 Gt         |

Kaksi lukua, ei yksi. Tämä on se osa, jonka useimmat oppaat jättävät väliin, ja syy siihen, miksi ihmiset ostavat 4 Gt palvelimen, antavat Javalle 4 Gt ja katsovat sen sitten kuolevan.

## Pino ja kone ovat eri lukuja

Java-pino (`-Xmx`) on muistin määrä, jota itse peli voi käyttää maailmaa, entiteettejä ja modien tietoja varten. Koneen tai säiliön on pidettävä sisällään tämä pino **sekä** kaikki muu, mitä Java tarvitsee: luokkametaData, säikeiden pinot, roskienkeräyksen kirjanpito, verkkopuskurit ja itse JVM. Tämä ylikuorma on noin 0,5–1,5 Gt modatulle palvelimelle.

Jos pino on yhtä suuri kuin koneen muisti, ydin tappaa palvelimen heti, kun Java yrittää käyttää tätä ylikuormaa. Dockerissa tämä näkyy poistumiskoodina 137, ja lokeissa ei mitään: prosessi yksinkertaisesti katoaa kesken lauseen. Ihmiset syyttävät yleensä modia.

Turvallinen sääntö: **pino plus 25 prosenttia, ja vähintään yksi vapaa gigatavu.** 8 Gt pino vaatii 10 Gt koneen.

## Enemmän RAM-muistia ei ole enemmän suorituskykyä

Minecraft on useimmiten yhden säikeen rajoittama. 40 modin pakkauksen antaminen 16 Gt:lla ei tee lohkojen generoinnista nopeampaa; se tekee jokaisesta roskienkeräyspaussista pidemmän, koska käveltävää on enemmän. Palvelin, joka nykii joka kolmaskymmenes sekunti, on usein palvelin, jossa on liikaa pinoa, ei liian vähän.

Nosta pinoa, kun näet näitä, ja älä muuten:

- `java.lang.OutOfMemoryError: Java heap space` lokissa.
- Toistuva "Can't keep up! Is the server overloaded?" roskienkeräyspausseilla ajoituksissa.
- Muistin käyttö kiipeää kattoon ja pysyy siellä tunteja.

## Miksi palvelimesi näyttää käyttävän 12 Gt, vaikka kukaan ei ole online-tilassa

Koska käskit sitä tekemään niin. Kaksi oletusasetusta yhdistyy:

1. Yleinen Docker-kuva asettaa aloituspinon yhtä suureksi kuin maksimin, joten `-Xms` ja `-Xmx` ovat molemmat sinun lukusi. Java varaa sen etukäteen sen sijaan, että se kasvaisi siihen.
2. Suosittu Aikar-lippusarja sisältää `-XX:+AlwaysPreTouch`, joka käy läpi jokaisen pinon sivun käynnistyksen yhteydessä, jotta sivut varataan todella. Se on tarkoituksellista: se vaihtaa hitaamman käynnistyksen ja suuren joutokäyntiluvun harvemmiksi pausseiksi myöhemmin.

Mitattu Paper 1.21.1:llä 2 Gt pinolla 4 Gt säiliössä, otettu näytteitä kolmen minuutin ajan maailman latautumisen jälkeen:

| Konfiguraatio                             | Asuva muisti |
| ----------------------------------------- | ------------ |
| Ei lippuja                                | 2.60 GiB     |
| Aikar-liput                               | 2.59 GiB     |
| Aikar-liput ilman `AlwaysPreTouch`-lippua | 1.95 GiB     |
| Aikar-liput 512 Mt aloituspinolla         | 1.38 GiB     |
| Ei lippuja 512 Mt aloituspinolla          | 1.25 GiB     |

Joten palvelin, joka "käyttää" 12 Gt joutokäynnillä, on yleensä 12 Gt pino, jota on esikäsitelty, ei vuotoa. Valvontasi lukee sen oikein; luku ei vain tarkoita sitä, miltä se näyttää.

Jos haluat rehellisen joutokäyntiluvun, aseta aloituspino pienemmäksi kuin maksimi. Maksat siitä muutamalla lisäkeräyksellä alussa. Jos haluat mieluummin tasaiset ruutuajat, jätä se rauhaan ja lopeta kaavion katsominen.

## Pelaajat merkitsevät vähemmän kuin luulet

Kymmenen pelaajan kaksinkertaistaminen 20 pelaajaksi maksaa paljon vähemmän kuin viidenkymmenen modin lisääminen. Pelaajat lisäävät pääasiassa entiteettejä ja ladattuja lohkoja, jotka skaalautuvat tasaisesti. Modit lisäävät luokkamuotoa, rekistereitä, maailman generointiominaisuuksia ja omia välimuistejaan, jotka eivät skaalaudu. Koko ensin pakkaukselle, lisää sitten noin 100–200 Mt per tavallinen pelaaja modatulla palvelimella.

Katseluetäisyys on toinen suuri vipu. Pudotus 12:sta 8 lohkoon voi säästää gigatavun vilkkaalla palvelimella ja on tuskin havaittavissa pelissä.

## Minecraft Server Managerissa

Jokaisella palvelimella on kaksi erillistä kenttää, **Java-pino** ja **säiliön muistiraja**, juuri siksi, että ne ovat eri kysymyksiä. Luontivelho asettaa säiliön rajan 50 prosenttia pinon yläpuolelle puolestasi, ja paneeli kieltäytyy tallentamasta palvelinta, jonka säiliön raja ei ole pinon yläpuolella, koska tämä yhdistelmä päättyy poistumiskoodiin 137 virheilmoituksen sijaan.

Palvelimen muistimittari näyttää, mitä säiliö todella käyttää, ja huomautuksen, kun pino varattiin etukäteen, joten esikäsiteltyä pinoa ei lueta karkailevana. Palvelin, jonka ydin tappoi muistin vuoksi, kirjataan täsmälleen siten historiassa, eikä mysteerikaatumisena.

Liittyvät: [palvelinten luominen ja hallinta](/docs/servers/),
[kaatumisraportit](/docs/servers/#crash-reports--mclogs-analysis), [tallennustila ja kiintiöt](/docs/storage/).
