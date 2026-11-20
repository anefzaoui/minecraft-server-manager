---
title: 'Chatbot pro Minecraft pro každý server'
description: 'Panel nabízí nakonfigurovaného chatbota pro každý spravovaný server Minecraft, nastaveného na kartě Nastavení → Chatbot serveru.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/chatbot.md'
---

[← Zpět na index dokumentace](/docs/)

Panel nabízí administrátorem nakonfigurovaného chatbota pro každý spravovaný server Minecraft, nastaveného na kartě serveru **Nastavení → Chatbot**. Připojuje se k koncovým bodům kompatibilním s OpenAI pro chatové doplňování, včetně Ollama na jiném hostiteli v lokální síti. Každý server má svůj vlastní koncový bod, model, název vyvolání, personu, zásady pro přepisy konverzací, zprávy pro oslovení a zásady pro napájení. Výchozí vyvolání je `@wizard` a výchozí persona představuje starověkého, hravého kouzelníka ve hře; obojí je upravitelné.

![Nastavení chatbota](/docs/images/integrations-chatbot.png)

## Zážitek hráče

- Každý hráč může použít `@wizard <zpráva>` (nebo nakonfigurované vyvolání) pro konverzaci a deterministickou pomoc s recepty vanilla, která zohledňuje verzi Minecraftu.
- Uvítací zprávy při připojení a konfigurovatelné jednorázové přihlášení během herní relace připomínají hráčům, že chatbot je k dispozici. `@wizard chat` otevře krátké okno pro konverzaci s možností přihlášení; `@wizard bye` ho zavře.
- **Běžní uživatelé** mohou vyvolávat povolené vlastní/světové schopnosti. **Správci schopností** mohou vyvolávat samostatně ověřené akce ovlivňující jiného online hráče. Hráči v žádné z těchto skupin zůstávají pouze v režimu konverzace.
- Dárky běžných uživatelů pro sebe používají povolený seznam předmětů. Správci mohou jinému hráči dát jakýkoli platný vanilla nebo modifikovaný předmět s názvem v oboru názvů, podléhající limitu množství a dalším bezpečnostním opatřením pro schopnosti.

![Přepisy konverzací chatbota](/docs/images/chatbot-transcripts.png)

## Návrh a zabezpečení

Konfigurace a přepisy konverzací jsou pouze pro administrátory. Model nikdy neobdrží surové RCON nebo libovolné spouštění příkazů. Zpráva odhaluje pouze jediný pevný nástroj odpovídající jejímu explicitnímu záměru; kód serveru ověřuje oprávnění, argumenty, příznaky, množství, omezení opakování a přesná jména online hráčů před spuštěním existující operace služby. Minecraftové selektory jsou odmítnuty, akce mezi hráči nemohou cílit na volajícího, schopnosti začínají v režimu „suchého běhu“ a každá pokusná schopnost je auditována. Nepodporované modely volající nástroje se vrátí pouze k režimu konverzace.

Odpovědi jsou omezeny pro chat Minecraftu. Známé recepty vanilla pocházejí z dodaných dat receptů podle verzí a zobrazují se jako stabilní řady 2x2/3x3; LLM není důvěryhodný pro vymýšlení rozložení receptů. Neznámé nebo modifikované recepty přesměrují hráče na JEI/REI místo vymýšlení odpovědi.

## Hlavní implementační soubory

- `src/services/wizard.js`: konfigurace pro každý server, požadavky kompatibilní s OpenAI, zpracování chatu, oslovování, uchovávání přepisů konverzací a limity odpovědí.
- `src/services/wizardPowers.js`: kontroly rolí, schémata nástrojů specifická pro záměr, ověřování, spouštění, omezení opakování a auditování schopností.
- `src/services/wizardRecipes.js`: deterministické vyhledávání receptů podle verzí a formátování mřížky. Data receptů a předmětů pocházejí z dodaného balíčku [`minecraft-data`](https://github.com/PrismarineJS/minecraft-data). (Dřívější návrh tohoto dokumentu odkazoval na složku `src/data/recipes/`, která nebyla nikdy potvrzena; taková složka neexistuje a data žijí v balíčku. Viz "Velikost závislostí".)
- `src/analytics/ingest.js`: předává analyzované připojení, odpojení a chaty hráčů chatbotovi.
- `src/web/routes/wizard.js`, `public/js/pages/integrations.js` a `views/partials/server/integrations.hbs` (přes `chatbot.hbs`): administrátorské API a karta Nastavení → Chatbot pro každý server.
- `src/db/migrations/011_wizard_chat.js`, `013_wizard_invocation_name.js`, `015_wizard_powers.js`, `017_wizard_outreach.js` a `019_wizard_power_controllers.js`: trvalé schéma.
- `test/wizard.test.js`: testy oprávnění, hranic nástrojů, uchovávání, oslovování a chování chatu.

Interní názvy tras/modulů/tabulek `wizard` jsou zachovány pro kompatibilitu upgradů a API; "chatbot" je uživatelsky orientovaný termín produktu. Podobně uložené pole `power_testers_json` odpovídá skupině **Běžní uživatelé** v uživatelském rozhraní.

## Velikost závislostí (`minecraft-data`)

Pomoc s recepty využívá balíček `minecraft-data`. Je velký na disku (přibližně 429 MB po instalaci) a je součástí produkčního obrazu, protože je to runtime závislost, nikoli vývojová. Ponecháváme ho záměrně, aby pomoc s recepty fungovala offline pro každou verzi Minecraftu bez síťového volání.

Poznámky pro toho, kdo se na to podívá příště (člověk nebo AI), aby velikost nebyla překvapením:

- V současné době se používají pouze data pro Javu (`pc`). `wizardRecipes.js` čte `minecraftData.versions.pc` a tabulky `recipes`, `items` a `blocks` pro jednotlivé verze. Soubory, kterých se skutečně dotýká, dohromady činí přibližně 15 MB napříč všemi verzemi pc.
- Přibližně 330 MB balíčku tvoří `data/bedrock` a nic zde jej zatím nečte. Ponecháváme jej na místě záměrně. Pokud by panel někdy přidal podporu pro Bedrock Minecraft, data receptů a předmětů pro Bedrock jsou již zde, takže funkce receptů může růst a pokrývat servery Bedrock bez přidání nové závislosti. Začněte od `minecraftData.versions.bedrock` a postupujte stejným způsobem jako cesta pro pc.
- Pokud by se velikost musela někdy snížit před zavedením podpory pro Bedrock, v tomto repozitáři již existuje vzor. `src/services/itemRegistry.js` načítá soubory `minecraft-data` z CDN jsDelivr, když je potřebuje, a ukládá je do mezipaměti v `api_cache`. Buď tento přístup, nebo malá ručně vybraná podmnožina `src/data/recipes/` pokrývající několik běžných verzí, by výrazně zmenšila obraz.

## Lokální úložiště a manuální kontrola

Všechna nastavení a uchované přepisy konverzací žijí v databázi panelu SQLite na `/data/panel.db` uvnitř kontejneru panelu. Se standardním připojením Compose je cesta hostitele `${DATA_DIR_HOST}/panel.db` (například `/opt/msm/data/panel.db`). Relevantní tabulky jsou `wizard_configs`, `wizard_transcripts` a `wizard_outreach`; audity schopností jsou řádky v tabulce `events` s typem `wizard-power`. Volitelný klíč API LLM je šifrován AES-256-GCM pomocí klíče panelu v klidu, `.secret-key` ve složce dat (odděleně od `SESSION_SECRET`).

Zálohujte databázi a zastavte panel před přímými úpravami SQLite, aby byl jeho WAL bezpečně zpracován. Použití administrátorského UI/API je preferováno, protože aplikuje ověřování a šifrování. Při kopírování živé databáze udržujte soubory `panel.db`, `panel.db-wal` a `panel.db-shm` pohromadě.
