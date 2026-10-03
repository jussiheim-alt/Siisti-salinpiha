# Siisti salin piha

Pihavuorot, tehtävät ja huomiot — Vääksy.

**Avaa sovellus:** https://siisti-salinpiha.onrender.com

## Pysyvä käyttö (Render, suositus)

Katso **[JULKAISU.md](./JULKAISU.md)**. Lyhyesti:

1. Render → palvelu **siisti-salinpiha** (tai New → Blueprint → tämä repo)
2. Käytä **Starter**-suunnitelmaa + **persistent disk** (`/var/data`)
3. Aseta `JWT_SECRET`, `ADMIN_PASSWORD`, `JONI_EMAIL`, `JONI_PASSWORD`, `APP_PUBLIC_URL=https://siisti-salinpiha.onrender.com`

Ylläpitäjät: **Jussi Heimonen** ja **Joni Moilanen**. Muut käyttäjät kutsutaan sovelluksesta (rooli + rajoitukset).

Data (SQLite + kuvat) säilyy levyllä redeployjen yli.

## Paikallinen kehitys

```bash
npm install
npm run dev          # API + Vite
# tai selaintila kuten Netlify Drop:
npm run dev:local
```

## Paikallinen Node (SQLite)

```bash
npm install
export ADMIN_PASSWORD='vahva-salasana'
export JONI_EMAIL='joni@esimerkki.fi'
export JONI_PASSWORD='vahva-salasana'
npm run build && npm start
```

Avaa http://localhost:8787
