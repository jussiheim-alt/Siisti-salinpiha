# Siisti salin piha — lukittu kokonaisuussuunnitelma

**Lukittu:** 2026-09-27  
Toteutus näillä rajauksilla. Muutokset = uusi versio / erillinen päätös.

---

## Tuote

| | |
|--|--|
| Sovellus | **Siisti salin piha** |
| Vuoro | **Pihavuoro** (ma–su) |
| Käyttäjät | ≥2 ylläpitäjää, ~20 jäsentä |
| Kokoonpano | 1 vastuuhenkilö + 1–5 avustajaa |
| Auth | Sähköposti/tunnus + **salasana** |
| Julkaisu | draft → published |
| Katalogi | **v1 lukittu** (`tehtavakatalogi.md`) |

---

## MVP (rakennetaan ensin)

1. **Auth + roolit** (admin / member)
2. **Käyttäjähallinta** + **käytettävyysrajoitukset** (esim. ei raskaisiin)  
   - Saa olla vuorossa ilman lumitöitä  
   - Vastuuhenkilö näkee rajoitukset rosterissa
3. **Pihavuorot** viikoittain: lead + 1–5, draft/publish, suositus (järjestys + rajoitukset)
4. **Tehtävät v1-katalogista** + kuittaus  
   - Oma tehtävä: vuorossa oleva  
   - Kaikkien tehtävät: vastuuhenkilö
5. **Käyttäjän etusivu + kalenteri**
6. **Huomiot** — teksti + kuva kaikille; admin vastaa + tila
7. PWA + vakaa hostaus

### Ei MVP:ssä (myöhemmin)

- Push/WhatsApp-automaatio laajennukset
- Pysyvä hostaus

### Vaihe 2 tehty

- Ylimääräiset tehtävät / **apukutsut**
- Sää + CAP + ilmoituskeskus
- **Hub-vuositarkastukset** (`/huolto`)

---

## Ideat → prioriteetti

| # | Idea | Prioriteetti |
|---|------|--------------|
| 1 | Säähälytykset FMI | Vaihe 2 · `idea-saa.md` |
| 2 | Huomiot + kuva | **MVP** · `idea-huomiot.md` |
| 3 | Ylimääräiset apukutsut | Vaihe 2 · `idea-ylimääräiset.md` |
| 4 | Käytettävyysrajoitukset | **MVP** · `idea-kaytettavyys.md` |

---

## Toteutusjärjestys

1. Projekti + auth + roolit  
2. Käyttäjät + rajoitustagit  
3. Pihavuoro + assignmentit + draft/publish + suositus  
4. Tehtävät + effort + kuittaussäännöt  
5. Etusivu + kalenteri  
6. Huomiot + kuva + admin-vastaus  
7. PWA + tuotanto  

---

## Tiedostot

- `suunnitelma.md` — tämä
- `tehtavakatalogi.md` — v1 lukittu
- `idea-saa.md` / `idea-huomiot.md` / `idea-ylimääräiset.md` / `idea-kaytettavyys.md`
- `lahteet/` — Hub-kuvakaappaukset
