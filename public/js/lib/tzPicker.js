// Populates a timezone <select> (from Intl.supportedValuesOf) and a country
// <select> (ISO-3166 alpha-2 + Intl.DisplayNames for names), each with an
// "Auto — system …" option at the top. Shared by the setup wizard and Settings.
// The selects are marked data-native so they aren't wrapped by the custom-select
// enhancer (which reads options once at load — these are filled dynamically).

// ISO-3166-1 alpha-2 country codes.
const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' '
  );

const FALLBACK_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export function timezones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_ZONES;
  }
}

export function countries() {
  let names = null;
  try {
    names = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' });
  } catch {
    /* names unavailable — fall back to the raw code */
  }
  return COUNTRY_CODES.map((code) => ({ code, name: (names && names.of(code)) || code })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function fillTimezoneSelect(select, current, systemTz) {
  select.setAttribute('data-native', '');
  select.innerHTML = '';
  const auto = new Option(`Auto — system time zone${systemTz ? ` (${systemTz})` : ''}`, 'auto');
  select.add(auto);
  for (const tz of timezones()) select.add(new Option(tz, tz));
  select.value = current && current !== 'auto' ? current : 'auto';
}

export function fillCountrySelect(select, current, systemCc) {
  select.setAttribute('data-native', '');
  select.innerHTML = '';
  const auto = new Option(`Auto — system country${systemCc ? ` (${systemCc})` : ''}`, 'auto');
  select.add(auto);
  for (const { code, name } of countries()) select.add(new Option(`${name} (${code})`, code));
  select.value = current && current !== 'auto' ? current : 'auto';
}
