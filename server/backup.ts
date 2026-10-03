import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { db } from './db.ts'
import { uploadsDir } from './paths.ts'

const execFileAsync = promisify(execFile)

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
    'Palautus Renderissä (esim.):',
    '1. Pysäytä palvelu tai varmista ettei kirjoiteta kantaan',
    '2. Pura arkisto ja kopioi siisti-piha.sqlite sekä uploads/ DATA_DIR:iin (/var/data)',
    '3. Käynnistä palvelu uudelleen',
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
