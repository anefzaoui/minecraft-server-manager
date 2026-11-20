---
title: 'Publiczne API'
description: 'Niewielkie, tylko do odczytu API HTTP do pobierania statusu serwera z zewnątrz panelu: panel statusu, monitor czasu pracy, bot Discord, reguła automatyki domowej.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/public-api.md'
---

[← Powrót do spisu dokumentacji](/docs/)

Małe, tylko do odczytu, API HTTP do pobierania statusu serwera spoza panelu:
panel statusu, monitorowanie dostępności, bot Discord, reguła automatyki domowej. Jest
obsługiwane przez sam panel i zwraca te same dane na żywo, które pokazują strony panelu
(z pamięci podręcznej), więc jego odpytywanie nigdy nie dotyka Dockera.

Jest **wyłączone, dopóki administrator go nie użyje** i **wymaga uwierzytelnienia administratora**. Nic nie jest udostępniane,
dopóki nie istnieje token.

## Włączanie

**Ustawienia → Publiczne API → Nowy klucz**. Nadaj mu nazwę, wybierz, co może widzieć (wszystkie
serwery lub określony podzbiór) i opcjonalnie datę wygaśnięcia. Pełny klucz (token
Bearer) jest wyświetlany **raz**, w oknie dialogowym; skopiuj go teraz, ponieważ później zachowana zostanie tylko krótka jego część, do identyfikacji na liście.

![Ustawienia Publicznego API](/docs/images/settings-public-api.png)

Utworzenie pierwszego klucza automatycznie włącza API (przełącznik **Pozwól aplikacjom zewnętrznym
odczytywać status** służy do wstrzymywania: wyłącz go, aby przestać obsługiwać, nie anulując żadnych kluczy). Anuluj klucz z tej samej tabeli w dowolnym momencie; klienci korzystający z niego natychmiast tracą
dostęp.

Tokeny są przechowywane jako skrót SHA-256 (nigdy w postaci zwykłego tekstu), przetrwają ponowne uruchomienie panelu
i przeżyją serwery, do których są przypisane (usunięty serwer po prostu
znika z wyników tego tokenu).

## Uwierzytelnianie

Wyślij token jako poświadczenie Bearer:

```
Authorization: Bearer msm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Nie ma plików cookie ani **CORS**: jest to przeznaczone dla wywołań serwer-serwer i CLI,
a nie aplikacji przeglądarkowych z innego źródła. Jeśli panel znajduje się za serwerem proxy,
upewnij się, że serwer proxy przekazuje nagłówek `Authorization`.

Błędy zwracają `401` z `{ "ok": false, "error": "..." }`. Wszystko inne niż `GET`
(lub `HEAD`) zwraca `405`. Nieznane ścieżki zwracają `404`. Gdy API jest wyłączone, każda trasa
zwraca `404`.

## Limit żądań

Każdy token otrzymuje własny budżet, `RATE_LIMIT_PUBLIC_API_PER_MIN` (domyślnie `120`
żądań/minutę; `0` wyłącza ogranicznik). Przekroczenie limitu zwraca `429`. Każde żądanie, zanim token zostanie nawet sprawdzony, liczy się również do limitu na adres IP klienta, wynoszącego pięciokrotność tej liczby, więc sondowanie z brakującymi, nieprawidłowymi, unieważnionymi lub wygasłymi tokenami nie może ominąć budżetu poprzez ich rotację.

## Punkty końcowe

### `GET /api/v1/servers`

Każdy serwer, do którego przypisany jest token.

```json
{
  "ok": true,
  "total": 1,
  "online": 1,
  "servers": [
    {
      "id": "srv_ab12cd34",
      "name": "SMP",
      "type": "PAPER",
      "state": "running",
      "cpuPct": 18.4,
      "memoryMb": 2048,
      "memoryLimitMb": 4096,
      "uptimeSeconds": 11722,
      "players": { "online": 3, "max": 20 }
    }
  ]
}
```

### `GET /api/v1/servers/:id`

Jeden serwer, ten sam obiekt pod kluczem `server`. Zwraca `404` dla nieznanego identyfikatora
**oraz** dla serwera, do którego token nie jest przypisany (brak wyroczni istnienia), i `400`
dla nieprawidłowego identyfikatora.

## Pola odpowiedzi

| Pole            | Znaczenie                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `total`         | Ile serwerów jest widocznych dla tego tokenu (po zastosowaniu filtru zakresu).                   |
| `online`        | Ile z nich jest w stanie: `running`.                                                             |
| `id`            | Stały identyfikator serwera (`srv_...`).                                                         |
| `name`          | Nazwa wyświetlana.                                                                               |
| `type`          | Typ serwera itzg (`PAPER`, `FABRIC`, `AUTO_CURSEFORGE`, ...).                                    |
| `state`         | `running`, `starting`, `stopped` lub `crashed`: stabilne podsumowanie wewnętrznego stanu panelu. |
| `cpuPct`        | Ostatni procent użycia CPU, lub `null`, gdy serwer nie działa.                                   |
| `memoryMb`      | Pamięć rezydentna w MB, lub `null`.                                                              |
| `memoryLimitMb` | Skonfigurowany limit pamięci kontenera w MB, lub `null`.                                         |
| `uptimeSeconds` | Sekundy od uruchomienia kontenera, lub `null`.                                                   |
| `players`       | `{ online, max }`, lub `null`, dopóki serwer nie zgłosi listy graczy.                            |

## Przykład

```sh
curl -s https://panel.example.com/api/v1/servers \
  -H "Authorization: Bearer $MSM_TOKEN" | jq
```
