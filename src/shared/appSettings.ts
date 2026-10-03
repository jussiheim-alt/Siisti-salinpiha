export type AppSettings = {
  appName: string
  address: string
  huoltoContact: string
  weatherPlace: string
  notes: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'Siisti salin piha',
  address: '',
  huoltoContact: '',
  weatherPlace: 'Vääksy',
  notes: '',
}

export function normalizeAppSettings(raw: unknown): AppSettings {
  const base = DEFAULT_APP_SETTINGS
  if (!raw || typeof raw !== 'object') return { ...base }
  const o = raw as Partial<AppSettings>
  return {
    appName: String(o.appName || '').trim() || base.appName,
    address: String(o.address || '').trim(),
    huoltoContact: String(o.huoltoContact || '').trim(),
    weatherPlace: String(o.weatherPlace || '').trim() || base.weatherPlace,
    notes: String(o.notes || '').trim(),
  }
}
