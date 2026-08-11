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
                    │   Puter Worker      ├────►  Aromi API (aromi.hel.fi)
Verkkosivu    ──────┤   worker.js         │
                    └─────────────────────┘

GET /api/menu   →  { date, meals }          päivän lista, TRMNL
GET /api/week   →  { week, days[5], … }     koko viikko, verkkosivu
```

- **`worker.js`** hakee ruokalistan Aromista ja muuntaa sen yksinkertaiseksi JSONiksi.
- **`TRMNL plugin.html`** renderöi päivän listan e-ink -näytölle Jinja2-templatella.
- **`index.html`** on itsenäinen verkkosivu, joka näyttää koko viikon puhelimessa.

## Tiedostot

| Tiedosto | Kuvaus |
|---|---|
| `worker.js` | Puter Worker -backend, API-proxy Aromin ja asiakkaiden välillä |
| `index.html` | Mobiiliystävällinen viikkonäkymä, julkaistaan Puter-sivustona |
| `TRMNL plugin.html` | Jinja2-template TRMNL-näytölle |

## Asennus

### 1. Worker Puter.com-alustalle

1. Luo tili [Puter.com](https://puter.com/)-palveluun
2. Luo uusi Worker ja kopioi `worker.js` sisältö sinne
3. Worker tarjoaa kaksi endpointia, `GET /api/menu` ja `GET /api/week`

### 2. Verkkosivu

1. Avaa `index.html` ja aseta `WORKER_URL` osoittamaan omaan workeriisi
   (tiedoston lopussa olevassa scriptissä)
2. Julkaise tiedosto Puter-sivustona
3. Sivu hakee datan workerilta — worker lähettää `Access-Control-Allow-Origin: *`,
   joten sivu voi olla eri osoitteessa kuin worker

### 3. TRMNL Plugin

1. Luo [TRMNL Developer](https://usetrmnl.com/plugin/new)-sivulla uusi Private Plugin
2. Strategiaksi valitse **Webhook/Polling** ja syötä workerin URL
   (`https://<sinun-worker>.puter.site/api/menu`)
3. Kopioi `TRMNL plugin.html` sisältö pluginin **Markup**-kenttään

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

Muokkaa `worker.js`-tiedoston yläreunan vakioita:

- `API_BASE` — portaalin polku, esim. `.../PALKE/KeMenu054/api/...`
- `RESTAURANT_ID`, `DINER_GROUP_ID`, `DIET_GROUP_ID`
- `RESTAURANT_NAME` (ja `index.html`-tiedoston otsikot)

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
- [Puter.com](https://puter.com/) - pilvialusta workereille ja staattisille sivuille
- [Aromi](https://aromi.hel.fi/) - Helsingin kaupungin ruokalistajärjestelmä
