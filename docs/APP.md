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
| `JWT_SECRET` | suositeltu | Istunnot; jos puuttuu, luodaan `data/jwt-secret.txt` |
| `SEED_DEMO` | `0` / pois | `1` = luo demokäyttäjät tyhjään kantaan |
| `PORT` | valinnainen | Oletus `8787` |
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
