# Käyttö

## Render (suositus tuotantoon)

**https://siisti-salinpiha.onrender.com**

Katso `JULKAISU.md` ja `render.yaml`. Data tallentuu Render-levylle (`/var/data`).

## GitHub Pages (selaindemo)

1. Repo: https://github.com/jussiheim-alt/Siisti-salinpiha
2. Settings → **Pages** → Source: **GitHub Actions**
3. Varmista että workflow `.github/workflows/pages.yml` on `main`-haarassa
4. Odota Actions-ajo (vihreä)
5. Avaa: **https://jussiheim-alt.github.io/Siisti-salinpiha/**

Kirjautuminen (local/demo):
- Ylläpitäjä: `admin@siistipiha.local` / `admin123` (tai paikallinen founding-admin)

Data tallentuu selaimeen (localStorage).

## Paikallinen käyttö

```bash
git clone https://github.com/jussiheim-alt/Siisti-salinpiha.git
cd Siisti-salinpiha
npm install
npm run build:netlify
npx serve dist
```

Avaa http://localhost:3000 (tai serve-komennon näyttämä portti).
