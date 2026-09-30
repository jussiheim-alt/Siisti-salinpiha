import { useEffect, useState, type FormEvent } from 'react'
import { api, type User } from '../api'

const CONSTRAINT_OPTIONS = [
  { id: 'no_heavy', label: 'Ei raskaisiin töihin' },
  { id: 'no_lead', label: 'Ei vastuuhenkilöksi' },
]

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [constraints, setConstraints] = useState<string[]>([])
  const [editing, setEditing] = useState<User | null>(null)

  async function load() {
    const data = await api<{ users: User[] }>('/api/users')
    setUsers(data.users)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [])

  function toggleConstraint(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/users', {
        method: 'POST',
        json: { name, email, password, role: 'member', constraints },
      })
      setName('')
      setEmail('')
      setPassword('')
      setConstraints([])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lisäys epäonnistui')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
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
        },
      })
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epäonnistui')
    }
  }

  return (
    <div className="page">
      <header className="page-hero compact">
        <p className="brand-mark">Siisti piha</p>
        <h1>Käyttäjät</h1>
        <p className="lede">Roolit ja käytettävyysrajoitukset.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Lisää käyttäjä</h2>
        <form className="stack" onSubmit={onCreate}>
          <label>
            Nimi
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Sähköposti
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
          </label>
          <label>
            Salasana
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
            />
          </label>
          <fieldset className="checks">
            <legend>Käytettävyys</legend>
            {CONSTRAINT_OPTIONS.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={constraints.includes(c.id)}
                  onChange={() => toggleConstraint(c.id, constraints, setConstraints)}
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <button className="btn primary" type="submit">
            Lisää
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Lista</h2>
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <div>
                <strong>{u.name}</strong>
                <span className="muted">
                  {' '}
                  · {u.role === 'admin' ? 'ylläpitäjä' : 'käyttäjä'} · {u.email}
                </span>
                <div className="tags">
                  {u.constraints.map((c) => (
                    <span key={c} className="tag">
                      {CONSTRAINT_OPTIONS.find((x) => x.id === c)?.label || c}
                    </span>
                  ))}
                  {!u.active && <span className="tag">Ei aktiivinen</span>}
                </div>
              </div>
              <button className="btn small" onClick={() => setEditing({ ...u })}>
                Muokkaa
              </button>
            </li>
          ))}
        </ul>
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form
            className="modal stack"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEdit}
          >
            <h2>Muokkaa</h2>
            <label>
              Nimi
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              Sähköposti
              <input
                value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </label>
            <label>
              Rooli
              <select
                value={editing.role}
                onChange={(e) =>
                  setEditing({ ...editing, role: e.target.value as 'admin' | 'member' })
                }
              >
                <option value="member">Käyttäjä</option>
                <option value="admin">Ylläpitäjä</option>
              </select>
            </label>
            <fieldset className="checks">
              <legend>Käytettävyys</legend>
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
            <label className="check">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Aktiivinen
            </label>
            <div className="row-actions">
              <button className="btn primary" type="submit">
                Tallenna
              </button>
              <button className="btn" type="button" onClick={() => setEditing(null)}>
                Peru
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
