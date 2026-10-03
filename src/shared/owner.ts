/** Sovelluksen pääkäyttäjä — voi yksin lisätä/poistaa ylläpitäjiä. */
export const OWNER_EMAIL = 'jussiheim@gmail.com'
export const OWNER_NAME = 'Jussi Heimonen'

export function isOwnerEmail(email: string | null | undefined): boolean {
  return String(email || '')
    .trim()
    .toLowerCase() === OWNER_EMAIL
}

export function ownerEmailFromEnv(envEmail?: string | null): string {
  const fromEnv = String(envEmail || '')
    .trim()
    .toLowerCase()
  return fromEnv || OWNER_EMAIL
}
