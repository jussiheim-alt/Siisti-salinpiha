# Siisti salin piha — julkaisu

## Pysyvä käyttö Renderissä (suositus)

Sovellus on Node-palvelin (Express + SQLite + staattinen frontend).  
**Free-tierillä ei ole pysyvää levyä** — data häviää redeployssa.  
Pysyvään käyttöön: **Starter** (tai kalliimpi) + **Disk**.

### Vaihtoehto A: Blueprint (`render.yaml`)

1. Pushaa repo GitHubiin
2. Render Dashboard → **New** → **Blueprint**
3. Valitse repo — `render.yaml` luo Web Servicen + 1 GB diskin (`/var/data`)
4. Syötä kun Render kysyy:
   - `ADMIN_PASSWORD` — Jussi Heimosen salasana (min. 8)
   - `JONI_EMAIL` + `JONI_PASSWORD` — Joni Moilasen tunnus
   - `APP_PUBLIC_URL` — esim. `https://siisti-piha.onrender.com` (kutsulinkkejä varten)
5. Deploy → kirjaudu Jussin tai Jonin tunnuksella  
   Kutsu muut **Jäsenet**-sivulta (kutsulinkki + käyttöoikeustaso).

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
| `APP_PUBLIC_URL` | julkinen osoite (kutsulinkit) |
| `ADMIN_EMAIL` | oletus `jussiheim@gmail.com` |
| `ADMIN_PASSWORD` | Jussi Heimosen salasana |
| `JONI_EMAIL` | Joni Moilasen sähköposti |
| `JONI_PASSWORD` | Joni Moilasen salasana |

Demokäyttäjiä ei enää seedata. Muut jäsenet kutsutaan sovelluksesta.

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

---

## Paikallinen Node

```bash
export JWT_SECRET='pitkä-satunnainen-salaisuus'
export ADMIN_PASSWORD='vahva-salasana'
export JONI_EMAIL='joni@esimerkki.fi'
export JONI_PASSWORD='vahva-salasana'
npm run build && npm start
```

Avaa http://localhost:8787 — kutsu muut käyttäjät **Jäsenet**-sivulta.
