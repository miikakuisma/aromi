# Helsingin kaupungin kouluruokalistat

<img width="800" height="480" alt="screenshot" src="https://github.com/user-attachments/assets/727abd4e-5bd0-4216-8978-445368d115fd" />

Helsingin kaupungin päivittäinen ruokalista [TRMNL](https://trmnl.com/) e-ink -näytölle
ja mobiiliystävälliselle verkkosivulle.

Ruokalistat haetaan Helsingin kaupungin [Aromi-järjestelmästä](https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/).
Tämä asennus on määritetty **Meilahden ala-asteelle** (portaali `KeMenu054`,
ruokailijaryhmä "Ala-Aste").

## Miten se toimii

```
                    ┌─────────────────────┐
TRMNL-näyttö  ──────┤                     │
                    │   Next.js / Vercel  ├────►  Aromi API (aromi.hel.fi)
Verkkosivu    ──────┤                     │
                    └─────────────────────┘

GET /api/menu   →  { date, meals }          päivän lista, TRMNL
GET /api/week   →  { week, days[5], … }     koko viikko, verkkosivu
```

- **`lib/`** hakee ruokalistan Aromista ja muuntaa sen yksinkertaiseksi JSONiksi.
- **`TRMNL plugin.html`** renderöi päivän listan e-ink -näytölle Jinja2-templatella.
- **`app/`** on Next.js-sovellus: viikkonäkymä ja molemmat API-reitit samassa
  osoitteessa.

## Tiedostot

| Tiedosto | Kuvaus |
|---|---|
| `app/page.tsx` | Viikkonäkymä, palvelin hakee kuluvan viikon valmiiksi |
| `app/week-view.tsx` | Selainpuoli: viikon vaihto, tallennus, offline-tila |
| `app/components/` | Näkymäkomponentit: viikkonauha, päivälista, tilat |
| `app/globals.css` | Sivun tyylit |
| `app/api/menu/` | Päivän lista TRMNL:lle |
| `app/api/week/` | Koko viikko verkkosivulle |
| `lib/` | Aromi-haku, päivämäärälogiikka ja muunnokset testeineen |
| `app/sw.ts` | Service worker, säilöö sivupohjan offline-käyttöä varten |
| `app/serwist/[path]/` | Reitti joka kääntää service workerin `app/sw.ts`-lähteestä |
| `app/manifest.ts` | Sovellusmanifesti (korvaa aiemman `manifest.json`-tiedoston) |
| `public/icons/` | Sovellusikonit — lähde `icon.svg`, siitä renderöidyt PNG:t |
| `TRMNL plugin.html` | Jinja2-template TRMNL-näytölle |

## Asennus

### 1. Kehitysympäristö

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # lib/-kansion yksikkötestit
```

### 2. Julkaisu Verceliin

```bash
npx vercel        # esikatselu
npx vercel --prod # tuotanto
```

Ympäristömuuttujia ei tarvita — Aromi-portaalin tunnisteet ovat
`lib/aromi.ts`-tiedostossa.

### 3. TRMNL Plugin

1. Luo [TRMNL Developer](https://usetrmnl.com/plugin/new)-sivulla uusi Private Plugin
2. Strategiaksi valitse **Webhook/Polling** ja syötä oman julkaisusi osoite
   (`https://kouluruoka.vercel.app/api/menu`)
3. Kopioi `TRMNL plugin.html` sisältö pluginin **Markup**-kenttään

## Sovelluksena puhelimessa

Sivu on asennettava web-sovellus. iOS: **Jaa → Lisää Koti-valikkoon**.
Android: Chromen valikko → **Asenna sovellus**. Kotivalikosta avattuna se
näkyy ilman selainpalkkeja.

Ilman verkkoyhteyttä sivu avautuu silti: service worker säilöö sivupohjan. Jos
välimuistissa oleva sivu sisältää jo kuluvan viikon listan, se piirretään
sellaisenaan eikä erillistä ilmoitusta näytetä — hakua ei silloin edes yritetä.
Jos sivu on vanhemmalta viikolta, haku yritetään, ja sen epäonnistuessa lista
piirretään localStoragesta ja viikkonauhan alle ilmestyy rivi *"Ei yhteyttä —
lista tallennettu eilen klo 7.42"*. Kun listaa ei ole tallennettuna eikä verkkoa
ole, näkyy tavallinen virheilmoitus.

Ruokalistaa **ei** säilötä service workerin välimuistiin. Osoite
`/api/week?offset=0` tarkoittaa eri viikkoa eri päivinä, joten välimuisti
tarjoilisi viime viikon listan tämän viikon kohdalla. Sen sijaan sivu
tallentaa listat viikon maanantai avaimenaan ja laskee kuluvan päivän itse
(`Europe/Helsinki`) sen sijaan että luottaisi vastauksen `today`-kenttään —
näin eilen tallennettu lista korostaa silti oikean päivän.

Service worker rakennetaan `app/sw.ts`-lähteestä Serwistillä, joka laskee
esisäilötyt tiedostot käännöksen tuloksesta — versionumeroa ei tarvitse
ylläpitää käsin. Fontit tulevat `next/font`-paketin kautta omalta palvelimelta,
joten Google Fontsiin ei enää tehdä verkkopyyntöä; Serwist säilöö ne osana
`defaultCachea` `static-font-assets`-välimuistiin.

Ikonit renderöidään `public/icons/icon.svg`-lähteestä. Jos muutat merkkiä, aja:

```bash
./public/icons/render.sh
```

Maskable-versiossa (`icon-maskable.svg`) merkki on kutistettu 78 %:iin, koska
Android rajaa ikonista ympyrän tai muun muodon eikä merkki saa jäädä reunan
alle.

## API

### `GET /api/menu`

Kuluvan päivän lista TRMNL:lle. Jos päivälle ei ole ruokailua, `meals` on tyhjä.

```json
{
  "date": "ke 12.8.2026",
  "meals": [
    { "name": "Lounas", "foods": "Härkäpapupihvit, Perunasosetta, Tartarkastiketta, Sekaleipää" },
    { "name": "Lounas", "foods": "Kalapuikot, Perunasosetta, Tartarkastiketta, Sekaleipää" }
  ]
}
```

### `GET /api/week?offset=0`

Maanantaista perjantaihin. `offset` siirtää viikkoja eteen- tai taaksepäin
(`1` = ensi viikko, `-1` = viime viikko). Päivät palautetaan aina viitenä,
myös silloin kun ruokailua ei ole.

```json
{
  "restaurant": "Meilahden ala-aste",
  "week": 33,
  "start": "2026-08-10",
  "end": "2026-08-14",
  "today": "2026-08-11",
  "days": [
    {
      "date": "2026-08-12",
      "weekday": "ke",
      "label": "12.8.",
      "isToday": false,
      "options": [
        {
          "main": ["Härkäpapupihvit"],
          "sides": ["Perunasosetta", "Tartarkastiketta", "Sekaleipää"],
          "diets": "L, M, G, N, S, K, Veg"
        }
      ]
    }
  ]
}
```

Aromi jakaa annoksen osiin, joten pääruoka (`main`) ja lisukkeet (`sides`)
saadaan erilleen. Saman päivän vaihtoehdot erotetaan Aromissa pisteellä
("Lounas" / "Lounas."), joten `options`-järjestys on ainoa luotettava erottelu —
niitä ei kannata nimetä kasvis-/liharuoaksi.

## Ruokavaliomerkinnät

`diets` sisältää Aromin koodit. Merkitykset (`api/Common/Restaurant/Legends`):

| Koodi | Selite | Koodi | Selite |
|---|---|---|---|
| `L` | Laktoositon | `S` | Sianlihaton |
| `M` | Maidoton | `K` | Kananmunaton |
| `G` | Gluteeniton | `Veg` | Vegaaninen |
| `N` | Naudanlihaton | `♥` | Parempi valinta |

Verkkosivu näyttää näistä vain `Veg` ja `♥`. Tarkat allergeenitiedot kannattaa
tarkistaa Aromin omalta sivulta — niitä ei pidä johtaa näistä koodeista.

## Toisen koulun tai päiväkodin käyttöönotto

Muokkaa `lib/aromi.ts`-tiedoston yläreunan vakioita:

- `API_BASE` — portaalin polku, esim. `.../PALKE/KeMenu054/api/...`
- `RESTAURANT_ID`, `DINER_GROUP_ID`, `DIET_GROUP_ID`
- `RESTAURANT_NAME` (ja otsikot `app/page.tsx`- ja `app/layout.tsx`-tiedostoissa)

Tunnisteet löytyvät portaalin omista API-kutsuista. Portaali on Angular-sovellus,
joten ne eivät näy HTML-lähdekoodissa:

```bash
BASE=https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/api

# RESTAURANT_ID: etsi Restaurants-listalta oikea UniqueCode
curl -s "$BASE/Common/Page/GetPageInfo" | jq '.Restaurants[] | select(.UniqueCode=="KeMenu054")'

# DINER_GROUP_ID ja DIET_GROUP_ID
curl -s "$BASE/GetRestaurantPublicDinerGroups?id=<RESTAURANT_ID>\
&startDate=2026-08-10T00:00:00Z&endDate=2026-08-16T00:00:00Z" | jq '.[] | {Name, DinerGroupId, DietGroupId}'
```

Jos koululla on useampi ruokailijaryhmä, valitse oikea `Name`-kentän perusteella.

## Teknologiat

- [TRMNL](https://trmnl.com/) - e-ink -näyttöalusta
- [Next.js](https://nextjs.org/) - sovelluskehys
- [Vercel](https://vercel.com/) - julkaisualusta
- [Aromi](https://aromi.hel.fi/) - Helsingin kaupungin ruokalistajärjestelmä
