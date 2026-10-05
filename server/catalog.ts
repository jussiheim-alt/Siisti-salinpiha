export type Season = 'talvi' | 'sulankausi' | 'all'
export type Cadence = 'every_week' | 'as_needed'
export type DefaultAssignee = 'lead' | 'helpers' | 'all'
export type Effort = 'light' | 'heavy'

export type TaskTemplate = {
  id: string
  title: string
  instructions: string
  season: Season
  cadence: Cadence
  defaultAssignee: DefaultAssignee
  effort: Effort
  sortOrder: number
}

export const TASK_CATALOG_V1: TaskTemplate[] = [
  {
    id: 'T1',
    title: 'Lumityöt',
    instructions:
      'Tee heti kun mahdollista, ettei lumi tamppaannu. Kokouspäivinä ennen kuin väkeä alkaa tulla. Erityisesti portaat parkki↔sali. Runsaalla lumella priorisoi kulkuväylät.',
    season: 'talvi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'heavy',
    sortOrder: 10,
  },
  {
    id: 'T2',
    title: 'Pieni lumi (1–2 cm): harjaus',
    instructions:
      'Parkkia ei välttämättä tarvitse kolata. Harjaa aina portaat, salin edustan kiveys ja varauloskäynnin kulkuväylä.',
    season: 'talvi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 20,
  },
  {
    id: 'T3',
    title: 'Hiekoitus / liukkaudentorjunta',
    instructions:
      'Jos kulkuväylät tai parkki on liukas, hiekoita hyvissä ajoin ennen kokouksia ja kenttäkokouksia.',
    season: 'talvi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 30,
  },
  {
    id: 'T4',
    title: 'Välineet: nouto ja palautus',
    instructions:
      'Kolat, lapiot ja harjat ovat varauloskäynnin viereisessä ulkovarastossa. Puhdista lumesta ennen palautusta, ettei sulamisvesi vahingoita varastoa.',
    season: 'talvi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 40,
  },
  {
    id: 'K1',
    title: 'Siimaleikkuri: parkki- ja ojien reunat',
    instructions:
      'Siisti parkkialueen ja ojien reunat. Käytä suojaimia. Varo autoja, ihmisiä ja rakenteita.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'heavy',
    sortOrder: 110,
  },
  {
    id: 'K2',
    title: 'Lehtipuhallin: kulkuväylät',
    instructions:
      'Pidä kulkuväylät vapaina lehdistä ja neulasista. Älä puhalla kohti ihmisiä, autoja tai avoimia ovia/ikkunoita.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 120,
  },
  {
    id: 'K3',
    title: 'Kiveyksen rikkakasvit ja sammal',
    instructions:
      'Poista rikkakasvit ja sammal kiveyksen saumoista ja pinnalta (käsin, kaavin, teräsharja). Epävarmoissa torjunta-/pesuaineissa kysy huolto-ohjaajalta.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 130,
  },
  {
    id: 'K4',
    title: 'Asfaltin saumat ja reunat',
    instructions:
      'Poista kasvillisuus ja roskat asfaltin saumoista sekä asfaltin ja reunakivien välistä (esim. petkel).',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 140,
  },
  {
    id: 'K5',
    title: 'Öljyläikät',
    instructions: 'Tarkista ja puhdista öljyläikät rasvanpoistoaineella tai astianpesuaineella.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 150,
  },
  {
    id: 'K6',
    title: 'Yleissiisteys',
    instructions: 'Pidä parkki, sisäänkäynti ja kiveys siistinä. Kerää irtoroskat.',
    season: 'sulankausi',
    cadence: 'every_week',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 160,
  },
  {
    id: 'K7',
    title: 'Silmäys: kivet, reunat, vesi',
    instructions:
      'Tarkista irtonaiset kivet, reunakivet, vajoamat ja seisova vesi. Kirjaa huomio tarvittaessa.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 170,
  },
  {
    id: 'K8',
    title: 'Maastoportaat ja kaiteet',
    instructions: 'Tarkista ulkoportaiden ja kaiteiden kunto. Ilmoita puutteista.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 180,
  },
  {
    id: 'K9',
    title: 'Ulkovarasto: välineet',
    instructions:
      'Varmista että siimaleikkuri, lehtipuhallin ja muut välineet ovat paikoillaan ja kunnossa. Ei turhia kemikaaleja.',
    season: 'sulankausi',
    cadence: 'as_needed',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 190,
  },
  {
    id: 'K10',
    title: 'Viikon kuittaus',
    instructions: 'Merkitse viikon tilanne: tehty / ei tarvetta / huomautus auki.',
    season: 'sulankausi',
    cadence: 'every_week',
    defaultAssignee: 'all',
    effort: 'light',
    sortOrder: 200,
  },
]

export const CONSTRAINT_LABELS: Record<string, string> = {
  no_heavy: 'Ei raskaisiin töihin',
  no_lead: 'Ei vastuuhenkilöksi',
}
