import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const root = path.resolve(__dirname, '..')

/** SQLite, JWT-fallback, VAPID — Render Disk: aseta DATA_DIR=/var/data */
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, 'data')

/**
 * Ladatut kuvat.
 * - UPLOADS_DIR jos asetettu
 * - DATA_DIR/uploads kun DATA_DIR on asetettu (Render Disk)
 * - muuten ./uploads (paikallinen oletus)
 */
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : process.env.DATA_DIR
    ? path.join(dataDir, 'uploads')
    : path.join(root, 'uploads')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(uploadsDir, { recursive: true })
