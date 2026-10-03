import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { getToken, isLocalDataMode } from '../api'
import { useAuth } from '../auth'

const SECTIONS = [
  {
    to: '/kayttajat',
    title: 'Jäsenet',
    body: 'Kutsu käyttäjiä, käyttöoikeudet ja poistaminen.',
  },
  {
    to: '/vastuuohjeet',
    title: 'Vastuuveljen ohje',
    body: 'Etusivun huomiolaatikko ja ohjetekstit vastuuveljelle.',
  },
  {
    to: '/asetukset',
    title: 'Sovelluksen asetukset',
    body: 'Nimi, osoite, huoltokontakti ja sääpaikka.',
  },
  {
    to: '/tehtavat',
    title: 'Tehtäväkortit',
    body: 'Vuodenajan tehtäväkortit viikkovuoroille.',
  },
  {
    to: '/huolto',
    title: 'Huoltokorttien tehtävät',
    body: 'Aktivoi huoltokortteja viikkovuorolle — vastuuveli merkitsee tehdyt.',
  },
]

function stampFi() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function AdminHubPage() {
  const { user } = useAuth()
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState('')
  const [backupInfo, setBackupInfo] = useState('')

  if (user && user.role !== 'admin') return <Navigate to="/" replace />

  async function downloadBackup() {
    setBackupBusy(true)
    setBackupError('')
    setBackupInfo('')
    try {
      if (isLocalDataMode) {
        const raw =
          localStorage.getItem('siisti-piha-local-db-v3') ||
          localStorage.getItem('siisti-piha-local-db-v2')
        if (!raw) throw new Error('Paikallista dataa ei löytynyt')
        const filename = `siisti-salinpiha-varmuuskopio-local-${stampFi()}.json`
        triggerDownload(new Blob([raw], { type: 'application/json' }), filename)
        setBackupInfo('Varmuuskopio ladattu laitteellesi (paikallinen demo-data).')
        return
      }

      const token = getToken()
      const res = await fetch('/api/admin/backup', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'Varmuuskopio epäonnistui')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(cd)
      const filename = match
        ? decodeURIComponent(match[1].replace(/"/g, ''))
        : `siisti-salinpiha-varmuuskopio-${stampFi()}.tar.gz`
      triggerDownload(blob, filename)
      setBackupInfo('Varmuuskopio ladattu. Säilytä tiedosto turvallisesti (esim. omaan pilveen).')
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Varmuuskopio epäonnistui')
    } finally {
      setBackupBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Ylläpitäjä</h1>
        <p className="lede">Hallitse jäseniä, ohjeita ja sovelluksen asetuksia.</p>
      </header>

      <section className="surface-card" aria-label="Ylläpidon osiot">
        <div className="quick-list">
          {SECTIONS.map((s) => (
            <Link key={s.to} className="quick-link" to={s.to}>
              <span className="quick-link-text">
                <strong>{s.title}</strong>
                <span>{s.body}</span>
              </span>
              <span className="quick-link-action">Avaa</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel stack" aria-label="Varmuuskopio" style={{ marginTop: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Varmuuskopio</h2>
        <p className="hint" style={{ margin: 0 }}>
          Lataa koko tietokanta ja kuvat omalle laitteellesi. Ohjelma ei tee automaattisia
          varmuuskopioita — suositus: tallenna säännöllisesti (esim. kerran kuussa).
        </p>
        {backupError && <p className="error">{backupError}</p>}
        {backupInfo && <p className="hint">{backupInfo}</p>}
        <button
          type="button"
          className="btn primary"
          disabled={backupBusy}
          onClick={() => void downloadBackup()}
        >
          {backupBusy ? 'Luodaan varmuuskopiota…' : 'Lataa varmuuskopio'}
        </button>
      </section>
    </div>
  )
}
