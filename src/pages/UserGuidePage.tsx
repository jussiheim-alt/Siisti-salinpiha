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
      'Kytke ilmoitukset päälle etusivulta, jotta lukitusnäyttö saa viestit. Apukutsut tulevat kaikille; muut push-ilmoitukset (sää, huomiot, chat) vain vuorossa oleville. Sovelluksen Ilmo-listassa viestit voivat näkyä laajemmalle. Chat-viestit näkyvät chat-kuvakkeen punaisessa numerossa (eivät Ilmo-listassa). iPhonella sovellus pitää olla kotivalikossa.',
      'Pikavalinnoista pääset käytettävyyteen, apukutsuihin ja huomioihin.',
    ],
    to: '/',
    linkLabel: 'Avaa etusivu',
  },
  {
    id: 'vuorot',
    title: 'Vuorot ja Pihavuoro',
    body: [
      'Vuorot-välilehdellä näet julkaistut viikot. Avaa oma viikkosi nähdäksesi kokoonpanon ja tehtävät.',
      'Viikon tehtävät ovat koko vuoron yhteisiä, mutta vain vastuuveli kuittaa ne tehdyiksi. Jos olet vastuuveli, näet etusivulla ohjeet.',
      'Vuorokeskustelu aukeaa oikean alan chat-painikkeesta, kun olet viikon kokoonpanossa. Lukemattomat viestit näkyvät punaisella numerolla kuvakkeessa; lukitusnäytölle tulee push, jos ilmoitukset on kytketty päälle.',
    ],
    to: '/kalenteri',
    linkLabel: 'Avaa vuorot',
  },
  {
    id: 'kaytettavyys',
    title: 'Käytettävyys',
    body: [
      'Merkitse viikot, joilla et ole käytettävissä pihavuoroon.',
      'Lista näyttää aina seuraavat viikot eteenpäin: joka maanantai vanhin viikko poistuu ja uusi tulee listan loppuun.',
      'Pidä esteviikot ajan tasalla — suositus ohittaa ne vuorojen suunnittelussa.',
    ],
    to: '/kaytettavyys',
    linkLabel: 'Muokkaa käytettävyyttä',
  },
  {
    id: 'apu',
    title: 'Apukutsut',
    body: [
      'Jos vuorossa olevat ystävät tarvitsevat lisätyövoimaa pihatöihin, he voivat lähettää apukutsun Apu-välilehdelle.',
      'Voit ilmoittautua mukaan hyvään työhön auttamaan heitä, vaikka et itse olisi vuorossa silloin. Apuasi arvostetaan suuresti!',
      'Kun ilmoittautuneita on tarpeeksi (minimi), tehtävä aktivoituu. Uuden kutsun luo vastuuveli tai ylläpitäjä tarvittaessa.',
    ],
    to: '/apukutsut',
    linkLabel: 'Avaa apukutsut',
  },
  {
    id: 'ilmo',
    title: 'Ilmoitukset',
    body: [
      'Ilmo-välilehdellä näet sää-, apukutsu- ja muut ilmoitukset.',
      'Sääilmoituksia lähetetään klo 8–18 Suomen aikaa, ja lukitusnäytölle ne menevät vain viikon vuorolaisille. Apukutsujen push tulee kaikille.',
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
