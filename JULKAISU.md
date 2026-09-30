# Siisti piha — julkaisu

## Pysyvä käyttö Renderissä (suositus)

Sovellus on Node-palvelin (Express + SQLite + staattinen frontend).  
**Free-tierillä ei ole pysyvää levyä** — data häviää redeployssa.  
Pysyvään käyttöön: **Starter** (tai kalliimpi) + **Disk**.

### Vaihtoehto A: Blueprint (`render.yaml`)

1. Pushaa repo GitHubiin
2. Render Dashboard → **New** → **Blueprint**
3. Valitse repo — `render.yaml` luo Web Servicen + 1 GB diskin (`/var/data`)
4. Syötä kun Render kysyy:
   - `ADMIN_EMAIL` — oma sähköposti
   - `ADMIN_PASSWORD` — vahva salasana
5. Deploy → avaa `https://….onrender.com` ja kirjaudu adminilla  
   Luo muut käyttäjät sovelluksen kautta (Users).

### Vaihtoehto B: manuaalinen Web Service

| Asetus | Arvo |
|--------|------|
| Runtime | Node |
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Plan | **Starter** (ei Free) |
| Disk | mount `/var/data`, esim. 1 GB |

**Environment**

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/var/data` |
| `JWT_SECRET` | pitkä satunnainen (Render Generate) |
| `ADMIN_EMAIL` | ensimmäisen ylläpitäjän sähköposti |
| `ADMIN_PASSWORD` | vahva salasana |
| `ADMIN_NAME` | valinnainen, oletus `Ylläpitäjä` |

Älä aseta `SEED_DEMO=1` tuotantoon.

### Mitä levy säilyttää

- SQLite: `$DATA_DIR/siisti-piha.sqlite`
- Kuvat: `$DATA_DIR/uploads/`
- VAPID-avaimet (push): `$DATA_DIR/vapid.json` (tai aseta `VAPID_*` env)

### Huomioita

- Render nukuttaa palvelun idlellä Starterissäkin joskus hinnoittelusta riippuen — tarkista nykyinen plan.
- Varmuuskopioi ajoittain `siisti-piha.sqlite` (Render shell / disk backup).
- Vaihda admin-salasana heti jos käytit väliaikaista.

### PWA-päivitykset (kotivalikko)

Kun pushaat uuden version ja Render deployaa, käyttäjien **ei tarvitse poistaa** sovellusta kotivalikosta.

- Uusi service worker aktivoituu automaattisesti (`autoUpdate` + `skipWaiting`)
- Sovellus tarkistaa päivitykset avattaessa / fokusuksessa ja lataa uuden buildin
- Riittää että käyttäjä avaa sovelluksen uudelleen (tai pitää sen auki hetken verkossa)

---

## Netlify Drop (vain demoon, selainkohtainen data)

```bash
npm install
npm run package:netlify
```

Pudota `siisti-piha-netlify.zip` → [app.netlify.com/drop](https://app.netlify.com/drop).

Data = `localStorage` (ei yhteistä kantaa laitteiden välillä). Ei sovi pysyvään yhteiskäyttöön.

| Rooli | Sähköposti | Salasana |
|-------|------------|----------|
| Ylläpitäjä | `admin@siistipiha.local` | `admin123` |
| Jäsen | `aino@siistipiha.local` | `demo123` |

---

## Paikallinen Node

```bash
export JWT_SECRET='pitkä-satunnainen-salaisuus'
# ensimmäinen käynnistys tuotantomoodissa:
export ADMIN_EMAIL='sina@esimerkki.fi'
export ADMIN_PASSWORD='vahva-salasana'
npm run build && npm start
```

Tai demoseed: `SEED_DEMO=1 npm run build && SEED_DEMO=1 npm start` → http://localhost:8787
