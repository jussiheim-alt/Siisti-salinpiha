import bcrypt from 'bcryptjs'
import type Database from 'better-sqlite3'

export type FoundingAdmin = {
  name: string
  email: string
  password?: string
}

/** Oikeat ylläpitäjät — salasanat vain ympäristömuuttujista, ei demokäyttäjiä. */
export function resolveFoundingAdmins(): FoundingAdmin[] {
  const jussiEmail = (process.env.ADMIN_EMAIL || 'jussiheim@gmail.com').trim().toLowerCase()
  const jussiPassword = process.env.ADMIN_PASSWORD?.trim()
  const joniEmail = (process.env.JONI_EMAIL || process.env.ADMIN2_EMAIL || '').trim().toLowerCase()
  const joniPassword = (process.env.JONI_PASSWORD || process.env.ADMIN2_PASSWORD || '').trim()

  const list: FoundingAdmin[] = [
    {
      name: process.env.ADMIN_NAME?.trim() || 'Jussi Heimonen',
      email: jussiEmail,
      password: jussiPassword || undefined,
    },
  ]

  if (joniEmail) {
    list.push({
      name: (process.env.JONI_NAME || process.env.ADMIN2_NAME || 'Joni Moilanen').trim(),
      email: joniEmail,
      password: joniPassword || undefined,
    })
  }

  return list
}

/** Luo puuttuvat founding-adminit. Ei ylikirjoita olemassa olevia salasanoja. */
export function ensureFoundingAdmins(db: Database.Database) {
  const admins = resolveFoundingAdmins()
  const now = new Date().toISOString()

  for (const admin of admins) {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
      .get(admin.email) as { id: string } | undefined
    if (existing) continue
    if (!admin.password || admin.password.length < 8) {
      console.warn(
        `Founding-admin ${admin.name} (${admin.email}) puuttuu — aseta salasana envissä (min. 8 merkkiä)`,
      )
      continue
    }
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, active, constraints_json, created_at)
       VALUES (?, ?, ?, ?, 'admin', 1, '[]', ?)`,
    ).run(crypto.randomUUID(), admin.name, admin.email, bcrypt.hashSync(admin.password, 10), now)
    console.log(`Luotu ylläpitäjä: ${admin.name} <${admin.email}>`)
  }

  const joniEmail = (process.env.JONI_EMAIL || process.env.ADMIN2_EMAIL || '').trim()
  if (!joniEmail) {
    console.warn(
      'Joni Moilasen sähköposti puuttuu — aseta JONI_EMAIL (ja JONI_PASSWORD) tai kutsu hänet ylläpitäjäksi sovelluksesta',
    )
  }
}
