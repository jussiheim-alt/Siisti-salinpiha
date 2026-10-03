import { Link } from 'react-router-dom'
import { InstallTips } from '../components/InstallTips'

const SECTIONS: { id: string; title: string; body: string[]; to?: string; linkLabel?: string }[] = [
  {
    id: 'alku',
    title: 'Miten pääsen alkuun?',
    body: [
      'Saat ylläpitäjältä kutsulinkin (tekstiviesti, WhatsApp tai sähköposti). Avaa linkki puhelimen selaimessa.',
      'Valitse salasana (vähintään 8 merkkiä), vahvista se ja napauta “Luo tili ja kirjaudu”.',
      'Kirjautumisen jälkeen alapalkista löydät Etusivun, Vuorot, Apu, Ilmo, Huomiot ja Ulos.',
    ],
  },
  {
    id: 'asennus',
    title: 'Lisää kotivalikkoon (iPhone / Android)',
    body: [
      'Kun tili on luotu, lisää sovellus kotivalikkoon — se aukeaa sitten kuin normaali app.',
      'iPhone: Safari → Jaa → Lisää Koti-valikkoon.',
      'Android: Chrome → ⋮ → Asenna sovellus / Lisää aloitusnäytölle.',
    ],
  },
  {
    id: 'etusivu',
    title: 'Etusivu',
    body: [
      'Etusivulla näet seuraavan Pihavuorosi, sään ja ilmoitukset.',
      'Kytke ilmoitukset päälle etusivulta, jotta chat-viestit ja apukutsut näkyvät lukitusnäytöllä. iPhonella sovellus pitää olla lisättynä kotivalikkoon — testaa painikkeella „Testaa lukitusnäyttö”.',
      'Pikavalinnoista pääset käytettävyyteen, vuoronvaihtoihin, apukutsuihin ja huomioihin.',
    ],
    to: '/',
    linkLabel: 'Avaa etusivu',
  },
  {
    id: 'vuorot',
    title: 'Vuorot ja Pihavuoro',
    body: [
      'Vuorot-välilehdellä näet julkaistut viikot. Avaa oma viikkosi nähdäksesi kokoonpanon ja tehtävät.',
      'Kuittaa tehtäviä valmiiksi viikon aikana. Jos olet vastuuveli, näet etusivulla ohjeet ja vastaat viikon töistä.',
      'Vuorokeskustelu aukeaa oikean alan chat-painikkeesta, kun olet viikon kokoonpanossa. Uusi viesti lähettää ilmoituksen muille vuorossa oleville.',
    ],
    to: '/kalenteri',
    linkLabel: 'Avaa vuorot',
  },
  {
    id: 'kaytettavyys',
    title: 'Käytettävyys',
    body: [
      'Merkitse viikot, joilla et ole käytettävissä pihavuoroon.',
      'Estetyt viikot auttavat vuorojen suunnittelussa — merkitse ne ajoissa.',
    ],
    to: '/kaytettavyys',
    linkLabel: 'Muokkaa käytettävyyttä',
  },
  {
    id: 'vaihdot',
    title: 'Vuoronvaihdot',
    body: [
      'Jos et pääse omaan vuoroosi, voit tarjota paikkaasi vaihtoon Pihavuoro-sivulta.',
      'Vuoronvaihdot-sivulla näet tarjolla olevat vaihdot ja omat avoimet tarjouksesi.',
    ],
    to: '/vaihdot',
    linkLabel: 'Avaa vuoronvaihdot',
  },
  {
    id: 'apu',
    title: 'Apukutsut',
    body: [
      'Kun tarvitaan lisäkäsiä (esim. runsas lumi), avaa Apu-välilehti.',
      'Ilmoittaudu avoimeen kutsuun. Kun minimi täyttyy, tehtävä aktivoituu.',
      'Vastuuveli tai ylläpitäjä voi luoda uuden apukutsun tarvittaessa.',
    ],
    to: '/apukutsut',
    linkLabel: 'Avaa apukutsut',
  },
  {
    id: 'ilmo',
    title: 'Ilmoitukset',
    body: [
      'Ilmo-välilehdellä näet sää-, apukutsu- ja muut ilmoitukset.',
      'Avaa ilmoitus siirtyäksesi suoraan liittyvään näkymään. Merkitse luetuiksi tarvittaessa.',
    ],
    to: '/ilmoitukset',
    linkLabel: 'Avaa ilmoitukset',
  },
  {
    id: 'huomiot',
    title: 'Huomiot',
    body: [
      'Ilmoita viat ja havainnot Huomiot-välilehdellä. Voit liittää valokuvan.',
      'Valitse kenelle huomio menee: kaikille tai vastuuveljille.',
      'Voit vastata omiin huomioihin ja seurata, milloin asia on ratkaistu.',
    ],
    to: '/huomiot',
    linkLabel: 'Avaa huomiot',
  },
  {
    id: 'vastuu',
    title: 'Kun olet vastuuveli',
    body: [
      'Vastuuveli ei ole erillinen tili — se on viikkokohtainen tehtävä julkaistussa vuorossa.',
      'Etusivulla näkyy vastuuveljen ohje. Luot tarvittaessa apukutsun ja huolehdit, että viikon tehtävät tulevat tehdyiksi.',
      'Jos ylläpitäjä aktivoi huoltokortin, näet sen Pihavuorossa ja voit merkitä tarkastuskohdat tehdyiksi.',
    ],
  },
]

export function UserGuidePage() {
  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Käyttöohje</h1>
        <p className="lede">
          Lyhyt opas jäsenelle — näin käytät sovellusta puhelimella ensimmäisestä kirjautumisesta lähtien.
        </p>
      </header>

      <section className="panel guide-intro">
        <p>
          Aloita alapalkista. Käy kohdat läpi järjestyksessä — jokainen osio kertoo yhden ominaisuuden.
        </p>
      </section>

      <div className="guide-list">
        {SECTIONS.map((s, index) => (
          <details key={s.id} className="guide-item" open={index < 2} id={s.id}>
            <summary>
              <span className="guide-step">{index + 1}</span>
              <span>{s.title}</span>
            </summary>
            <div className="guide-body">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.id === 'asennus' && <InstallTips compact />}
              {s.to && (
                <Link className="btn ghost small" to={s.to}>
                  {s.linkLabel || 'Avaa'}
                </Link>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
