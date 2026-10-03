import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../shared/appSettings'

export function AppSettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.role !== 'admin') return
    api<{ settings: AppSettings }>('/api/app-settings')
      .then((d) => setSettings(d.settings || DEFAULT_APP_SETTINGS))
      .catch((e) => setError(e.message))
  }, [user?.role])

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const data = await api<{ settings: AppSettings }>('/api/app-settings', {
        method: 'PUT',
        json: { settings },
      })
      setSettings(data.settings)
      setInfo('Asetukset tallennettu.')
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
        <h1>Sovelluksen asetukset</h1>
        <p className="lede">Perustiedot salista ja sovelluksesta.</p>
        <Link className="btn ghost small" to="/yllapitaja">
          ← Ylläpitäjä
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {info && <p className="hint">{info}</p>}

      <form className="stack panel" onSubmit={(e) => void onSave(e)}>
        <label>
          Sovelluksen nimi
          <input
            required
            value={settings.appName}
            onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
          />
        </label>
        <label>
          Osoite / paikka
          <input
            value={settings.address}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            placeholder="esim. Vääksyn valtakunnansali…"
          />
        </label>
        <label>
          Huollon yhteystieto
          <input
            value={settings.huoltoContact}
            onChange={(e) => setSettings({ ...settings, huoltoContact: e.target.value })}
            placeholder="Nimi tai sähköposti"
          />
        </label>
        <label>
          Sääpaikka (FMI)
          <input
            required
            value={settings.weatherPlace}
            onChange={(e) => setSettings({ ...settings, weatherPlace: e.target.value })}
            placeholder="Vääksy"
          />
        </label>
        <p className="hint" style={{ marginTop: '-0.35rem' }}>
          Käytetään sääennusteessa. Käytä FMI:n tuntemaa paikkanimeä.
        </p>
        <label>
          Lisätieto ylläpitäjille
          <textarea
            rows={3}
            value={settings.notes}
            onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
            placeholder="Vapaaehtoinen muistiinpano"
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Tallennetaan…' : 'Tallenna asetukset'}
        </button>
      </form>
    </div>
  )
}
