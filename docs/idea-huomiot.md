# Siisti piha — idea: huomiot (ilmoitukset + kuva)

**Status:** suunniteltu · **Ehdotus prioriteetti:** vahva MVP-kandidaatti (tai heti MVP:n jälkeen)  
**Lähde:** käyttäjäidea 2026-09-27

## Idea

Käyttäjä voi lähettää **huomion** kaikille:
- teksti (esim. “lumikola rikki”)
- valinnainen **valokuva**
- näkyy kaikille käyttäjille
- **ylläpitäjät voivat vastata** (keskusteluketju / tilapäivitys)

Esimerkki: rikkinäinen väline, liukas kohta, oksa tiellä, öljyläikkä.

Sopii Hub-ohjeiden malliin: huomautus + liite → ilmoitus koordinaattoreille → toimenpiteet.

## Käyttövirta

1. Kuka tahansa kirjautunut → “Uusi huomio” → teksti + kuva (kamera/galleria)
2. Huomio julkaistaan **kaikille** (feed / lista)
3. Ylläpitäjä vastaa (“tilattu uusi kola”, “korjattu”) ja voi asettaa tilan
4. Ilmoituksen tekijä (ja muut) näkevät vastauksen

## Tietomalli (luonnos)

- **Notice** — id, authorUserId, body, photoUrl?, status (`open` | `in_progress` | `resolved`), createdAt, resolvedAt?
- **NoticeReply** — id, noticeId, authorUserId, body, createdAt  
  *(vastausoikeus: admin; vaihtoehto: myös member voi kommentoida — päätettävä)*

## Näytöt

- Huomiot-lista (uusin ensin; avoimet korostettuina)
- Huomio-detail: kuva, viesti, vastaukset, tila
- Badge / etusivun “avoimet huomiot”

## Oikeudet

| Toiminto | Member | Admin |
|----------|--------|-------|
| Luo huomio + kuva | x | x |
| Näkee kaikki huomiot | x | x |
| Vastaa | — / ? | x |
| Muuta tilaa (avoin → hoidossa → ratkaistu) | — | x |
| Poista sopimaton | — | x |

## MVP vs myöhemmin

| | Suositus MVP | Myöhemmin |
|--|--------------|-----------|
| Teksti + 1 kuva + lista kaikille | x | |
| Admin-vastaus + tila | x | |
| Push / sähköposti uudesta huomiosta | | x |
| Useita kuvia / video | | x |
| Linkitys Pihavuoro-tehtävään | | x |
| Karttapiste | | x |

Kevyempi kuin säähälytykset: ei ulkoista API:a, vain tallennus + oikeudet. Hyöty heti arjessa.

## Avoimet päätökset

1. Voivatko tavalliset käyttäjät myös kommentoida, vai vain admin vastaa?
2. Näkyykö huomio **heti kaikille**, vai admin hyväksyy ensin? (ehdotus: heti kaikille, trust-ryhmä ~20)
3. Pakollinen kuva vai vapaaehtoinen?
