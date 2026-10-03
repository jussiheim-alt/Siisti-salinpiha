import Database from 'better-sqlite3'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { db, initDb, replaceDatabaseFromFile } from './db.ts'
import { ensureFoundingAdmins } from './foundingAdmins.ts'
import { ensureAppSettings } from './appSettings.ts'
import { ensureLeadGuideTable } from './leadGuide.ts'
import { uploadsDir } from './paths.ts'

const execFileAsync = promisify(execFile)

export const RESTORE_CONFIRM_WORD = 'PALAUTA'

function stampFi() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

/**
 * Snapshot SQLite (incl. WAL) + uploads into a .tar.gz for manual download.
 * Caller must delete the returned workDir when done streaming.
 */
export async function createBackupArchive(): Promise<{
  archivePath: string
  filename: string
  workDir: string
}> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siisti-backup-'))
  const dbCopy = path.join(workDir, 'siisti-piha.sqlite')
  await db.backup(dbCopy)

  const uploadsCopy = path.join(workDir, 'uploads')
  if (fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, uploadsCopy, { recursive: true })
  } else {
    fs.mkdirSync(uploadsCopy, { recursive: true })
  }

  const readme = [
    'Siisti salin piha — varmuuskopio',
    '',
    `Luotu: ${new Date().toISOString()}`,
    '',
    'Sisältö:',
    '- siisti-piha.sqlite  — käyttäjät, vuorot, tehtäväkortit, kuitaukset, huomiot…',
    '- uploads/           — ladatut kuvat',
    '',
    'Palautus:',
    '- Sovelluksessa: Ylläpitäjä → Palauta varmuuskopiosta (vahvista sanalla PALAUTA)',
    '- Tai manuaalisesti: pura arkisto DATA_DIR:iin (/var/data) ja käynnistä palvelu uudelleen',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(workDir, 'README.txt'), readme, 'utf8')

  const filename = `siisti-salinpiha-varmuuskopio-${stampFi()}.tar.gz`
  const archivePath = path.join(workDir, filename)

  await execFileAsync(
    'tar',
    ['-czf', archivePath, 'siisti-piha.sqlite', 'uploads', 'README.txt'],
    { cwd: workDir },
  )

  return { archivePath, filename, workDir }
}

export function cleanupBackupWorkDir(workDir: string) {
  try {
    fs.rmSync(workDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

function assertSafeExtractRoot(extractDir: string) {
  const resolvedRoot = path.resolve(extractDir)
  const stack = [resolvedRoot]
  while (stack.length) {
    const dir = stack.pop()!
    for (const name of fs.readdirSync(dir)) {
      const full = path.resolve(dir, name)
      if (!full.startsWith(resolvedRoot + path.sep) && full !== resolvedRoot) {
        throw new Error('Varmuuskopio sisältää epäkelpoja polkuja')
      }
      if (fs.statSync(full).isDirectory()) stack.push(full)
    }
  }
}

function validateBackupSqlite(sqlitePath: string) {
  const probe = new Database(sqlitePath, { readonly: true, fileMustExist: true })
  try {
    const tables = probe
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
      .get() as { name?: string } | undefined
    if (!tables?.name) {
      throw new Error('Varmuuskopio ei ole kelvollinen Siisti salin piha -tietokanta')
    }
    const admins = probe
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND active = 1`)
      .get() as { c: number }
    if (!admins || Number(admins.c) < 1) {
      throw new Error('Varmuuskopiossa ei ole aktiivista ylläpitäjää')
    }
  } finally {
    probe.close()
  }
}

function replaceUploadsFrom(sourceUploadsDir: string) {
  if (!fs.existsSync(sourceUploadsDir) || !fs.statSync(sourceUploadsDir).isDirectory()) {
    return
  }
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'siisti-uploads-'))
  try {
    fs.cpSync(sourceUploadsDir, staging, { recursive: true })
    fs.mkdirSync(uploadsDir, { recursive: true })
    for (const name of fs.readdirSync(uploadsDir)) {
      fs.rmSync(path.join(uploadsDir, name), { recursive: true, force: true })
    }
    for (const name of fs.readdirSync(staging)) {
      fs.cpSync(path.join(staging, name), path.join(uploadsDir, name), { recursive: true })
    }
  } finally {
    cleanupBackupWorkDir(staging)
  }
}

/**
 * Restore from a .tar.gz created by createBackupArchive (or equivalent layout).
 * Replaces live SQLite + uploads. Runs schema ensure + founding admins after.
 */
export async function restoreFromArchive(archivePath: string): Promise<{ users: number }> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siisti-restore-'))
  try {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', workDir])
    assertSafeExtractRoot(workDir)

    const sqlitePath = path.join(workDir, 'siisti-piha.sqlite')
    if (!fs.existsSync(sqlitePath)) {
      throw new Error('Arkistosta puuttuu siisti-piha.sqlite')
    }
    validateBackupSqlite(sqlitePath)

    replaceDatabaseFromFile(sqlitePath)
    replaceUploadsFrom(path.join(workDir, 'uploads'))

    initDb()
    ensureLeadGuideTable()
    ensureAppSettings()
    ensureFoundingAdmins(db)

    const users = (
      db.prepare(`SELECT COUNT(*) AS c FROM users WHERE active = 1`).get() as { c: number }
    ).c
    return { users: Number(users) }
  } finally {
    cleanupBackupWorkDir(workDir)
  }
}
