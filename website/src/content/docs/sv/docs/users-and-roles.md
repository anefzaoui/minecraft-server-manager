---
title: 'Användare och roller'
description: 'Panelen är fleranvändarvänlig.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Tillbaka till dokumentindex](/docs/)

Panelen är för flera användare. Hantera konton under **Inställningar → Användare**.

![Användare](/docs/images/settings-users.png)

## De tre rollerna

| Roll         | Kan göra                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Allt: hantera användare, API-nycklar, globala filer, avancerade Docker-inställningar och alla serveråtgärder.                                    |
| **operator** | Köra och konfigurera servrar (starta/stoppa, konsol, säkerhetskopior, världar, mods, de flesta inställningar), men inte admin-specifika områden. |
| **viewer**   | Endast läsbehörighet. Se servrar och deras status, men utan att göra några ändringar.                                                            |

Varje användare, inklusive en viewer, kan hantera sin egen [tvåfaktorsautentisering](/docs/two-factor-authentication/), eftersom skyddet av din egen inloggning inte är en serverhanteringsåtgärd.

## Endast för administratörer, och varför

Ett fåtal saker är avsiktligt begränsade till administratörer:

- **Användarhantering, API-nycklar och globala filer.**
- **[Offentliga API:et](/docs/public-api/)** - aktivering av `/api/v1` och skapande, begränsning eller återkallande av dess läs-bara Bearer-tokens.
- **Avancerade Docker-inställningar** - anpassat containernamn, extra portvidarebefordringar och bind mounts. En bind mount kan mappa vilken värdväg som helst in i en container, och i kombination med panelens Docker-åtkomst är det effektivt root på värden. Dessa fält visas endast för administratörer.

Anpassade containernamn kan inte heller finnas i panelens egen `msm-` namnområde, så en handnamngiven container kan aldrig skugga en annan servers och dirigera felaktigt ett stopp eller kommando till fel instans.

## Hantera konton

![Profilbild](/docs/images/profile-picture.png)

Administratörer kan skapa användare, ändra roller, återställa lösenord och ta bort konton från användartabellen. Kolumnen **2FA** visar om varje användare har tvåfaktorsautentisering aktiverat; en administratör kan **återställa** en annan användares 2FA (för fallet med borttappad telefon och backup-koder), men aldrig inaktivera sin egen utan sitt lösenord, vilket självbetjäningsflödet hanterar istället.

Misslyckade inloggningar är begränsade per konto (både en räknare per IP och en global räknare för kontot) för att sakta ner brute-force-försök, och samma gräns täcker även 2FA-kodsteget så att ett korrekt lösenord inte kan återställa räknaren innan kodgissning. Framför detta finns en grövre begränsning per klient-IP för inloggnings-, 2FA- och installationsslutpunkterna, justerbar via `RATE_LIMIT_AUTH_PER_15MIN` (standard 100; bakom en omvänd proxy, ställ in `TRUST_PROXY` så att den baseras på den verkliga klientens IP).
