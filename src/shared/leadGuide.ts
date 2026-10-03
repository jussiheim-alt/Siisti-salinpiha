export type LeadGuideSection = {
  id: string
  title: string
  body: string
}

export type LeadGuide = {
  calloutTitle: string
  calloutBody: string
  guideTitle: string
  sections: LeadGuideSection[]
}

export const DEFAULT_LEAD_GUIDE: LeadGuide = {
  calloutTitle: 'Olet tämän viikkovuoron vastuuveli',
  calloutBody: 'Sinulla on viikon kokonaisvastuu. Katso ohjeet ennen töiden aloitusta.',
  guideTitle: 'Vastuuveljen ohjeet',
  sections: [
    {
      id: 'week',
      title: 'Viikon tilanne ja lisäapu',
      body:
        'Varmista että työt saadaan tehtyä viikon aikana. Seuraa tehtävälistaa ja sovi järjestelyt vuorokeskustelussa. Jos resurssit eivät riitä, pyydä lisäapua muilta — älä jätä kriittisiä töitä tekemättä.',
    },
    {
      id: 'tasks',
      title: 'Miten tehtävät merkitään tehdyksi',
      body:
        'Avaa Pihavuoro etusivulta tai Vuorot-välilehdeltä. Merkitse kukin tehtäväkortti tehdyksi, kun työ on valmis. Jos tehtävää ei tarvita tällä viikolla, merkitse se “ei tarvita” ja kirjoita lyhyt syy. Näin muut näkevät tilanteen ajan tasalla.',
    },
    {
      id: 'weather',
      title: 'Sääilmoitukset',
      body:
        'Sovellus näyttää etusivulla FMI:n sääennusteen ja tippejä (lumi, sade, liukkaus). Kun push-ilmoitukset ovat päällä, saat myös hälytyksiä säähän liittyvistä muutoksista. Pidä ilmoitukset päällä etusivun kytkimestä, jotta et missaa varoituksia.',
    },
    {
      id: 'extra',
      title: 'Apukutsu kun oma työvoima ei riitä',
      body:
        'Jos vuoron väki ei riitä (esim. runsas lumi), luo Apukutsut-sivulta uusi apukutsu. Kerro mitä tarvitaan ja vähintään ilmoittautuneiden määrä. Kun minimi täyttyy, tehtävä aktivoituu. Vastuuvelenä voit luoda apukutsun julkaistulle viikolle.',
    },
  ],
}

export function normalizeLeadGuide(raw: unknown): LeadGuide {
  const base = DEFAULT_LEAD_GUIDE
  if (!raw || typeof raw !== 'object') return structuredClone(base)
  const o = raw as Partial<LeadGuide>
  const sectionsIn = Array.isArray(o.sections) ? o.sections : []
  const sections =
    sectionsIn.length > 0
      ? sectionsIn
          .filter((s) => s && typeof s === 'object')
          .map((s, i) => ({
            id: String((s as LeadGuideSection).id || `s${i + 1}`),
            title: String((s as LeadGuideSection).title || '').trim() || `Kohta ${i + 1}`,
            body: String((s as LeadGuideSection).body || '').trim(),
          }))
          .filter((s) => s.body || s.title)
      : structuredClone(base.sections)
  return {
    calloutTitle: String(o.calloutTitle || '').trim() || base.calloutTitle,
    calloutBody: String(o.calloutBody || '').trim() || base.calloutBody,
    guideTitle: String(o.guideTitle || '').trim() || base.guideTitle,
    sections,
  }
}
