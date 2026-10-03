# Siisti piha — idea: käytettävyys / rajoitukset

**Status:** lukittu päätös rajoitustasosta · **Prioriteetti:** MVP  
**Lähde:** käyttäjäidea 2026-09-27 + tarkennus

## Idea

Ylläpitäjä määrittelee käyttäjän käytettävyyden (esim. “ei raskaisiin töihin”).  
Ohjelma täyttää vuorot järjestyksessä, mutta **kunniottaa rajoituksia tehtävätasolla**.

## Lukittu päätös

Henkilö **saa olla Pihavuorossa**, mutta **ei lumitöihin** (eikä muihin raskaisiin tehtäviin).  
Rajoitus ei sulje pois koko viikkoa.

Viikon **vastuuhenkilön** täytyy nähdä kunkin vuorolaisen rajoitukset, jotta hän osaa jakaa työt.

## Käyttö

1. Admin asettaa käyttäjälle tagit (+ valinnainen yksityinen muistiinpano)
2. Suositus: henkilö kelpaa lead/helperiksi viikolle; raskaita ShiftTaskeja ei anneta hänelle oletuksena
3. Pihavuoro-näkymässä vastuuhenkilö (ja admin) näkee henkilön nimen yhteydessä rajoitukset  
   esim. “Matti — ei raskaisiin / ei lumitöitä”
4. Kuittaus: henkilö ei voi kuitata itselleen kiellettyä tehtävää; lead näkee miksi

## Tagit (MVP)

| Koodi | Näyttöteksti | Vaikutus |
|-------|--------------|----------|
| `no_heavy` | Ei raskaisiin töihin | Ei tehtäviä joilla `effort=heavy` (lumi T1, siimaleikkuri K1, …) |
| `no_lead` | Ei vastuuhenkilöksi | Suositus ei ehdota leadiksi |
| `snoozeUntil` | Tauolla → pvm | Ei assignmentiin ennen päivää |

Admin-only: `constraintNote` (ei näy muille).

## Tehtävien effort

TaskTemplate / ShiftTask:
- `effort`: `light` | `heavy`
- v1-katalogi: T1 (lumityöt) = heavy; K1 (siimaleikkuri) = heavy; T2 harjaus, K2 lehtipuhallin, K6 siisteys = light (säädettävissä)

## Näkyvyys

| Kuka | Näkee rajoitukset |
|------|-------------------|
| Admin | aina, käyttäjälistassa + vuorossa |
| Viikon **vastuuhenkilö** | oman Pihavuoronsa henkilöillä |
| Avustajat / muut | ei toisten rajoituksia (vain omat, jos halutaan) |

UI-paikat:
- Pihavuoro-detail: rosteri restricioineen
- Tehtäväjako: varoitus jos yrittää antaa heavy-tehtävän `no_heavy`-henkilölle
- Suosituslista: ikoni/tagi henkilön vieressä

## Suosituslogiikka

1. Kelvolliset jäsenet viikolle (aktiivinen, ei snooze)
2. Lead: suodata `no_lead`
3. Järjestä tasapuolisesti (viimeisin vuoro)
4. Tehtäviä luotaessa / jaettaessa: `no_heavy` → assigneeiksi vain light-tehtävät; heavy jää leadille / muille

## Tietomalli

- User: `constraints[]`, `constraintNote?`, `snoozeUntil?`
- TaskTemplate / ShiftTask: `effort`
- Assignment pysyy; rajoitus ei poista assignmentia

## Avoimet (pienet)

1. Saako lead silti *pakottaa* heavy-tehtävän rajoitetulle (varoitusdialogi)? Ehdotus: ei MVP:ssä.
2. Näkeekö rajoitettu henkilö itse taginsa asetuksissa? Ehdotus: kyllä (omat).
