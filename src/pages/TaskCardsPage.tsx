import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api, type TaskCard } from '../api'
import { useAuth } from '../auth'
import {
  CADENCE_LABELS,
  SEASON_LABELS,
  SEASON_ORDER,
  type SeasonKey,
  type TaskCadence,
} from '../shared/seasons'

type CardForm = {
  title: string
  instructions: string
  effort: 'light' | 'heavy'
  season: SeasonKey
  cadence: TaskCadence
  defaultAssignee: 'lead' | 'helpers' | 'all'
}

const emptyForm: CardForm = {
  title: '',
  instructions: '',
  effort: 'light',
  season: 'kevat',
  cadence: 'weekly',
  defaultAssignee: 'helpers',
}

function formFromCard(card: TaskCard): CardForm {
  return {
    title: card.title,
    instructions: card.instructions,
    effort: card.effort,
    season: card.season,
    cadence: card.cadence,
    defaultAssignee: card.defaultAssignee,
  }
}

function AssigneeFields({
  value,
  onChange,
}: {
  value: 'lead' | 'helpers' | 'all'
  onChange: (v: 'lead' | 'helpers' | 'all') => void
}) {
  return (
    <label>
      Oletusjako
      <select value={value} onChange={(e) => onChange(e.target.value as 'lead' | 'helpers' | 'all')}>
        <option value="lead">Vastuuveli</option>
        <option value="helpers">Avustajat</option>
        <option value="all">Kaikki vuorossa</option>
      </select>
    </label>
  )
}

export function TaskCardsPage() {
  const { user } = useAuth()
  const [cards, setCards] = useState<TaskCard[]>([])
  const [seasonTab, setSeasonTab] = useState<SeasonKey>('kevat')
  const [form, setForm] = useState(emptyForm)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [editing, setEditing] = useState<TaskCard | null>(null)
  const formPanelRef = useRef<HTMLElement | null>(null)

  async function load() {
    const data = await api<{ cards: TaskCard[] }>('/api/task-cards')
    setCards(data.cards || [])
  }

  useEffect(() => {
    if (user?.role !== 'admin') return
    load().catch((e) => setError(e.message))
  }, [user?.role])

  const counts = useMemo(() => {
    const map: Record<SeasonKey, number> = { kevat: 0, kesa: 0, syksy: 0, talvi: 0 }
    for (const c of cards) {
      if (map[c.season] != null) map[c.season] += 1
    }
    return map
  }, [cards])

  const filtered = useMemo(
    () =>
      cards
        .filter((c) => c.season === seasonTab)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'fi')),
    [cards, seasonTab],
  )

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  function releaseFocus() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  function resetCreateForm(season: SeasonKey = seasonTab) {
    setForm({ ...emptyForm, season })
    setCopying(false)
  }

  function startCopy(card: TaskCard) {
    setEditing(null)
    setError('')
    setCopying(true)
    setForm(formFromCard(card))
    setSeasonTab(card.season)
    setInfo(
      'Kopio valmis muokattavaksi. Vaihda tarvittaessa vuodenaikaa tai toistuvuutta ja tallenna — otsikkoa ja ohjetta ei tarvitse kirjoittaa uudelleen.',
    )
    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const main = document.querySelector('.app-main')
      if (main instanceof HTMLElement && formPanelRef.current) {
        const top = formPanelRef.current.offsetTop - 12
        main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
    })
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const wasCopy = copying
    setError('')
    setInfo('')
    try {
      await api('/api/task-cards', {
        method: 'POST',
        json: { ...form, season: form.season || seasonTab },
      })
      const savedSeason = form.season || seasonTab
      setSeasonTab(savedSeason)
      resetCreateForm(savedSeason)
      setInfo(wasCopy ? 'Kopio tallennettu uutena korttina.' : 'Tehtäväkortti lisätty.')
      await load()
      releaseFocus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError('')
    try {
      await api(`/api/task-cards/${editing.id}`, {
        method: 'PATCH',
        json: {
          title: editing.title,
          instructions: editing.instructions,
          effort: editing.effort,
          season: editing.season,
          cadence: editing.cadence,
          defaultAssignee: editing.defaultAssignee,
          active: editing.active,
        },
      })
      setSeasonTab(editing.season)
      setEditing(null)
      setInfo('Kortti päivitetty.')
      await load()
      releaseFocus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    }
  }

  async function remove(card: TaskCard) {
    const ok = window.confirm(
      `Poistetaanko tehtäväkortti “${card.title}”? Tätä ei voi perua.`,
    )
    if (!ok) return
    const ok2 = window.confirm('Vahvista poisto vielä kerran.')
    if (!ok2) return
    setError('')
    try {
      await api(`/api/task-cards/${card.id}`, { method: 'DELETE' })
      setInfo('Kortti poistettu.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Tehtävät</h1>
        <p className="lede">
          Vuodenajan tehtäväkortit — pohja viikkovuorojen huoltotehtäville. Yhteensä {cards.length}{' '}
          korttia. Voit kopioida kortin toiseen vuodenaikaan ilman uudelleenkirjoitusta.
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="hint">{info}</p>}

      <div className="season-tabs" role="tablist" aria-label="Vuodenajat">
        {SEASON_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={seasonTab === s}
            className={`season-tab${seasonTab === s ? ' active' : ''}`}
            onClick={() => {
              setSeasonTab(s)
              if (!copying) setForm((f) => ({ ...f, season: s }))
              setEditing(null)
            }}
          >
            {SEASON_LABELS[s]}
            <span className="season-tab-count">{counts[s]}</span>
          </button>
        ))}
      </div>

      <p className="muted season-tab-hint">
        Näytetään {SEASON_LABELS[seasonTab].toLowerCase()}kortit ({filtered.length}). Vaihda
        vuodenaikaa nähdäksesi loput.
      </p>

      <section className="panel" ref={formPanelRef}>
        <h2>
          {copying ? 'Kopioi kortti' : 'Uusi kortti'} · {SEASON_LABELS[form.season]}
        </h2>
        {copying && (
          <p className="hint" style={{ marginTop: '-0.35rem' }}>
            Kentät on täytetty lähdekortista. Muuta vuodenaikaa, toistuvuutta tai tekstejä ja
            tallenna — syntyy uusi kortti, alkuperäinen säilyy.
          </p>
        )}
        <form className="stack" onSubmit={(e) => void onCreate(e)}>
          <label>
            Otsikko
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Ohje
            <textarea
              required
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            />
          </label>
          <label>
            Vuodenaika
            <select
              value={form.season}
              onChange={(e) => {
                const season = e.target.value as SeasonKey
                setSeasonTab(season)
                setForm({ ...form, season })
              }}
            >
              {SEASON_ORDER.map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Toistuvuus
            <select
              value={form.cadence}
              onChange={(e) => setForm({ ...form, cadence: e.target.value as TaskCadence })}
            >
              {(Object.keys(CADENCE_LABELS) as TaskCadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rasitus
            <select
              value={form.effort}
              onChange={(e) =>
                setForm({ ...form, effort: e.target.value as 'light' | 'heavy' })
              }
            >
              <option value="light">Kevyt</option>
              <option value="heavy">Raskas</option>
            </select>
          </label>
          <AssigneeFields
            value={form.defaultAssignee}
            onChange={(defaultAssignee) => setForm({ ...form, defaultAssignee })}
          />
          <div className="row-actions">
            <button className="btn primary" type="submit">
              {copying ? 'Tallenna kopio' : 'Lisää kortti'}
            </button>
            {copying && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  resetCreateForm(seasonTab)
                  setInfo('')
                }}
              >
                Peru kopiointi
              </button>
            )}
          </div>
        </form>
      </section>

      <div className="card-list">
        {filtered.map((c) => (
          <article key={c.id} className="notice-card">
            {editing?.id === c.id ? (
              <form className="stack" onSubmit={(e) => void saveEdit(e)}>
                <label>
                  Otsikko
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Ohje
                  <textarea
                    rows={3}
                    value={editing.instructions}
                    onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Vuodenaika
                  <select
                    value={editing.season}
                    onChange={(e) =>
                      setEditing({ ...editing, season: e.target.value as SeasonKey })
                    }
                  >
                    {SEASON_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SEASON_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Toistuvuus
                  <select
                    value={editing.cadence}
                    onChange={(e) =>
                      setEditing({ ...editing, cadence: e.target.value as TaskCadence })
                    }
                  >
                    {(Object.keys(CADENCE_LABELS) as TaskCadence[]).map((x) => (
                      <option key={x} value={x}>
                        {CADENCE_LABELS[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rasitus
                  <select
                    value={editing.effort}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        effort: e.target.value as 'light' | 'heavy',
                      })
                    }
                  >
                    <option value="light">Kevyt</option>
                    <option value="heavy">Raskas</option>
                  </select>
                </label>
                <AssigneeFields
                  value={editing.defaultAssignee}
                  onChange={(defaultAssignee) => setEditing({ ...editing, defaultAssignee })}
                />
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Aktiivinen (käytössä automaattijaossa)
                </label>
                <div className="row-actions">
                  <button className="btn primary small" type="submit">
                    Tallenna
                  </button>
                  <button className="btn small" type="button" onClick={() => setEditing(null)}>
                    Peru
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="week-card-top">
                  <strong>{c.title}</strong>
                  <span className="pill">{CADENCE_LABELS[c.cadence]}</span>
                </div>
                <p>{c.instructions}</p>
                <p className="meta">
                  {SEASON_LABELS[c.season]} · {c.effort === 'heavy' ? 'Raskas' : 'Kevyt'} ·{' '}
                  {c.defaultAssignee === 'lead'
                    ? 'Vastuuveli'
                    : c.defaultAssignee === 'all'
                      ? 'Kaikki'
                      : 'Avustajat'}
                  {!c.active ? ' · pois käytöstä' : ''}
                </p>
                <div className="row-actions">
                  <button className="btn small" type="button" onClick={() => setEditing(c)}>
                    Muokkaa
                  </button>
                  <button className="btn small" type="button" onClick={() => startCopy(c)}>
                    Kopioi
                  </button>
                  <button className="btn small" type="button" onClick={() => void remove(c)}>
                    Poista
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
        {!filtered.length && <p className="muted">Ei kortteja tälle vuodenajalle vielä.</p>}
      </div>
    </div>
  )
}
