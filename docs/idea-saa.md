# Siisti piha — idea: säähälytykset (Ilmatieteen laitos)

**Status:** toteutettu etusivulle (ennuste + pihavinkit)  
**Lähde:** käyttäjäidea 2026-09-27

## Toteutettu

- FMI virallinen edited-ennuste, paikka `Vääksy` (piste 61.17379, 25.54716)
- Välimuisti ~60 min backendissä (`/api/weather`, mukana `/api/home`)
- Etusivulla: nykyinen sää, 3 päivää, automaattiset vinkit (lumi / liukkaus / sade / tuuli)
- **Säähälytykset:** tunnin välein; ilmoitus + push vain julkaistun Pihavuoron jäsenille; max 1×/tyyppi/vrk/vuoro
- Ilmoituslista etusivulla + `/ilmoitukset`
- **CAP-varoitukset:** FMI Atom-syöte, suodatettu Vääksyn pisteeseen (tuuli/sade/jalankulku/liikenne/ukkonen/…)

## Vielä myöhemmin

- Ylläpitäjän kynnykset ja paikka-asetus
- Spämmisuoja ennusteen pahentuessa (uudelleenlähetys)


## Idea

- Hae sääennuste Ilmatieteen laitokselta (~tunnin välein)
- Ilmoita **vain kyseisen viikon Pihavuorossa oleville**
- Esimerkkejä:
  - Ennustettu lumisade → “Huomiseksi ~X mm lunta — lumityöt ajoissa”
  - Lämpeneminen / liukkausvaara → “Suositus: hiekoitus ennen kokouksia”
  - Kova tuuli → “Tarkista piha: roskat, oksat”

## Tekninen toteutus (mahdollinen)

| Komponentti | Ratkaisu |
|-------------|----------|
| Ennuste | FMI Open Data WFS, ei API-avainta (`opendata.fmi.fi/wfs`) — esim. Harmonie-piste-ennuste `place` / lat,lon |
| Varoitukset | FMI CAP-varoitukset (tuuli, jalankulkusää, liikennesää, lumi/jää) |
| Tausta-ajo | Backend cron ~60 min: hae → tulkitse säännöt → luo ilmoitukset |
| Kohdennus | Vain `published` Pihavuoron assignmentit (lead + helpers) kyseiselle viikolle |
| Kanava MVP+ | Sovelluksen sisäiset ilmoitukset (kellokuvake) |
| Kanava myöhemmin | Push (PWA Web Push) / valinnainen WhatsApp |

Sijainti asetuksissa: kiinteistön paikka (esim. Asikkala / Vääksy koordinaatit).

## Sääntömoottori (luonnos)

| Ehto | Viesti / suositus | Linkki tehtävään |
|------|-------------------|------------------|
| Ennustettu sade lunta ≥ kynnys (esim. 3 cm / 24 h) | Lumityöt pian; kokouspäivänä ennen väkeä | T1/T2 |
| Lämpötila ylittää 0 °C lumen jälkeen tai jalankulkusää / liukkaus | Hiekoitus | T3 |
| Tuulivaroitus maa-alueille / kova tuuli | Tarkista piha (roskat, oksat) | K6 + huomautus |
| Ei merkittävää muutosta | Ei uutta ilmoitusta (vältä spämmiä) | — |

Kynnykset ylläpitäjän asetuksissa. Sama hälytys max 1× / tyyppi / vuorokausi / vuoro, ellei ennuste pahene selvästi.

## MVP vs vaihe 2

| | MVP | Vaihe 2 (suositus tälle) |
|--|-----|---------------------------|
| Auth, vuorot, kuittaukset | x | |
| Säähaku + säännöt | | x |
| Ilmoitukset vuorossa oleville | | x |
| Push-ilmoitukset | | x+ |

Perustelu: säähälytys tarvitsee vakaan backendin, cronin ja ilmoitusjärjestelmän — kannattaa rakentaa kun Pihavuoro-ydin toimii.

## Avoimet päätökset

1. Paikka: kaupunki/`place` vai tarkat koordinaatit?
2. Vain vuorossa olevat vai myös ylläpitäjät aina?
3. Sisäinen ilmoitus riittää aluksi, vai push heti?
4. Lumikynnys (esim. 2 cm vs 5 cm) ja tuulen raja?
