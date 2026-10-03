# Siisti salin piha — julkaisu

## Julkinen osoite

**https://siisti-salinpiha.onrender.com**

Deploy-tarkistus: https://siisti-salinpiha.onrender.com/api/meta/app  
(`commit` = GitHub `main`-viimeisin, `uiVersion` näkyy).

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
   - `APP_PUBLIC_URL` — `https://siisti-salinpiha.onrender.com` (kutsulinkkejä varten)
5. Deploy → kirjaudu Jussin tai Jonin tunnuksella  
   Kutsu muut **Jäsenet**-sivulta (kutsulinkki + käyttöoikeustaso).

Jos palvelu on jo olemassa: Dashboard → **siisti-salinpiha** → **Manual Deploy** → Deploy latest commit.

### Vaihtoehto B: manuaalinen Web Service

| Asetus | Arvo |
|--------|------|
| Runtime | Node |
| Build | `npm install --include=dev && npm run build` |
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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push-ilmoitukset (suositus; muuten `$DATA_DIR/vapid.json`) |
| `VAPID_SUBJECT` | esim. `mailto:jussiheim@gmail.com` |
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
- Varmuuskopio: Ylläpitäjä-sivulta **Lataa** / **Palauta** (SQLite + kuvat `.tar.gz`; palautus vaatii sanan `PALAUTA`).
- Vaihda admin-salasana heti jos käytit väliaikaista.

### PWA-päivitykset (kotivalikko)

Kun pushaat uuden version ja Render deployaa, käyttäjien **ei tarvitse poistaa** sovellusta kotivalikosta.

Varmista deploy: avaa `https://<oma-url>/api/meta/app` — `commit` pitäisi vastata GitHubin `main`-viimeisintä committia ja `uiVersion` näkyä. Jos vanha UI jää näkyviin iPhonella, sulje PWA kokonaan (app switcher) ja avaa uudelleen, tai vedä alas päivittääksesi.

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
