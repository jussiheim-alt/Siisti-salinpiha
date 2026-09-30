# Siisti piha

Pihavuorot, tehtävät ja huomiot — Vääksy.

## Netlify Drop (suositus demoon)

Katso **[JULKAISU.md](./JULKAISU.md)**. Lyhyesti:

```bash
npm install
npm run package:netlify
```

Pudota `siisti-piha-netlify.zip` osoitteeseen [app.netlify.com/drop](https://app.netlify.com/drop).

| Rooli | Sähköposti | Salasana |
|-------|------------|----------|
| Ylläpitäjä | admin@siistipiha.local | admin123 |
| Jäsen | aino@siistipiha.local | demo123 |

Data tallentuu selaimeen (`localStorage`).

## Paikallinen Node-demo (SQLite + API)

```bash
npm install
SEED_DEMO=1 npm run build
SEED_DEMO=1 npm start
```

Avaa http://localhost:8787 — vaatii `SEED_DEMO=1` demokäyttäjille.

## Kehitys

```bash
# Express + Vite (proxy)
npm run dev

# Pelkkä selaintila (kuten Netlify)
npm run dev:local
```
