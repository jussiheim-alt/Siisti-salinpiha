# Siisti piha

Pihavuorot, tehtävät ja huomiot — Vääksy.

## Pysyvä käyttö (Render, suositus)

Katso **[JULKAISU.md](./JULKAISU.md)**. Lyhyesti:

1. Render → **New → Blueprint** (tai Web Service) → tämä repo
2. Käytä **Starter**-suunnitelmaa + **persistent disk** (`/var/data`)
3. Aseta `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (ei `SEED_DEMO`)

Data (SQLite + kuvat) säilyy levyllä redeployjen yli.

## Paikallinen kehitys

```bash
npm install
npm run dev          # API + Vite
# tai selaintila kuten Netlify Drop:
npm run dev:local
```

## Paikallinen Node-demo (SQLite)

```bash
npm install
SEED_DEMO=1 npm run build
SEED_DEMO=1 npm start
```

Avaa http://localhost:8787

| Rooli | Sähköposti | Salasana |
|-------|------------|----------|
| Ylläpitäjä | admin@siistipiha.local | admin123 |
| Jäsen | aino@siistipiha.local | demo123 |
