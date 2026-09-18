---
title: 'Aktualizacje'
description: 'Strona Aktualizacje śledzi, co jest nieaktualne we wszystkich Twoich serwerach w jednym miejscu:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Strona **Aktualizacje** śledzi, co jest nieaktualne na wszystkich Twoich serwerach w jednym miejscu:

- Wersje **Modpacków** ([modpacki](/docs/modpacks/)) w porównaniu do Modrinth / CurseForge / indeksu wydań GTNH.
- **Niestandardowa zawartość**, którą sam dodałeś – mody, datapacki, paczki zasobów, pluginy – każdy w porównaniu do swojego źródła: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) lub GitHub Releases. Wyszukiwania GitHub używają ponownej walidacji ETag, więc codzienne sprawdzenia ledwo naruszają limit żądań.
- Nieaktualność **obrazu Docker**: identyfikator obrazu każdego działającego kontenera w porównaniu do świeżo pobranego tagu (zduplikowanego na serwerach z tym samym tagiem), oferowane jako aktualizacja wymagająca jedynie ponownego utworzenia.
- **Przypięcia wersji samodzielnych**: dla serwera bez zarządzanego paczka, jawne przypięcie `mc_version` w porównaniu do manifestu Mojang, oraz jawna zmienna środowiskowa wersji loadera (`PAPER_BUILD`, `FORGE_VERSION` i tym podobne) w porównaniu do rejestru loadera. Kompilacje Paper pochodzą z obecnego **Fill v3 API** PaperMC (starszy punkt końcowy v2 przestał otrzymywać nowe wersje Minecraft).

![Aktualizacje](/docs/images/updates.png)

## Jak to działa

Panel sprawdza przypięte wersje każdego serwera w porównaniu do źródła nadrzędnego i wymienia wszystko, co ma nowsze wydanie. Pasująca liczba pojawia się również w kafelku "Dostępne aktualizacje" na [pulpicie nawigacyjnym](/docs/dashboard/).

Sprawdzenia są uruchamiane na żądanie i mogą być zaplanowane ([Harmonogramy](/docs/schedules/)). **Polityka** aktualizacji jest per-serwer: decydujesz, czy panel tylko Cię powiadamia, czy wszystko pozostaje ręczne.

## Zastosowanie aktualizacji

Aktualizacje nigdy nie są ciche. Kiedy zdecydujesz się zaktualizować paczkę, panel:

1. Wykonuje **kopia zapasowa przed aktualizacją** (dzięki czemu jest odwracalna; zachowywane są ostatnie 10 kopii zapasowych przed aktualizacją na serwer).
2. Przypina dokładną nową wersję.
3. Tworzy ponownie kontener, w razie potrzeby ponownie rozwiązując środowisko uruchomieniowe Java.
4. Monitoruje pierwsze uruchomienie, z budżetem czasowym na platformę.

Jeśli nie uruchomi się poprawnie, następuje powrót do kopii zapasowej przed aktualizacją. Serwer śledzący stabilne wersje nigdy nie otrzymuje wersji beta, a link do dziennika zmian prowadzi do rzeczywistej różnicy per-wersja, gdzie źródło ją udostępnia. Nieudana aktualizacja uruchamia również [alert](/docs/integrations/) na Discordzie, jeśli integracja jest skonfigurowana.
