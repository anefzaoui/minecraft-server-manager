---
title: 'Användare & roller'
description: 'Konton, rollerna administratör, operatör och betraktare, samt server-specifika behörigheter i Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Tillbaka till dokumentindex](/docs/)

Panelen är för flera användare. Hantera konton under **Inställningar → Användare**.

![Användare](/docs/images/settings-users.png)

## De tre rollerna

| Roll         | Standard för varje server                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Allt: hantera användare, API-nycklar, globala filer, avancerade Docker-inställningar och alla serveråtgärder.                                    |
| **operator** | Köra och konfigurera servrar (starta/stoppa, konsol, säkerhetskopior, världar, mods, de flesta inställningar), men inte admin-exklusiva områden. |
| **viewer**   | Endast läsbar. Se servrar och deras status, men gör inga ändringar.                                                                              |

Varje användare, inklusive en viewer, kan hantera sin egen [tvåfaktorsautentisering](/docs/two-factor-authentication/), eftersom skyddet av din egen inloggning inte är en serverhanteringsåtgärd.

En roll är **standard** för varje server. För att ge någon andra rättigheter på en server, använd server-specifika behörigheter nedan.

## Server-specifika behörigheter

Sidan **Behörigheter** (i sidofältet, eller **Serverbehörigheter** under **Inställningar → Användare**) visar ett rutnät: varje operator och viewer längs ena sidan, varje server längs den andra. Klicka på en cell för att bestämma vad den användaren får göra på just den servern. Administratörer listas inte eftersom de alltid har allt.

![Behörigheter](/docs/images/settings-permissions.png)

Varje cell är en uppsättning behörigheter:

| Behörighet   | Vad den tillåter på den servern                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **View**     | Se servern, dess status, konsolutmatning, spelare, historik och statistik.                                     |
| **Power**    | Starta, stoppa, starta om, döda och bygga om servern.                                                          |
| **Console**  | Kör konsolkommandon och snabbåtgärder för världen, skicka chatt och hantera chattkommandon.                    |
| **Players**  | Sparka, banna, lägga till på vitlista, ge op-rättigheter och redigera spelarnoter.                             |
| **Content**  | Installera och ta bort mods, plugins, paket, världar, datapacks och redigera inventarier.                      |
| **Backups**  | Skapa, återställa, ladda ner och ta bort säkerhetskopior.                                                      |
| **Files**    | Bläddra, redigera, ladda upp och ladda ner serverfiler, arkiverade loggar och loggbuntar; exportera ritningar. |
| **Settings** | Ändra serverinställningar, egenskaper, integrationer, ikon och uppgradera versioner.                           |
| **Delete**   | Ta bort servern.                                                                                               |

![Behörighetsredigerare](/docs/images/permissions-editor.png)

Nedanför rutnätet öppnar **Vad varje behörighet täcker** varje behörighet till vad en person kan göra, vad som inte ingår, och de exakta panelvägarna den låser upp. Den sista listan kontrolleras mot den körande koden av testsviten.

![Behörighetsreferens](/docs/images/permissions-reference.png)

På en telefon staplas rutnätet till ett kort per användare, med en rad per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Behörigheter på en telefon" width="180">
</p>

Hur bitarna passar ihop:

- **Rollen är standard.** En operator börjar med alla behörigheter på alla servrar; en viewer börjar endast med View. En cell i svag text (dess verktygstips säger "Rollstandard") har aldrig ändrats.
- **En cell åsidosätter rollen endast för den servern.** Ge en viewer Power och Console på en server och de kan köra den, medan alla andra servrar förblir skrivskyddade för dem. Ta bort Delete från en operator på din huvudserver och de behåller allt annat där.
- **Varje behörighet inkluderar View.** Du kan inte agera på en server du inte kan se.
- **Stäng av allt för att dölja en server.** Den försvinner från användarens sidofält, instrumentpanel, säkerhetskopior, scheman, aktivitet, uppdateringar, modpacks, live-status, körande uppgifter och ritningar, och världbiblioteket slutar namnge den. En direktlänk, API-anrop eller konsoluttag svarar "hittades inte", precis som en server som inte existerar.
- **Panelövergripande åtgärder följer fortfarande rollen.** Att skapa servrar (inklusive att klona en), lagring, användare, API-nycklar, globala inställningar och panelövergripande scheman är inte server-specifika, så en viewer med behörigheter på vissa servrar kan fortfarande inte göra något av detta. Operatörer behåller serverkapacitet och panelövergripande scheman; lagring, användare, API-nycklar och globala inställningar är endast för administratörer.
- **Scheman följer servern.** En schemalagd omstart, säkerhetskopiering eller kommando på en server kräver motsvarande behörighet där (Power, Backups eller Console), oavsett roll.
- **Ritningar följer också servern.** Att exportera en server som en ritning kräver Files där, eftersom arkivet bär dess filer. En ritning exporterad från en server som någon inte kan se är också dold för dem.
- **Admin-exklusiva områden förblir admin-exklusiva** på alla servrar: chatbotten, lagringstid för säkerhetskopior och avancerade Docker-inställningar.

Varje ändring skrivs till aktivitetsloggen med vem som ändrade vad; dessa poster visas endast för administratörer. Att ta bort en användare tar bort deras rader. Att ta bort en server behåller dem, så en server som är dold för någon förblir dold i dess historik och sparade säkerhetskopior.

Befintliga installationer fortsätter att fungera oförändrade: tills en administratör redigerar en cell har varje användare exakt vad deras roll gav dem tidigare.

## Endast för administratörer, och varför

Några saker är avsiktligt begränsade till administratörer:

- **Användarhantering, lagring, globala inställningar, API-nycklar och globala filer.**
- **Den [offentliga API:n](/docs/public-api/)**: aktivering av `/api/v1` och skapande, omfånget eller återkallande av dess skrivskyddade Bearer-tokens.
- **Avancerade Docker-inställningar**: anpassat containernamn, extra portpubliceringar och bind mounts. En bind mount kan mappa vilken värdväg som helst in i en container, och i kombination med panelens Docker-åtkomst är det effektivt root på värden. Dessa fält visas endast för administratörer.

Anpassade containernamn kan inte heller leva i panelens egen `msm-` namnutrymme, så en handnamngiven container kan aldrig skugga en annan servers och dirigera felaktigt en stopp- eller kommandoförfrågan till fel instans.

## Hantera konton

![Profilbild](/docs/images/profile-picture.png)

Administratörer kan skapa användare, ändra roller, återställa lösenord och ta bort konton från användartabellen. Kolumnen **2FA** visar om varje användare har tvåfaktorsautentisering aktiverad; en administratör kan återställa en annan användares 2FA med **Återställ 2FA** i den användarens åtgärdsmeny (för fallet med borttappad telefon och backup-koder), men aldrig inaktivera sin egen utan deras lösenord, vilket självbetjäningsflödet hanterar istället.

Misslyckade inloggningar begränsas per konto (både en räknare per IP och en global räknare för kontot) för att sakta ner brute-force-försök, och samma gräns täcker 2FA-kodsteget så att ett korrekt lösenord inte kan återställa räknaren innan kodgissning. Framför detta sitter en grövre begränsning per klient-IP för inloggnings-, 2FA- och installationsslutpunkterna, justerbar via `RATE_LIMIT_AUTH_PER_15MIN` (standard 100; bakom en omvänd proxy, ställ in `TRUST_PROXY` så att den baseras på den verkliga klient-IP:n).
