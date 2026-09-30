# Siisti piha — tehtäväkatalogi v1 (LUKITTU)

**Status:** lukittu 2026-09-27  
**Sovellus:** Siisti piha · **Vuoro:** Pihavuoro  
Tätä katalogia käytetään MVP:ssä. Muutokset vain erikseen päätettyinä versioina (v1.1…).

---

## Kerrokset

| Kerros | MVP | Sisältö |
|--------|-----|---------|
| **A. Pihavuoro** | Kyllä | Viikkotehtävät alla |
| **B. Hub-huolto** | Ei (myöhemmin) | Vuosittaiset / 1–2 v tarkastukset pysyvät Hubissa toistaiseksi |

Yhteinen toimintatapa puutteissa: huomautus (+ kuva) → ilmoita huoltokoordinaattorille → korjaa jos mahdollista → kirjaa.

---

## A. PIHAVUORO v1

### Talvi

| ID | Tehtävä | Tahti | Oletus |
|----|---------|-------|--------|
| T1 | Lumityöt — heti kun mahdollista; kokouspäivinä ennen väkeä; erityisesti portaat parkki↔sali | tarvittaessa | all |
| T2 | Pieni lumi 1–2 cm: harjaa portaat, salin edustan kiveys, varauloskäynnin kulkuväylä (parkkia ei välttämättä kolata) | tarvittaessa | helpers |
| T3 | Hiekoitus hyvissä ajoin ennen kokouksia ja kenttäkokouksia | tarvittaessa | lead |
| T4 | Välineet ulkovarastosta (varauloskäynnin vieressä); puhdista lumesta ennen palautusta | kun töitä | helpers |
| T5 | Vastuuveli: varmistaa viikon työt; pyytää lisäapua jos resurssit eivät riitä | joka viikko | lead |

### Sulankausi / kesä / syksyn lehtityöt

**Ei nurmikon leikkuuta.**

| ID | Tehtävä | Tahti | Oletus |
|----|---------|-------|--------|
| K1 | Siimaleikkuri: parkkialueen ja ojien reunojen siistiminen | kesällä / tarve | helpers |
| K2 | Lehtipuhallin: kulkuväylät lehdistä ja neulasista | tarvittaessa (myös syksy) | helpers |
| K3 | Kiveyksen rikkakasvit ja sammal | usein kasvukaudella | helpers |
| K4 | Asfaltin saumojen / reunojen kasvillisuus ja roskat | usein kasvukaudella | helpers |
| K5 | Öljyläikät: tarkista ja puhdista | tarvittaessa | lead/helpers |
| K6 | Yleissiisteys: parkki, sisäänkäynti, kiveys | viikko | all |
| K7 | Silmäys: irtonaiset kivet, reunakivet, vajoamat, seisova vesi | silmäys | lead |
| K8 | Maastoportaat ja kaiteet — kunto | silmäys | lead |
| K9 | Ulkovarasto: välineet paikallaan ja kunnossa | silmäys | helpers |
| K10 | Viikon kuittaus: tehty / ei tarvetta / huomautus | viikko | lead |

### Ohjeet (lyhyt, sovellukseen)

**Talvi (WhatsApp):** Vastuuveli vastaa viikosta ja pyytää apua tarvittaessa. Runsaalla lumella työt heti; kokouspäivinä ennen saapuvia. Portaat parkki–sali kriittiset. Vähällä lumella harjaa portaat, salin kiveys ja varauloskäynti. Hiekoitus ennen kokouksia/kenttäkokouksia. Välineet ulkovarastossa; puhdista ennen palautusta.

**Siimaleikkuri:** Parkkialueen ja ojien reunat. Suojaimet; varo autoja, ihmisiä, rakenteita.

**Lehtipuhallin:** Kulkuväylät vapaina lehdistä ja neulasista. Älä puhalla kohti ihmisiä, autoja tai avoimia ovia/ikkunoita.

**Kiveys/asfaltti:** Rikkaruohot ja sammal saumoista; öljy pois; silmää vajoamat ja reunakivet. Epävarmoissa korjauksissa / painepesussa / torjunta-aineissa kysy huolto-ohjaajalta.

---

## B. Hub (ei MVP-katalogissa, referenssi)

**Status:** toteutettu sovellukseen (`/huolto`) · lähde Hub-ohjeet  

Säilytetään lähteenä: ulko-/sisävarasto, kiveys, asfaltti, viheralueet (1×/v), hulevesi (1–2 v). Kuvat: `piha/lahteet/`.

---

## Sovelluskentät (toteutusta varten)

- `id`, `title`, `instructions`, `season` (`talvi` | `sulankausi` | `all`)
- `cadence`: `every_week` | `as_needed`
- `defaultAssignee`: `lead` | `helpers` | `all`
- `allowSkipReason`: true
- `layer`: `pihavuoro` (v1)

---

## Seuraava vaihe projektissa

Katalogi lukittu → voidaan siirtyä **Siisti piha -sovelluksen toteutukseen** (auth, käyttäjät, Pihavuorot, kuittaukset) käyttäen tätä v1-listaa.
