# Siisti piha — idea: ylimääräiset tehtävät (apukutsut)

**Status:** suunniteltu · **Ehdotus prioriteetti:** vaihe 2 (tai MVP+, heti huomioiden jälkeen)  
**Lähde:** käyttäjäidea 2026-09-27

## Idea

Yllättävään tarpeeseen (esim. “Tarvitaan apuvoimaa lumitöihin”) voi luoda **ylimääräisen tehtävän**:
- ilmoitus **kaikille** käyttäjille
- kuka tahansa voi **ilmoittautua**
- perustaja asettaa **vähimmäismäärän** ilmoittautuneita
- kun minimi täyttyy → tehtävä **aktivoituu** ja sen voi aloittaa
- ennen aktivointia: näkyy kuka on ilmoittautunut ja paljonko vielä tarvitaan

Sopii WhatsApp-käytäntöön: vastuuveli pyytää lisäapua ryhmästä.

## Kuka voi luoda

| Rooli | Oikeus |
|-------|--------|
| Ylläpitäjä | aina |
| Viikon **vastuuhenkilö** (lead) | vain oman **julkaistun** Pihavuoro-viikkonsa aikana |
| Avustaja / muu member | ei |

## Tilakone

```
draft? → open (kerää ilmoittautumisia)
      → ready (ilmoittautuneita ≥ minRequired)  ← “aktivoituu”
      → in_progress (aloitettu)
      → done | cancelled
```

UI ennen readyä:
- “Ilmoittautuneet: Maija”
- “Tarvitaan vielä 1 (vähintään 2)”

Kun ready: “Tehtävä valmis aloitettavaksi” — perustaja (tai lead) painaa **Aloita**.

## Tietomalli (luonnos)

- **ExtraTask** — id, createdByUserId, title, description?, photoUrl?, minRequired (int ≥ 1), status, relatedPihavuoroId?, startsAt?, createdAt
- **ExtraTaskSignup** — extraTaskId, userId, signedUpAt  
  *(uniikki per user/task)*

Säännöt:
- signup vain status `open` | `ready` (ei `in_progress`/`done` ellei erikseen sallita myöhäisiä)
- kun signup-määrä ≥ minRequired → status `ready` (automaattisesti)
- jos joku peruu ja määrä < min → palaa `open` (jos ei vielä `in_progress`)
- `in_progress` → kuittaus kuten tavallinen tehtävä (tai “merkitse valmiiksi” perustajalle)

## Ilmoitukset

1. Uusi ylimääräinen tehtävä → **kaikki käyttäjät**
2. Minimi täyttyi → ilmoitus perustajalle (+ ilmoittautuneille)
3. Tehtävä aloitettu / valmis → ilmoittautuneet

(Kanava: sovelluksen sisäiset; push myöhemmin.)

## Suhde muihin ominaisuuksiin

| | Pihavuoro-tehtävä | Huomio | Ylimääräinen tehtävä |
|--|-------------------|--------|----------------------|
| Kenelle | vuorossa olevat | kaikille info | kaikille, vapaaehtoinen |
| Ilmoittautuminen | ei | ei | kyllä + minimi |
| Esim. | T1 lumityöt viikolla | “kola rikki” | “tarvitaan 2 apua lumitöihin nyt” |

Huomio ≠ tehtävä: huomio on info/vikailmoitus; ylimääräinen tehtävä rekrytoi tekijöitä.

## MVP vs myöhemmin

| | Vaihe 2 | Myöhemmin |
|--|---------|-----------|
| Luo (admin / viikon lead) + minimi + signup + aktivointi | x | |
| Ilmoitus kaikille (in-app) | x | |
| Aloita / valmis | x | |
| Push | | x |
| Automaattinen luonti säästä (“lunta tulossa → kutsu”) | | x |
| Sijainti / deadline | | x |

## Avoimet päätökset

1. Voiko ilmoittautumisen perua? (ehdotus: kyllä, kunnes `in_progress`)
2. Kuka painaa “Aloita” — vain perustaja vai kuka tahansa ilmoittautunut?
3. Näkyykö tehtävä myös kalenterissa / linkittyykö viikon Pihavuoroon?
4. Yläraja ilmoittautumisille vai vain minimi?
