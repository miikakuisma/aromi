# Helsingin kaupungin peruskoulujen ruokalistat TRMNL-näytölle

<img width="800" height="480" alt="screenshot" src="https://github.com/user-attachments/assets/727abd4e-5bd0-4216-8978-445368d115fd" />

Helsingin kaupungin peruskoulun päivittäinen ruokalista suoraan [TRMNL](https://trmnl.com/) e-ink -näytölle. Oletuksena kohteena on **Meilahden ala-aste**.

Ruokalistat haetaan Helsingin kaupungin [Aromi-järjestelmästä](https://aromi.hel.fi/AromieMenus/FI/Default/PALKE/KeMenu054/Restaurant.aspx), josta löytyvät kaikkien kaupungin peruskoulujen ruokalistat.

## Miten se toimii

```
TRMNL-näyttö  →  Puter Worker (/api/menu)  →  Aromi API (aromi.hel.fi)
↓
JSON-vastaus: { date, meals }
↓
TRMNL plugin.html renderöi ruokalistan e-ink -näytölle
```

1. **Puter Worker** (`worker.js`) hakee päivän ruokalistan Aromi API:sta ja muuntaa sen yksinkertaiseen JSON-muotoon
2. **TRMNL plugin** (`TRMNL plugin.html`) renderöi datan Jinja2-templatella e-ink -näytölle sopivaan muotoon

HUOM! Allergiatiedot on tarkoituksella karsittu pois, jos haluat ne mukaan joudut muokkaamaan workeriä.

## Tiedostot

| Tiedosto | Kuvaus |
|---|---|
| `worker.js` | Puter Worker -backend, joka toimii API-proxynä Aromin ja TRMNL:n välillä |
| `TRMNL plugin.html` | Jinja2-template, joka renderöi ruokalistan TRMNL-näytölle |

## Asennus

### 1. Worker Puter.com-alustalle

1. Luo tili [Puter.com](https://puter.com/)-palveluun
2. Luo uusi Worker ja kopioi `worker.js` sisältö sinne
3. Worker tarjoaa endpointin `GET /api/menu`, joka palauttaa päivän ruokalistan JSON-muodossa

### 2. TRMNL Plugin

1. Luo [TRMNL Developer](https://usetrmnl.com/plugin/new)-sivulla uusi Private Plugin
2. Strategiaksi valitse **Webhook/Polling** ja syötä Puter Workerin URL (`https://<sinun-worker>.puter.site/api/menu`)
3. Kopioi `TRMNL plugin.html` sisältö pluginin **Markup**-kenttään

## API-vastaus

`GET /api/menu` palauttaa:

```json
{
  "date": "2026-02-26T00:00:00",
  "meals": [
    {
      "name": "Aamupala",
      "foods": "Puuroa, leipää, hedelmää"
    },
    {
      "name": "Lounas",
      "foods": "Lihapullia, perunasosetta, salaattia"
    },
    {
      "name": "Välipala",
      "foods": "Jogurttia ja marjoja"
    }
  ]
}
```

## Muokkaus

Oletuksena worker hakee **Meilahden ala-asteen** (portaali `KeMenu054`) ruokalistaa. Jos haluat vaihtaa koulua, muokkaa `worker.js`-tiedoston yläreunan arvoja:

- `MENU_PORTAL` - koulun portaalin polku (esim. `KeMenu054`)
- `RESTAURANT_ID` - ravintolan tunniste
- `DINER_GROUP_ID` - ruokailijaryhmä
- `DIET_GROUP_ID` - ruokavalioryhmä

Nämä tunnisteet löydät koulun Aromi-sivun selaimen DevTools-työkalujen **Network**-välilehdeltä:

1. Avaa koulun Aromi-sivu ja paina **F12** → **Network**
2. Lataa sivu uudelleen ja avaa päivän ruokalista
3. Etsi pyyntö **`RestaurantMeals`** ja avaa se
4. Pyynnön URL:sta saat `MENU_PORTAL`-polun (ennen `/api/`) ja `Id=`-parametrin (`RESTAURANT_ID`)
5. Pyynnön **Request Body** -kohdasta saat `DinerGroupId`- ja `DietGroupId`-arvot

## Teknologiat

- [TRMNL](https://trmnl.com/) - e-ink -näyttöalusta
- [Puter.com](https://puter.com/) - pilvialusta serverless workereille
- [Aromi](https://aromi.hel.fi/) - Helsingin kaupungin ruokalistajärjestelmä
