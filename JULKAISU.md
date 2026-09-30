# Siisti piha — Netlify Drop -julkaisu

Tämä paketti toimii kuten **Saldo**: staattinen sivusto Netlify Dropissa. Data tallentuu selaimen `localStorage`-tilaan (ei yhteistä palvelinkantaa).

## 1. Lataa zip

Käytä valmista `siisti-piha-netlify.zip`-tiedostoa (dist-sisältö juuressa).

## 2. Pudota Netlifyyn

1. Avaa [app.netlify.com/drop](https://app.netlify.com/drop)
2. Vedä zip-tiedosto alueelle (tai purettu `dist`-kansio)
3. Odota deploy — saat osoitteen muodossa `https://….netlify.app`

## 3. Kirjaudu

| Rooli | Sähköposti | Salasana |
|-------|------------|----------|
| Ylläpitäjä | `admin@siistipiha.local` | `admin123` |
| Jäsen | `aino@siistipiha.local` | `demo123` |

Muut demojäsenet: `matti@`, `liisa@`, `juhani@`, `sari@` + `siistipiha.local` / `demo123`.

## Huomioita

- **Data on selainkohtainen.** Eri laitteet / incognito eivät jaa samaa kantaa.
- Sää on stub (ei FMI-liveä Drop-tilassa). Push-ilmoitukset eivät toimi.
- Tyhjennä data: selaimen sivustotiedot / localStorage-avain `siisti-piha-local-db-v1`.

## Rakenna zip itse

```bash
npm install
npm run package:netlify
```

Tuloste: `siisti-piha-netlify.zip` projektijuureen.

## Node-palvelin (oma host)

Jos tarvitset yhteisen SQLite-kannan ja oikean sään:

```bash
SEED_DEMO=1 npm run build
SEED_DEMO=1 npm start
```
