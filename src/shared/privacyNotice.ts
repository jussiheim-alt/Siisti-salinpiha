/** Bump when the notice text changes so users must re-acknowledge. */
export const PRIVACY_NOTICE_VERSION = '2026-10-04d'

export type PrivacySection = {
  id: string
  title: string
  body: string
}

export const PRIVACY_NOTICE_TITLE = 'Tietosuojaseloste'

export const PRIVACY_NOTICE_INTRO =
  'Siisti salin piha -sovellus käsittelee henkilötietoja pihavuorojen järjestämiseksi. Lue tämä lyhyt seloste ennen käytön jatkamista.'

export const PRIVACY_NOTICE_SECTIONS: PrivacySection[] = [
  {
    id: 'rekisteri',
    title: '1. Rekisterinpitäjä',
    body: 'Rekisterinpitäjä on Siisti salin piha -sovelluksen ylläpitäjät, joita ovat Vääksyn seurakunnan huolto- ja siivouskoordinaattori ja apulainen. Yhteydenotot tietoturva-asioissa: Jussi Heimonen.',
  },
  {
    id: 'tarkoitus',
    title: '2. Mihin tietoja käytetään',
    body: 'Tietoja käytetään pihavuorojen suunnitteluun ja julkaisuun, tehtävien kuittaukseen, käytettävyysesteiden kirjaamiseen, apukutsuihin, huomioihin (vikailmoituksiin), vuorokeskusteluun sekä lukitusnäytön ilmoituksiin. Käsittelyn peruste on vuorojen järjestäminen yhteisön jäsenille (oikeutettu etu / jäsenyyteen liittyvä tarve).',
  },
  {
    id: 'tiedot',
    title: '3. Mitä tietoja kerätään',
    body: 'Nimi, sähköposti ja salasana (salasanasta tallennetaan vain suojattu tiiviste). Lisäksi vuoroihin liittyvät tiedot (kokoonpano, vastuuveli/avustaja), käytettävyysrajoitukset (esim. ei raskaisiin töihin), esteviikot, huomiotekstit ja mahdolliset valokuvat, chat-viestit (vain kyseisen viikon vuorolaisille; poistuvat viikon päätyttyä), apukutsuihin ilmoittautumiset sekä push-ilmoitusten laitetiedot (jos ilmoitukset otetaan käyttöön).',
  },
  {
    id: 'nakyvyys',
    title: '4. Kenelle tiedot näkyvät',
    body: 'Kirjautuneet jäsenet näkevät julkaistujen vuorojen kokoonpanon nimet ja roolit sekä apukutsujen ilmoittautujat. Vastuuveli näkee vuoronsa kokoonpanossa merkinnän “ei raskaisiin töihin”. Chat-viestit näkyvät vain kyseisen viikon vuorolaisille ja poistuvat automaattisesti viikon päätyttyä. Huomiot voivat olla kaikille tai vain vastuuveljille/ylläpidolle. Sähköpostiosoitteet ja täydet rajoitemerkinnät näkyvät pääosin vain ylläpitäjille.',
  },
  {
    id: 'vastaanottajat',
    title: '5. Palveluntarjoajat',
    body: 'Sovellus ja tietokanta isännöidään Render-palvelussa (EU). Säätilatietoja haetaan Ilmatieteen laitokselta paikan perusteella (ei käyttäjäkohtainen sijainti). Push-ilmoitukset kulkevat laitteen valmistajan ilmoituspalvelun kautta. Kirjasimia voidaan ladata Google Fonts -palvelusta. Google-kalenteriin lisäys avaa Googlen sivun käyttäjän omalla toimella.',
  },
  {
    id: 'sailytys',
    title: '6. Säilytysaika',
    body: 'Tilitietoja säilytetään jäsenyyden ajan. Vanhat esteviikot poistuvat automaattisesti listalta. Chat-viestit poistuvat automaattisesti, kun viikko on ohi. Vuoro- ja huomiotietoja säilytetään niin kauan kuin ne tarvitaan vuorojen seurantaan, ellei ylläpito poista niitä. Ylläpitäjä voi poistaa käyttäjän; varmuuskopiot voivat sisältää tietoja kunnes ne korvautuvat.',
  },
  {
    id: 'oikeudet',
    title: '7. Oikeutesi',
    body: 'Sinulla on oikeus pyytää pääsyä tietoihisi, niiden oikaisua tai poistoa sekä vastustaa käsittelyä siltä osin kuin se perustuu oikeutettuun etuun. Voit myös tehdä valituksen tietosuojavaltuutetulle (tietosuoja.fi).',
  },
  {
    id: 'ilmoitukset',
    title: '8. Ilmoitukset ja kuvat',
    body: 'Lukitusnäytön ilmoitukset ovat vapaaehtoisia; lupa kysytään laitteen asetuksilla. Ilmoituksissa voi näkyä nimiä tai viestin otteita. Huomioihin liitettävät kuvat tallentuvat palvelimelle — älä lähetä tarpeettomia henkilötietoja kuviin.',
  },
]

export function privacyAcceptedCurrent(
  acceptedVersion: string | null | undefined,
  currentVersion = PRIVACY_NOTICE_VERSION,
) {
  return Boolean(acceptedVersion && acceptedVersion === currentVersion)
}
