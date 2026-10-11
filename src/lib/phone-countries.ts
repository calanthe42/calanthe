/**
 * Every country a phone number can be from: ISO 3166-1 alpha-2 code and its
 * international dialling code (ITU-T E.164). Names are not stored here; the
 * picker asks the browser for them in the reader's language
 * (Intl.DisplayNames), so Arabic readers see Arabic names for free.
 *
 * Countries that share a code (+1 for the US, Canada and the Caribbean; +7
 * for Russia and Kazakhstan; +44 for the UK and its Crown dependencies) are
 * listed separately, because a customer looks for their country, not their
 * code.
 */
export type PhoneCountry = { iso: string; dial: string };

/** Shown first, in this order: the UAE, then the Gulf. */
export const PRIORITY_ISO = ["AE", "SA", "KW", "QA", "BH", "OM"] as const;

export const DEFAULT_COUNTRY = "AE";

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: "AF", dial: "93" }, { iso: "AL", dial: "355" }, { iso: "DZ", dial: "213" }, { iso: "AS", dial: "1" },
  { iso: "AD", dial: "376" }, { iso: "AO", dial: "244" }, { iso: "AI", dial: "1" }, { iso: "AG", dial: "1" },
  { iso: "AR", dial: "54" }, { iso: "AM", dial: "374" }, { iso: "AW", dial: "297" }, { iso: "AU", dial: "61" },
  { iso: "AT", dial: "43" }, { iso: "AZ", dial: "994" }, { iso: "BS", dial: "1" }, { iso: "BH", dial: "973" },
  { iso: "BD", dial: "880" }, { iso: "BB", dial: "1" }, { iso: "BY", dial: "375" }, { iso: "BE", dial: "32" },
  { iso: "BZ", dial: "501" }, { iso: "BJ", dial: "229" }, { iso: "BM", dial: "1" }, { iso: "BT", dial: "975" },
  { iso: "BO", dial: "591" }, { iso: "BA", dial: "387" }, { iso: "BW", dial: "267" }, { iso: "BR", dial: "55" },
  { iso: "IO", dial: "246" }, { iso: "VG", dial: "1" }, { iso: "BN", dial: "673" }, { iso: "BG", dial: "359" },
  { iso: "BF", dial: "226" }, { iso: "BI", dial: "257" }, { iso: "KH", dial: "855" }, { iso: "CM", dial: "237" },
  { iso: "CA", dial: "1" }, { iso: "CV", dial: "238" }, { iso: "KY", dial: "1" }, { iso: "CF", dial: "236" },
  { iso: "TD", dial: "235" }, { iso: "CL", dial: "56" }, { iso: "CN", dial: "86" }, { iso: "CO", dial: "57" },
  { iso: "KM", dial: "269" }, { iso: "CG", dial: "242" }, { iso: "CD", dial: "243" }, { iso: "CK", dial: "682" },
  { iso: "CR", dial: "506" }, { iso: "CI", dial: "225" }, { iso: "HR", dial: "385" }, { iso: "CU", dial: "53" },
  { iso: "CW", dial: "599" }, { iso: "CY", dial: "357" }, { iso: "CZ", dial: "420" }, { iso: "DK", dial: "45" },
  { iso: "DJ", dial: "253" }, { iso: "DM", dial: "1" }, { iso: "DO", dial: "1" }, { iso: "EC", dial: "593" },
  { iso: "EG", dial: "20" }, { iso: "SV", dial: "503" }, { iso: "GQ", dial: "240" }, { iso: "ER", dial: "291" },
  { iso: "EE", dial: "372" }, { iso: "SZ", dial: "268" }, { iso: "ET", dial: "251" }, { iso: "FK", dial: "500" },
  { iso: "FO", dial: "298" }, { iso: "FJ", dial: "679" }, { iso: "FI", dial: "358" }, { iso: "FR", dial: "33" },
  { iso: "GF", dial: "594" }, { iso: "PF", dial: "689" }, { iso: "GA", dial: "241" }, { iso: "GM", dial: "220" },
  { iso: "GE", dial: "995" }, { iso: "DE", dial: "49" }, { iso: "GH", dial: "233" }, { iso: "GI", dial: "350" },
  { iso: "GR", dial: "30" }, { iso: "GL", dial: "299" }, { iso: "GD", dial: "1" }, { iso: "GP", dial: "590" },
  { iso: "GU", dial: "1" }, { iso: "GT", dial: "502" }, { iso: "GG", dial: "44" }, { iso: "GN", dial: "224" },
  { iso: "GW", dial: "245" }, { iso: "GY", dial: "592" }, { iso: "HT", dial: "509" }, { iso: "HN", dial: "504" },
  { iso: "HK", dial: "852" }, { iso: "HU", dial: "36" }, { iso: "IS", dial: "354" }, { iso: "IN", dial: "91" },
  { iso: "ID", dial: "62" }, { iso: "IR", dial: "98" }, { iso: "IQ", dial: "964" }, { iso: "IE", dial: "353" },
  { iso: "IM", dial: "44" }, { iso: "IL", dial: "972" }, { iso: "IT", dial: "39" }, { iso: "JM", dial: "1" },
  { iso: "JP", dial: "81" }, { iso: "JE", dial: "44" }, { iso: "JO", dial: "962" }, { iso: "KZ", dial: "7" },
  { iso: "KE", dial: "254" }, { iso: "KI", dial: "686" }, { iso: "XK", dial: "383" }, { iso: "KW", dial: "965" },
  { iso: "KG", dial: "996" }, { iso: "LA", dial: "856" }, { iso: "LV", dial: "371" }, { iso: "LB", dial: "961" },
  { iso: "LS", dial: "266" }, { iso: "LR", dial: "231" }, { iso: "LY", dial: "218" }, { iso: "LI", dial: "423" },
  { iso: "LT", dial: "370" }, { iso: "LU", dial: "352" }, { iso: "MO", dial: "853" }, { iso: "MG", dial: "261" },
  { iso: "MW", dial: "265" }, { iso: "MY", dial: "60" }, { iso: "MV", dial: "960" }, { iso: "ML", dial: "223" },
  { iso: "MT", dial: "356" }, { iso: "MH", dial: "692" }, { iso: "MQ", dial: "596" }, { iso: "MR", dial: "222" },
  { iso: "MU", dial: "230" }, { iso: "YT", dial: "262" }, { iso: "MX", dial: "52" }, { iso: "FM", dial: "691" },
  { iso: "MD", dial: "373" }, { iso: "MC", dial: "377" }, { iso: "MN", dial: "976" }, { iso: "ME", dial: "382" },
  { iso: "MS", dial: "1" }, { iso: "MA", dial: "212" }, { iso: "MZ", dial: "258" }, { iso: "MM", dial: "95" },
  { iso: "NA", dial: "264" }, { iso: "NR", dial: "674" }, { iso: "NP", dial: "977" }, { iso: "NL", dial: "31" },
  { iso: "NC", dial: "687" }, { iso: "NZ", dial: "64" }, { iso: "NI", dial: "505" }, { iso: "NE", dial: "227" },
  { iso: "NG", dial: "234" }, { iso: "NU", dial: "683" }, { iso: "KP", dial: "850" }, { iso: "MK", dial: "389" },
  { iso: "MP", dial: "1" }, { iso: "NO", dial: "47" }, { iso: "OM", dial: "968" }, { iso: "PK", dial: "92" },
  { iso: "PW", dial: "680" }, { iso: "PS", dial: "970" }, { iso: "PA", dial: "507" }, { iso: "PG", dial: "675" },
  { iso: "PY", dial: "595" }, { iso: "PE", dial: "51" }, { iso: "PH", dial: "63" }, { iso: "PL", dial: "48" },
  { iso: "PT", dial: "351" }, { iso: "PR", dial: "1" }, { iso: "QA", dial: "974" }, { iso: "RE", dial: "262" },
  { iso: "RO", dial: "40" }, { iso: "RU", dial: "7" }, { iso: "RW", dial: "250" }, { iso: "BL", dial: "590" },
  { iso: "SH", dial: "290" }, { iso: "KN", dial: "1" }, { iso: "LC", dial: "1" }, { iso: "MF", dial: "590" },
  { iso: "PM", dial: "508" }, { iso: "VC", dial: "1" }, { iso: "WS", dial: "685" }, { iso: "SM", dial: "378" },
  { iso: "ST", dial: "239" }, { iso: "SA", dial: "966" }, { iso: "SN", dial: "221" }, { iso: "RS", dial: "381" },
  { iso: "SC", dial: "248" }, { iso: "SL", dial: "232" }, { iso: "SG", dial: "65" }, { iso: "SX", dial: "1" },
  { iso: "SK", dial: "421" }, { iso: "SI", dial: "386" }, { iso: "SB", dial: "677" }, { iso: "SO", dial: "252" },
  { iso: "ZA", dial: "27" }, { iso: "KR", dial: "82" }, { iso: "SS", dial: "211" }, { iso: "ES", dial: "34" },
  { iso: "LK", dial: "94" }, { iso: "SD", dial: "249" }, { iso: "SR", dial: "597" }, { iso: "SE", dial: "46" },
  { iso: "CH", dial: "41" }, { iso: "SY", dial: "963" }, { iso: "TW", dial: "886" }, { iso: "TJ", dial: "992" },
  { iso: "TZ", dial: "255" }, { iso: "TH", dial: "66" }, { iso: "TL", dial: "670" }, { iso: "TG", dial: "228" },
  { iso: "TK", dial: "690" }, { iso: "TO", dial: "676" }, { iso: "TT", dial: "1" }, { iso: "TN", dial: "216" },
  { iso: "TR", dial: "90" }, { iso: "TM", dial: "993" }, { iso: "TC", dial: "1" }, { iso: "TV", dial: "688" },
  { iso: "VI", dial: "1" }, { iso: "UG", dial: "256" }, { iso: "UA", dial: "380" }, { iso: "AE", dial: "971" },
  { iso: "GB", dial: "44" }, { iso: "US", dial: "1" }, { iso: "UY", dial: "598" }, { iso: "UZ", dial: "998" },
  { iso: "VU", dial: "678" }, { iso: "VA", dial: "39" }, { iso: "VE", dial: "58" }, { iso: "VN", dial: "84" },
  { iso: "WF", dial: "681" }, { iso: "YE", dial: "967" }, { iso: "ZM", dial: "260" }, { iso: "ZW", dial: "263" },
];

const BY_ISO = new Map(PHONE_COUNTRIES.map((c) => [c.iso, c]));

export const countryByIso = (iso: string): PhoneCountry => BY_ISO.get(iso) ?? BY_ISO.get(DEFAULT_COUNTRY)!;

/** 🇦🇪 from "AE" — regional indicator letters. */
export const flagOf = (iso: string): string =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** "+971501234567" from the chosen country and what was typed (spaces, dashes and a leading 0 dropped). */
export function toE164(iso: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+${countryByIso(iso).dial}${digits}` : "";
}

/**
 * The other way, to prefill the field from a saved "+971501234567": the
 * country whose code is the longest match, and the rest as the national
 * number. A preferred country breaks ties between countries that share a
 * code (+1, +7, +44), so the UAE default never jumps to "American Samoa".
 */
export function fromE164(value: string, preferred: string = DEFAULT_COUNTRY): { iso: string; national: string } {
  const compact = value.replace(/[\s\-().]/g, "");
  if (!compact.startsWith("+")) {
    return { iso: preferred, national: compact.replace(/^00/, "").replace(/^0+/, "") };
  }
  const digits = compact.slice(1);
  let best: PhoneCountry | null = null;
  for (const c of PHONE_COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length || (c.dial.length === best.dial.length && c.iso === preferred)) best = c;
  }
  if (!best) return { iso: preferred, national: digits };
  /* Several countries share this code: keep the preferred one if it is among them, else a sensible one. */
  const sharing = PHONE_COUNTRIES.filter((c) => c.dial === best!.dial);
  const iso = sharing.some((c) => c.iso === preferred)
    ? preferred
    : ({ "1": "US", "7": "RU", "44": "GB", "39": "IT", "262": "RE", "590": "GP" } as Record<string, string>)[best.dial] ?? best.iso;
  return { iso, national: digits.slice(best.dial.length) };
}
