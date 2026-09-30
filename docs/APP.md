# Siisti salin piha

Pihavuorojen hallinta: viikkovuorot, tehtävät, kuittaukset, huomiot ja käytettävyysrajoitukset.

## Käynnistys

```bash
npm install
npm run dev          # API :8787 + Vite :5173
# tai tuotanto:
export JWT_SECRET='pitkä-satunnainen-salaisuus'
export ADMIN_PASSWORD='vahva-salasana'
export JONI_EMAIL='joni@esimerkki.fi'
export JONI_PASSWORD='vahva-salasana'
npm run build && npm start   # palvelee dist + API :8787
```

## Ympäristömuuttujat

| Muuttuja | Tuotanto | Kuvaus |
|----------|----------|--------|
| `JWT_SECRET` | pakollinen | Istunnot; jos puuttuu, luodaan `$DATA_DIR/jwt-secret.txt` |
| `DATA_DIR` | Render: `/var/data` | SQLite + VAPID; oletus `./data` |
| `UPLOADS_DIR` | valinnainen | Kuvat; oletus `$DATA_DIR/uploads` tai `./uploads` |
| `APP_PUBLIC_URL` | suositeltu | Julkinen URL kutsulinkkeihin |
| `ADMIN_EMAIL` | oletus `jussiheim@gmail.com` | Jussi Heimonen |
| `ADMIN_PASSWORD` | pakollinen bootstrapissa | Jussin salasana (min. 8) |
| `JONI_EMAIL` | suositeltu | Joni Moilanen |
| `JONI_PASSWORD` | suositeltu | Jonin salasana (min. 8) |
| `PORT` | valinnainen | Oletus `8787` (Render asettaa) |
| `NODE_ENV` | `production` | |

## Käyttäjät ja oikeudet

- Ylläpitäjät (täydet oikeudet): Jussi Heimonen, Joni Moilanen
- Muut jäsenet: kutsu **Jäsenet**-sivulta (`/kayttajat`) → kutsulinkki
- Käyttöoikeustasot: `admin` | `member` (+ käytettävyysrajoitukset)

## MVP + vaihe 2

- Salasana-auth, admin/member
- Käyttäjät + rajoitukset (`no_heavy`, `no_lead`)
- Pihavuoro ma–su: draft → publish (+ ilmoitus vuorolaisille)
- Katalogi v1 + kuittaukset
- Huomiot + kuva (+ ilmoitus), apukutsut, sää/CAP, ilmoituskeskus
- Hub-vuositarkastukset (muokkaus: admin / viikon lead)
- PWA (autoUpdate: uusi deploy päivittyy kotivalikon sovellukseen ilman uudelleenasennusta)
