---
title: 'Chatbot pro Minecraft pro každý server'
description: 'Tato verze přidává nakonfigurovaného chatbota pro každý spravovaný server Minecraft.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Zpět na rejstřík dokumentace](/docs/)

Tato verze přidává nakonfigurovaného chatbota pro správu ke každému spravovanému serveru Minecraft. Připojuje se k
koncovému bodu kompatibilnímu s OpenAI pro chatové doplňování, včetně Ollama na jiném hostiteli v LAN. Každý server má
svůj vlastní koncový bod, model, název vyvolání, personu, zásady pro přepisy, zprávy o dosahu a zásady pro napájení. Výchozí vyvolání je `@wizard` a výchozí persona demonstruje starodávného,
hravého kouzelníka ve hře; obojí lze upravit.

![Nastavení chatbota](/docs/images/integrations-chatbot.png)

## Zážitek hráče

- Kdokoli může použít `@wizard <zpráva>` (nebo nakonfigurované vyvolání) pro konverzaci a
  deterministickou pomoc s recepty vanilla, která zohledňuje verzi Minecraftu.
- Pozdravy při připojení a konfigurovatelné jednorázové přihlášení během herní relace připomínají hráčům, že chatbot je
  k dispozici. `@wizard chat` otevře krátké konverzační okno s možností přihlášení; `@wizard bye` ho zavře.
- **Běžní uživatelé** mohou vyvolat povolené vlastní/světové schopnosti. **Správci schopností** mohou vyvolat samostatně
  ověřené akce ovlivňující jiného online hráče. Hráči v žádné z těchto skupin zůstávají
  pouze pro konverzaci.
- Vlastní dárky pro běžné uživatele používají povolený seznam předmětů. Správci mohou jinému hráči dát jakýkoli platný
  vanilla nebo modifikovaný předmět s jmenným prostorem, podléhající limitu množství a dalším bezpečnostním opatřením.

![Přepisy chatu](/docs/images/chatbot-transcripts.png)

## Návrh a zabezpečení

Konfigurace a přepisy jsou pouze pro správce. Model nikdy nepřijímá nezpracované RCON nebo libovolné
spouštění příkazů. Zpráva odhaluje pouze jeden pevný nástroj odpovídající jejímu explicitnímu záměru;
kód serveru ověřuje oprávnění, argumenty, příznaky, množství, omezení opakování a přesná jména online hráčů před provedením existující operace služby. Minecraft selektory jsou odmítnuty, akce mezi hráči nemohou cílit na volajícího, schopnosti začínají v režimu "suchého běhu" a každá pokusná schopnost je auditována. Nepodporované modely volající nástroje se vrátí pouze na konverzaci.

Odpovědi jsou omezeny pro chat Minecraft. Známé vanilla recepty pocházejí ze zabalených verzovaných dat receptů a vykreslují se jako stabilní řady 2x2/3x3; LLM není důvěryhodný pro vymýšlení rozložení receptů. Neznámé nebo modifikované recepty přesměrují hráče na JEI/REI namísto vymýšlení odpovědi.

## Hlavní implementační soubory

- `src/services/wizard.js`: konfigurace pro každý server, požadavky kompatibilní s OpenAI, zpracování chatu,
  dosah, uchovávání přepisů a limity odpovědí.
- `src/services/wizardPowers.js`: kontroly rolí, schémata nástrojů specifická pro záměr, ověřování, provádění,
  omezení opakování a auditování schopností.
- `src/services/wizardRecipes.js`: deterministické vyhledávání receptů podle verzí a formátování mřížky. Data receptů
  a předmětů pocházejí z přiloženého balíčku [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Dřívější návrh tohoto dokumentu odkazoval na složku `src/data/recipes/`, která nebyla nikdy potvrzena; taková složka neexistuje a data žijí v balíčku. Viz "Stopa závislostí".)
- `src/analytics/ingest.js`: předává analyzované připojení, odpojení a chat hráčů chatbotovi.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` a
  `views/partials/server/integrations.hbs`: API pro správce a UI integrací pro každý server.
- `src/db/migrations/011_wizard_chat.js` až `019_wizard_power_controllers.js`: trvalé schéma.
- `test/wizard.test.js`: testy oprávnění, hranic nástrojů, uchovávání, dosahu a chování chatu.

Interní názvy tras/modulů/tabulek `wizard` jsou zachovány pro kompatibilitu upgradu a API;
„chatbot“ je uživatelský produktový termín. Podobně uložené pole `power_testers_json` odpovídá skupině
**Běžní uživatelé** v UI.

## Stopa závislostí (`minecraft-data`)

Pomoc s recepty využívá balíček `minecraft-data`. Je velký na disku (přibližně 429 MB po instalaci) a
je součástí produkčního obrazu, protože je to běhová závislost, nikoli vývojová. Ponecháváme ho
záměrně, aby pomoc s recepty fungovala offline pro každou verzi Minecraftu bez síťového volání.

Poznámky pro toho, kdo se na to podívá příště (člověk nebo AI), aby velikost nebyla překvapením:

- V současné době se používají pouze data pro Javu (`pc`). `wizardRecipes.js` čte `minecraftData.versions.pc`
  a tabulky `recipes`, `items` a `blocks` pro jednotlivé verze. Soubory, kterých se skutečně dotýká, dohromady činí přibližně 15 MB napříč všemi verzemi pc.
- Přibližně 330 MB balíčku tvoří `data/bedrock` a nic zde zatím nečte. Ponecháváme to
  tam záměrně. Pokud panel někdy přidá podporu pro Bedrock Minecraft, data receptů a předmětů pro Bedrock jsou již zde, takže funkce receptů může růst a pokrýt servery Bedrock bez přidání nové závislosti. Začněte s `minecraftData.versions.bedrock` a postupujte stejným způsobem jako cesta pro pc.
- Pokud by se velikost měla někdy snížit před příchodem podpory Bedrock, v tomto repozitáři již existuje vzor. `src/services/itemRegistry.js` načítá soubory `minecraft-data` z CDN jsDelivr, když je potřebuje, a ukládá je do mezipaměti v `api_cache`. Buď tento přístup, nebo malý ručně vybraný podsoubor `src/data/recipes/` pokrývající několik běžných verzí, by výrazně zmenšil obraz.

## Lokální úložiště a ruční kontrola

Všechna nastavení a uchované přepisy žijí v databázi panelu SQLite na `/data/panel.db` uvnitř kontejneru panelu. Se standardním připojením Compose je cesta hostitele
`${DATA_DIR_HOST}/panel.db` (například `/opt/msm/data/panel.db`). Relevantní tabulky jsou
`wizard_configs`, `wizard_transcripts` a `wizard_outreach`; audity schopností jsou řádky v tabulce `events`
s typem `wizard-power`. Volitelný klíč API LLM je šifrován AES-256-GCM pomocí `SESSION_SECRET` panelu,
obvykle perzistentní jako `${DATA_DIR_HOST}/.session-secret`.

Zálohujte databázi a zastavte panel před přímými úpravami SQLite, aby byl jeho WAL bezpečně zpracován.
Použití UI/API pro správce je preferováno, protože aplikuje ověřování a šifrování. Při kopírování živé databáze uchovávejte soubory
`panel.db`, `panel.db-wal` a `panel.db-shm` pohromadě.
