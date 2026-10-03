# Siisti piha — roolit, tehtäväkortit ja poistot

Kerätty vaatimukset (odottaa toteutusta kunnes käyttäjä antaa luvan).

## Roolit

1. **Ylläpitäjä** — kaikki oikeudet.
2. **Vastuuveli** — viikon lead; käyttäjän kaikki oikeudet + Hub-merkintä (jos liitetty vuorolle) + apukutsun luonti. Näkyy kaikille vuorossa oleville.
3. **Käyttäjä** — vuorossa oleva jäsen; näkee tehtävät/vuorot/ilmoitukset/apukutsut; esteviikot, vuoronvaihdot, vuoron chat.

## Tehtäväkortit (ylläpitäjä)

- Oma selkeä osio: lisää / muokkaa / poista tehtäväkortteja.
- Vuodenajat: **kevät / kesä / syksy / talvi** (korvaa tai laajentaa vanhan talvi/sulankausi-jaon).
- Kortin luonnissa valitaan vuodenaika.
- Viikkovuoroon tehtävät:
  - käsin valiten, tai
  - automaattisesti vuodenajan mukaan.
- Toistuvuus kortilla: **kerran vuodessa / viikoittain / 2 vk / 3 vk / kuukausittain**.
  - Viikoittain → jokaiseen kyseisen kauden viikkovuoroon.
  - Harvemmat → kalenterilogiikka (ensimmäinen vapaa viikko kaudella / tasavälein).

## Poistot

- Ylläpitäjä voi tyhjentää ilmoitukset ja apukutsut (yksittäin + “poista kaikki”).
- **Aina vahvistus** ennen poistoa (mikään ei lähde vahingossa).

## Toteutusajatus (suositus)

### Tehtäväkirjasto
- Admin-sivu “Tehtävät” + vuodenaika-välilehdet.
- Kortti: otsikko, ohje, rasitus (kevyet/raskaat), vuodenaika, toistuvuus, aktiivinen/pois.
- Vanha kiinteä katalogi → lähtösiemen; admin muokkaa jatkossa.

### Viikkovuoro
- Vuoron vuodenaika lasketaan viikon maanantaista (kevät/kesä/syksy/talvi).
- “Täytä automaattisesti” / luonnissa: valitse kortit toistuvuuden + kauden + jo tehtyjen mukaan.
- “Muokkaa tehtäviä”: admin (ja tarvittaessa vastuuveli vain kuittaukset) valitsee/poistaa kortteja vuorolta.
- Kerran vuodessa: merkitään “suoritettu tänä vuonna” kun kuitattu done → ei tarjota uudelleen samana vuonna.

### Vastuuveli + Hub
- Hub-kortti voidaan liittää viikkovuoroon → vastuuveli voi merkitä.
- Apukutsu: admin + kyseisen julkaistun viikon vastuuveli.

### Turvalliset poistot
- Confirm-dialogi aina (yksittäinen + massapoisto).
- Massapoisto: kirjoita VAHVISTA tai kaksoisvahvistus.

## Vuoron chat (UI)

- Chat modernimmaksi: selkeämmät kuplat (oma / toinen), aikaleimat, pehmeämpi sheet, parempi input-rivi, kevyt animaatio avauksessa.
- Säilytä toiminnallisuus (vain vuorossa olevat, yksityinen viikkokeskustelu).

## Huomiot (päivitys)

- Lähetyksessä valinta (rasti / radiot): **Lähetä kaikille** tai **Lähetä vastuuveljille**.
  - “Vastuuveljille” = ylläpitäjät + kyseisen/julkaistun viikkovuoron vastuuveli (asiat jotka eivät vaadi kaikkia).
- Nappi vain **Lähetä** (ei “Lähetä kaikille”).
- Lähettäjälle heti palaute: **“Huomio lähetetty”**.
- Ylläpitäjä voi kuitata huomion vastaanotetuksi.
- Lähettäjälle näkyy kuittauksen jälkeen: **“Kiitos huomiostasi, veljet ovat vastaanottaneet sen”**.
