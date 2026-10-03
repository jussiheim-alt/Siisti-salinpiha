import { Link, Navigate } from 'react-router-dom'
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
]

export function AdminHubPage() {
  const { user } = useAuth()
  if (user && user.role !== 'admin') return <Navigate to="/" replace />

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
    </div>
  )
}
