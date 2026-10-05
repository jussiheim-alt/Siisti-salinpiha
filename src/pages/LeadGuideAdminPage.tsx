import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { DEFAULT_LEAD_GUIDE, type LeadGuide, type LeadGuideSection } from '../shared/leadGuide'

export function LeadGuideAdminPage() {
  const { user } = useAuth()
  const [guide, setGuide] = useState<LeadGuide>(DEFAULT_LEAD_GUIDE)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin') return
    api<{ guide: LeadGuide }>('/api/lead-guide')
      .then((d) => setGuide(d.guide || DEFAULT_LEAD_GUIDE))
      .catch((e) => setError(e.message))
  }, [user?.role])

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  function updateSection(i: number, patch: Partial<LeadGuideSection>) {
    setGuide((g) => ({
      ...g,
      sections: g.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }))
  }

  function addSection() {
    setGuide((g) => ({
      ...g,
      sections: [
        ...g.sections,
        { id: `s${Date.now()}`, title: 'Uusi kohta', body: '' },
      ],
    }))
  }

  function removeSection(i: number) {
    setGuide((g) => ({
      ...g,
      sections: g.sections.filter((_, idx) => idx !== i),
    }))
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const data = await api<{ guide: LeadGuide }>('/api/lead-guide', {
        method: 'PUT',
        json: { guide },
      })
      setGuide(data.guide)
      setInfo('Ohjeet tallennettu.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Vastuuveljen ohjeet</h1>
        <p className="lede">
          Näkyvät etusivulla viikkovuoron vastuuveljelle. Voit muokata tekstejä vapaasti.
        </p>
        <Link className="btn ghost small" to="/yllapitaja">
          ← Ylläpitäjä
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="hint">{info}</p>}

      <form className="stack panel" onSubmit={(e) => void onSave(e)}>
        <label>
          Etusivun otsikko
          <input
            required
            value={guide.calloutTitle}
            onChange={(e) => setGuide({ ...guide, calloutTitle: e.target.value })}
          />
          <span className="hint">Käytä {'{viikko}'} viikkonumerolle, esim. Olet viikon {'{viikko}'} vastuuveli</span>
        </label>
        <label>
          Etusivun lyhyt teksti
          <textarea
            required
            rows={2}
            value={guide.calloutBody}
            onChange={(e) => setGuide({ ...guide, calloutBody: e.target.value })}
          />
        </label>
        <label>
          Ohjeikkunan otsikko
          <input
            required
            value={guide.guideTitle}
            onChange={(e) => setGuide({ ...guide, guideTitle: e.target.value })}
          />
        </label>

        <h2 className="section-title">Ohjekohdat</h2>
        {guide.sections.map((s, i) => (
          <div key={s.id} className="lead-admin-section">
            <label>
              Otsikko
              <input
                required
                value={s.title}
                onChange={(e) => updateSection(i, { title: e.target.value })}
              />
            </label>
            <label>
              Teksti
              <textarea
                required
                rows={4}
                value={s.body}
                onChange={(e) => updateSection(i, { body: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn small"
              onClick={() => removeSection(i)}
              disabled={guide.sections.length <= 1}
            >
              Poista kohta
            </button>
          </div>
        ))}

        <div className="row-actions">
          <button type="button" className="btn small" onClick={addSection}>
            Lisää kohta
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Tallennetaan…' : 'Tallenna ohjeet'}
          </button>
        </div>
      </form>
    </div>
  )
}
