# Siisti piha

Pihavuorojen hallinta: viikkovuorot, tehtävät, kuittaukset, huomiot ja käytettävyysrajoitukset.

## Käynnistys

```bash
npm install
npm run dev          # API :8787 + Vite :5173
# tai tuotanto:
export JWT_SECRET='pitkä-satunnainen-salaisuus'
npm run build && npm start   # palvelee dist + API :8787
```

## Ympäristömuuttujat

| Muuttuja | Tuotanto | Kuvaus |
|----------|----------|--------|
| `JWT_SECRET` | pakollinen | Istunnot; jos puuttuu, luodaan `$DATA_DIR/jwt-secret.txt` |
| `DATA_DIR` | Render: `/var/data` | SQLite + VAPID; oletus `./data` |
| `UPLOADS_DIR` | valinnainen | Kuvat; oletus `$DATA_DIR/uploads` tai `./uploads` |
| `ADMIN_EMAIL` | suositeltu | Luo ensimmäinen admin tyhjään kantaan |
| `ADMIN_PASSWORD` | suositeltu | Adminin salasana (vain bootstrap) |
| `ADMIN_NAME` | valinnainen | Oletus `Ylläpitäjä` |
| `SEED_DEMO` | pois | `1` = demokäyttäjät (älä tuotantoon) |
| `PORT` | valinnainen | Oletus `8787` (Render asettaa) |
| `NODE_ENV` | `production` | |

## Demotunnukset (vain kehitys / SEED_DEMO=1)

| Rooli | Sähköposti | Salasana |
|-------|------------|----------|
| Ylläpitäjä | admin@siistipiha.local | admin123 |
| Käyttäjä (ei raskaisiin) | matti@siistipiha.local | demo123 |
| Muut demot | aino@…, liisa@…, juhani@…, sari@… | demo123 |

## MVP + vaihe 2

- Salasana-auth, admin/member
- Käyttäjät + rajoitukset (`no_heavy`, `no_lead`)
- Pihavuoro ma–su: draft → publish (+ ilmoitus vuorolaisille)
- Katalogi v1 + kuittaukset
- Huomiot + kuva (+ ilmoitus), apukutsut, sää/CAP, ilmoituskeskus
- Hub-vuositarkastukset (muokkaus: admin / viikon lead)
- PWA
