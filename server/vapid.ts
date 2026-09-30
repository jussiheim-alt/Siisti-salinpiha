import webpush from 'web-push'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const keyPath = path.join(root, 'data', 'vapid.json')

type VapidKeys = { publicKey: string; privateKey: string }

function loadKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    }
  }
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf8')) as VapidKeys
  }
  const keys = webpush.generateVAPIDKeys()
  fs.mkdirSync(path.dirname(keyPath), { recursive: true })
  fs.writeFileSync(keyPath, JSON.stringify(keys, null, 2))
  return keys
}

export const vapidKeys = loadKeys()

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@siistipiha.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
)

export { webpush }
