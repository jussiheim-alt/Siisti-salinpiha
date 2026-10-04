import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api, type User } from '../api'
import { useAuth } from '../auth'
import { formatDateFi } from '../shared/datetime'
import { isOwnerEmail } from '../shared/owner'

const CONSTRAINT_OPTIONS = [
  { id: 'no_heavy', label: 'Ei raskaisiin töihin' },
  { id: 'no_lead', label: 'Ei vastuuhenkilöksi' },
]

type Invite = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  constraints: string[]
  travelGroup?: string | null
  inviteUrl: string | null
  expiresAt: string
  status: string
}

function roleLabel(role: string) {
  return role === 'admin' ? 'Ylläpitäjä' : 'Käyttäjä'
}

export function UsersPage() {
  const { user: me } = useAuth()
  const isOwner = isOwnerEmail(me?.email)
  const [users, setUsers] = useState<User[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [constraints, setConstraints] = useState<string[]>([])
  const [travelGroup, setTravelGroup] = useState('')
  const [lastInviteUrl, setLastInviteUrl] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  const knownTravelGroups = [
    ...new Set(
      users
        .map((u) => u.travelGroup?.trim())
        .filter((g): g is string => Boolean(g)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'fi'))

  async function load() {
    const [u, i] = await Promise.all([
      api<{ users: User[] }>('/api/users'),
      api<{ invites: Invite[] }>('/api/invites'),
    ])
    setUsers(u.users)
    setInvites(i.invites)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLastInviteUrl('')
    try {
      const data = await api<{ invite: Invite }>('/api/invites', {
        method: 'POST',
        json: {
          name,
          email,
          role: isOwner ? role : 'member',
          constraints,
          travelGroup: travelGroup.trim() || null,
        },
      })
      setName('')
      setEmail('')
      setRole('member')
      setConstraints([])
      setTravelGroup('')
      setLastInviteUrl(data.invite.inviteUrl || '')
      setNotice('Kutsu luotu — kopioi linkki ja lähetä se henkilölle.')
      /* iOS PWA: blur + scroll reset so the tab bar is not left off-screen. */
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      window.scrollTo(0, 0)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kutsu epäonnistui')
    }
  }

  async function revokeInvite(id: string) {
    setError('')
    try {
      await api(`/api/invites/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Peruutus epäonnistui')
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Kutsulinkki kopioitu leikepöydälle.')
    } catch {
      setLastInviteUrl(url)
      setNotice('Kopioi linkki alla olevasta kentästä.')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError('')
    setBusy(true)
    try {
      await api(`/api/users/${editing.id}`, {
        method: 'PATCH',
        json: {
          name: editing.name,
          email: editing.email,
          role: editing.role,
          active: editing.active,
          constraints: editing.constraints,
          constraintNote: editing.constraintNote,
          snoozeUntil: editing.snoozeUntil,
          travelGroup: editing.travelGroup?.trim() || null,
        },
      })
      setEditing(null)
      setNotice('Käyttöoikeudet tallennettu.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  async function deleteUser() {
    if (!editing) return
    const ok = window.confirm(
      `Poistetaanko käyttäjä ${editing.name} pysyvästi? Tätä ei voi perua.`,
    )
    if (!ok) return
    setError('')
    setBusy(true)
    try {
      await api(`/api/users/${editing.id}`, { method: 'DELETE' })
      setEditing(null)
      setNotice('Käyttäjä poistettu.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poisto epäonnistui')
    } finally {
      setBusy(false)
    }
  }

  const editingIsOwner = editing ? isOwnerEmail(editing.email) : false
  const canEditRole = isOwner && !editingIsOwner
  const canDelete =
    !!editing &&
    editing.id !== me?.id &&
    !editingIsOwner &&
    (editing.role !== 'admin' || isOwner)

  return (
    <div className="page">
      <datalist id="travel-group-options">
        {knownTravelGroups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <header className="page-hero compact">
        <p className="brand-mark">Siisti salin piha</p>
        <h1>Jäsenet</h1>
        <p className="lede">Kutsu käyttäjiä ja määritä käyttöoikeudet.</p>
        <Link className="btn ghost small" to="/yllapitaja">
          ← Ylläpitäjä
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="hint">{notice}</p>}

      <section className="panel">
        <h2>Kutsu käyttäjä</h2>
        <form className="stack" onSubmit={(e) => void onInvite(e)}>
          <label>
            Nimi
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Sähköposti
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
          </label>
          <label>
            Käyttöoikeustaso
            <select
              value={isOwner ? role : 'member'}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              disabled={!isOwner}
            >
              <option value="member">Käyttäjä — vuorot, tehtävät, huomiot</option>
              {isOwner && <option value="admin">Ylläpitäjä — täydet oikeudet</option>}
            </select>
          </label>
          <p className="hint">
            Vastuuveli ei ole erillinen tili. Kutsu jäseneksi käyttäjänä — vastuuveli
            valitaan viikkokoonpanossa (Vuorot), kun viikko julkaistaan.
          </p>
          {!isOwner && (
            <p className="hint">Vain pääkäyttäjä voi kutsua uusia ylläpitäjiä.</p>
          )}
          <fieldset className="checks">
            <legend>Käytettävyysrajoitukset</legend>
            <p className="hint">
              Jätä tyhjäksi, jos henkilö voi olla viikon vastuuveli. Rasti
              &quot;Ei vastuuhenkilöksi&quot; vain jos häntä ei saa valita vastuuveljeksi.
            </p>
            {CONSTRAINT_OPTIONS.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={constraints.includes(c.id)}
                  onChange={() =>
                    setConstraints((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                    )
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <label>
            Matkaseura / perhe
            <input
              value={travelGroup}
              onChange={(e) => setTravelGroup(e.target.value)}
              list="travel-group-options"
              placeholder="Esim. Heimonen"
              autoComplete="off"
            />
          </label>
          <p className="hint">
            Sama nimi yhdistää henkilöt — suositus laittaa heidät samalle viikolle.
          </p>
          <button className="btn primary" type="submit">
            Luo kutsulinkki
          </button>
        </form>
        {lastInviteUrl && (
          <div className="stack" style={{ marginTop: '1rem' }}>
            <p className="hint" style={{ wordBreak: 'break-all', margin: 0 }}>
              <strong>Kutsulinkki</strong>
              <br />
              {lastInviteUrl}
            </p>
            <button className="btn" type="button" onClick={() => void copyLink(lastInviteUrl)}>
              Kopioi linkki
            </button>
          </div>
        )}
      </section>

      {invites.length > 0 && (
        <section className="panel">
          <h2>Avoimet kutsut</h2>
          <ul className="user-list">
            {invites.map((inv) => (
              <li key={inv.id}>
                <div>
                  <strong>{inv.name}</strong>
                  <span className="muted">
                    {' '}
                    · {roleLabel(inv.role)} · {inv.email}
                  </span>
                  <div className="tags">
                    {inv.travelGroup && <span className="tag">Perhe: {inv.travelGroup}</span>}
                    <span className="tag">Vanhenee {formatDateFi(inv.expiresAt)}</span>
                  </div>
                </div>
                <div className="row-actions">
                  {inv.inviteUrl && (
                    <button className="btn small" type="button" onClick={() => void copyLink(inv.inviteUrl!)}>
                      Kopioi
                    </button>
                  )}
                  <button className="btn small" type="button" onClick={() => void revokeInvite(inv.id)}>
                    Peru
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Käyttäjät</h2>
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <span className="muted">
                  {' '}
                  · {roleLabel(u.role)}
                  {isOwnerEmail(u.email) ? ' · pääkäyttäjä' : ''} · {u.email}
                </span>
                <div className="tags">
                  {u.travelGroup && <span className="tag">Perhe: {u.travelGroup}</span>}
                  {u.constraints.map((c) => (
                    <span key={c} className="tag">
                      {CONSTRAINT_OPTIONS.find((x) => x.id === c)?.label || c}
                    </span>
                  ))}
                  {!u.active && <span className="tag">Ei aktiivinen</span>}
                </div>
              </div>
              <button className="btn small" type="button" onClick={() => setEditing({ ...u })}>
                Oikeudet
              </button>
            </li>
          ))}
        </ul>
      </section>

      {editing &&
        createPortal(
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={() => !busy && setEditing(null)}
          >
            <form
              className="modal user-rights-modal"
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => void saveEdit(e)}
            >
              <header className="modal-head">
                <h2>Käyttöoikeudet</h2>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                >
                  Sulje
                </button>
              </header>

              <div className="modal-scroll stack">
                <label>
                  Nimi
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    disabled={editingIsOwner && !isOwner}
                  />
                </label>
                <label>
                  Sähköposti
                  <input
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    disabled={editingIsOwner && !isOwner}
                  />
                </label>
                <label>
                  Käyttöoikeustaso
                  <select
                    value={editing.role}
                    disabled={!canEditRole}
                    onChange={(e) =>
                      setEditing({ ...editing, role: e.target.value as 'admin' | 'member' })
                    }
                  >
                  <option value="member">Käyttäjä</option>
                  <option value="admin">Ylläpitäjä (täydet oikeudet)</option>
                </select>
              </label>
              <p className="hint">
                Vastuuveli valitaan viikkokoonpanossa — se ei ole erillinen käyttöoikeustaso.
              </p>
              {!canEditRole && (
                <p className="hint">
                  {editingIsOwner
                    ? 'Pääkäyttäjän ylläpito-oikeutta ei voi muuttaa.'
                    : 'Vain pääkäyttäjä (Jussi Heimonen) voi lisätä tai poistaa ylläpitäjiä.'}
                </p>
              )}
              <fieldset className="checks">
                <legend>Käytettävyysrajoitukset</legend>
                  {CONSTRAINT_OPTIONS.map((c) => (
                    <label key={c.id} className="check">
                      <input
                        type="checkbox"
                        checked={editing.constraints.includes(c.id)}
                        onChange={() =>
                          setEditing({
                            ...editing,
                            constraints: editing.constraints.includes(c.id)
                              ? editing.constraints.filter((x) => x !== c.id)
                              : [...editing.constraints, c.id],
                          })
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Matkaseura / perhe
                  <input
                    value={editing.travelGroup ?? ''}
                    onChange={(e) => setEditing({ ...editing, travelGroup: e.target.value })}
                    list="travel-group-options"
                    placeholder="Esim. Heimonen — tyhjä = ei ryhmää"
                    autoComplete="off"
                  />
                </label>
                <p className="hint">
                  Sama nimi yhdistää jäsenet samalle viikolle suosituksessa.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    disabled={editingIsOwner}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  />
                  Aktiivinen tili
                </label>
                {canDelete && (
                  <div className="modal-danger-slot">
                    <button
                      className="btn danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteUser()}
                    >
                      Poista käyttäjä
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <div className="row-actions">
                  <button className="btn primary" type="submit" disabled={busy}>
                    {busy ? 'Tallennetaan…' : 'Tallenna'}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setEditing(null)}
                    disabled={busy}
                  >
                    Peru
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </div>
  )
}
