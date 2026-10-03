import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type SwapOffer } from '../api'
import { formatWeekRangeFi } from '../shared/datetime'

function roleLabel(role: string) {
  return role === 'lead' ? 'vastuuveli' : 'avustaja'
}

export function SwapsPage() {
  const [mine, setMine] = useState<SwapOffer[]>([])
  const [available, setAvailable] = useState<SwapOffer[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await api<{ mine: SwapOffer[]; available: SwapOffer[] }>('/api/swaps')
    setMine(data.mine)
    setAvailable(data.available)
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Lataus epäonnistui'))
  }, [])

  async function accept(id: string) {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/swaps/${id}/accept`, { method: 'POST' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hyväksyntä epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(id: string) {
    setBusyId(id)
    setError('')
    try {
      await api(`/api/swaps/${id}/cancel`, { method: 'POST' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Peruminen epäonnistui')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <Link className="back" to="/">
        ← Etusivu
      </Link>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Vuoronvaihdot</h1>
        <p className="lede">
          Tarjoa oma paikkasi tai ota toisen vuoro, jos et ole jo samalla viikolla.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Tarjolla sinulle</h2>
        {available.length === 0 ? (
          <p className="muted">Ei avoimia vaihtoja juuri nyt.</p>
        ) : (
          <ul className="swap-list">
            {available.map((s) => (
              <li key={s.id} className="swap-card">
                <div>
                  <strong>
                    {formatWeekRangeFi(s.weekStart, s.weekEnd)}
                  </strong>
                  <p className="muted">
                    {s.fromUserName} · {roleLabel(s.role)}
                    {s.toUserId ? ' · suunnattu sinulle' : ' · avoin kaikille'}
                  </p>
                  {s.message && <p className="swap-msg">{s.message}</p>}
                </div>
                <div className="row-actions">
                  <Link className="btn ghost small" to={`/pihavuoro/${s.pihavuoroId}`}>
                    Viikko
                  </Link>
                  <button
                    className="btn primary small"
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void accept(s.id)}
                  >
                    {busyId === s.id ? '…' : 'Ota vuoro'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Omat tarjouksesi</h2>
        {mine.length === 0 ? (
          <p className="muted">
            Ei avoimia tarjouksia. Voit tarjota paikkaasi Pihavuoro-sivulta.
          </p>
        ) : (
          <ul className="swap-list">
            {mine.map((s) => (
              <li key={s.id} className="swap-card">
                <div>
                  <strong>
                    {formatWeekRangeFi(s.weekStart, s.weekEnd)}
                  </strong>
                  <p className="muted">
                    {roleLabel(s.role)}
                    {s.toUserName ? ` · kohde: ${s.toUserName}` : ' · avoin kaikille'}
                  </p>
                  {s.message && <p className="swap-msg">{s.message}</p>}
                </div>
                <div className="row-actions">
                  <Link className="btn ghost small" to={`/pihavuoro/${s.pihavuoroId}`}>
                    Viikko
                  </Link>
                  <button
                    className="btn small"
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void cancel(s.id)}
                  >
                    Peru
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
