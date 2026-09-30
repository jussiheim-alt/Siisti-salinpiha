/** Hub-huolto — vuositarkastukset (lähde: Hub-ohjeet, Asikkala Vääksy). */

export type HubCadence = 'yearly' | 'every_1_2_years'

export type HubItemTemplate = {
  id: string
  label: string
}

export type HubInspectionTemplate = {
  id: string
  code: string
  title: string
  cadence: HubCadence
  cadenceLabel: string
  /** Typical open window month-day (inclusive), Helsinki calendar */
  windowStartMd: string
  windowEndMd: string
  intro?: string
  items: HubItemTemplate[]
  sortOrder: number
}

export const HUB_CATALOG: HubInspectionTemplate[] = [
  {
    id: 'hub-storage',
    code: 'VARASTOT',
    title: 'Ulko- ja sisävarasto',
    cadence: 'yearly',
    cadenceLabel: 'Kerran vuodessa',
    windowStartMd: '04-01',
    windowEndMd: '10-31',
    items: [
      { id: 'out-insects', label: 'Ulkovarasto: tarkista hyönteispesät ja poista sopivana aikana' },
      { id: 'out-order', label: 'Ulkovarasto: järjestys kunnossa, poista tarpeeton' },
      { id: 'out-chemicals', label: 'Ulkovarasto: ei vanhoja maaleja/kemikaaleja turhaan' },
      { id: 'out-light', label: 'Ulkovarasto: valo toimii' },
      { id: 'out-tools', label: 'Ulkovarasto: ulkovälineiden kunto' },
      { id: 'in-order', label: 'Sisävarasto: järjestys kunnossa, poista tarpeeton' },
      { id: 'in-chemicals', label: 'Sisävarasto: ei vanhoja maaleja/kemikaaleja turhaan' },
      {
        id: 'in-electrical',
        label: 'Sähkökaappi/tekniset tilat: ei palavaa materiaalia eikä kaasulaitteita',
      },
    ],
    sortOrder: 10,
  },
  {
    id: 'hub-paving',
    code: 'KIVEYS',
    title: 'Pihakiveys',
    cadence: 'yearly',
    cadenceLabel: 'Kerran vuodessa',
    windowStartMd: '04-01',
    windowEndMd: '10-31',
    items: [
      { id: 'oil', label: 'Tarkista ja poista öljyläikät (rasvanpoistoaine)' },
      {
        id: 'weeds',
        label: 'Poista rikkaruohot ja sammal saumoista (käsin, kaavin, teräsharja; pH 7–10 pesuaine)',
      },
      { id: 'loose', label: 'Tarkista irtonaiset kivet; lisää saumahiekkaa tarvittaessa' },
      { id: 'curbs', label: 'Kanttikivet paikallaan ja ehjiä; ei irtoamista kiveyksestä' },
      {
        id: 'slope',
        label: 'Ei vajoamia; pinta viettää pois rakennuksesta, vesi ei seiso seinää vasten',
      },
    ],
    sortOrder: 20,
  },
  {
    id: 'hub-asphalt',
    code: 'ASFALTTI',
    title: 'Asfaltti ja kulkuväylät',
    cadence: 'yearly',
    cadenceLabel: 'Kerran vuodessa',
    windowStartMd: '04-01',
    windowEndMd: '10-07',
    items: [
      { id: 'gaps', label: 'Poista kasvillisuus asfaltin raoista' },
      { id: 'edge-trash', label: 'Poista kasvillisuus ja roskat asfaltin ja reunakivien välistä' },
      { id: 'erosion', label: 'Tarkista kulkuväylien reunojen eroosio' },
      { id: 'sink', label: 'Tarkista vajoamat / epätasaisuudet ja niiden syy' },
      { id: 'oil', label: 'Poista öljyläikät (esim. tiskiaine)' },
      { id: 'water', label: 'Tarkista seisova vesi asfaltilla' },
      { id: 'stairs', label: 'Tarkista maastoportaat ja kaiteet' },
    ],
    sortOrder: 30,
  },
  {
    id: 'hub-green',
    code: '06',
    title: 'Viheralueet ja kasvillisuus',
    cadence: 'yearly',
    cadenceLabel: 'Kerran vuodessa',
    windowStartMd: '05-01',
    windowEndMd: '10-31',
    items: [
      { id: 'foundation', label: 'Rakennuksen vierusta vapaa kasvillisuudesta' },
      { id: 'slope', label: 'Sokkelin vierustat ohjaavat sadeveden pois rakennuksesta' },
      { id: 'gravel', label: 'Sora-alueilla ei kasva kasvillisuutta' },
      {
        id: 'tidy',
        label: 'Kasvillisuus siisti; vuosikasvu leikataan lehdellisenä, muotoilu lehdettömässä ajassa',
      },
    ],
    sortOrder: 40,
  },
  {
    id: 'hub-stormwater',
    code: '41',
    title: 'Hulevesijärjestelmä',
    cadence: 'every_1_2_years',
    cadenceLabel: '1–2 vuoden välein',
    windowStartMd: '05-01',
    windowEndMd: '10-27',
    intro:
      'Hulevesi on maan pinnalta, katoilta ym. pois johdettavaa sade- tai sulamisvettä, joka käsitellään tontilla tai johdetaan pois kiinteistöltä.',
    items: [
      {
        id: 'drain-wells',
        label:
          'Salaojakaivot (2 kpl): vedenpinta ei ylitä putkien alapintaa; ei roskia; sakkapesät tyhjät',
      },
      {
        id: 'system',
        label: 'Hulevesijärjestelmän toimivuus (perusvesikaivo, padotusventtiili, sauna- ja sadevesikaivot)',
      },
    ],
    sortOrder: 50,
  },
]

export const HUB_ISSUE_PROTOCOL = [
  'Kirjaa havainnot huomautuksiin. Lisää kuva liitteisiin, jos siitä on apua.',
  'Kerro huoltokoordinaattorille / valtakunnansalikomitean koordinaattorille.',
  'Jos mahdollista, tee korjaukset saatujen ohjeiden mukaan.',
  'Kirjaa tehdyt korjaukset huomautuksiin.',
]
