import { api } from './api'

function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) {
    throw new Error('Push-ilmoitukset eivät ole käytössä tässä ympäristössä')
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

function keysMatch(subKey: ArrayBuffer | null | undefined, publicKeyBase64: string) {
  if (!subKey) return false
  const expected = urlBase64ToUint8Array(publicKeyBase64)
  const actual = new Uint8Array(subKey)
  if (expected.length !== actual.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false
  }
  return true
}

/** iPhone/iPad — Web Push vaatii kotivalikkoon asennetun PWA:n. */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** Asennettu kotivalikkoon (standalone), ei pelkkä Safari-välilehti. */
export function isInstalledPwa() {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    Boolean(nav.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  )
}

async function getLocalSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

async function subscribeWithKey(publicKey: string) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (sub && !keysMatch(sub.options.applicationServerKey, publicKey)) {
    await sub.unsubscribe().catch(() => undefined)
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  await api('/api/push/subscribe', {
    method: 'POST',
    json: { subscription: sub.toJSON() },
  })
  return sub
}

export async function getPushStatus() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return {
      supported: false,
      permission: 'denied' as NotificationPermission,
      subscribed: false,
      installed: isInstalledPwa(),
      ios: isIosDevice(),
    }
  }
  const [data, keyData, localSub] = await Promise.all([
    api<{ subscribed: boolean }>('/api/push/status').catch(() => ({ subscribed: false })),
    api<{ publicKey: string | null }>('/api/push/vapid-public-key').catch(() => ({
      publicKey: null as string | null,
    })),
    getLocalSubscription().catch(() => null),
  ])
  // Netlify/local Drop: no VAPID keys → hide push UI instead of crashing on enable
  if (!keyData.publicKey) {
    return {
      supported: false,
      permission: Notification.permission,
      subscribed: false,
      installed: isInstalledPwa(),
      ios: isIosDevice(),
    }
  }
  const localOk =
    Boolean(localSub) && keysMatch(localSub?.options.applicationServerKey, keyData.publicKey)
  return {
    supported: true,
    permission: Notification.permission,
    // Molemmat tarvitaan: muuten UI näyttää "päällä" vaikka lukitusnäyttö ei saa mitään
    subscribed: Boolean(data.subscribed) && localOk,
    installed: isInstalledPwa(),
    ios: isIosDevice(),
  }
}

export async function enablePushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Tämä selain/laite ei tue push-ilmoituksia')
  }

  if (isIosDevice() && !isInstalledPwa()) {
    throw new Error('IOS_NOT_INSTALLED')
  }

  // Once the OS/browser has denied permission, requestPermission() will not
  // show a prompt again — user must flip it in system settings.
  let permission = Notification.permission
  if (permission === 'denied') {
    throw new Error('DENIED')
  }
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    throw new Error('DENIED')
  }

  const { publicKey } = await api<{ publicKey: string | null }>('/api/push/vapid-public-key')
  if (!publicKey) {
    throw new Error('Push-ilmoitukset eivät ole käytössä tässä ympäristössä')
  }
  await subscribeWithKey(publicKey)
  return true
}

/**
 * Jos lupa on jo myönnetty, synkkaa PushManager-tilaus palvelimelle uudelleen.
 * Korjaa tilanteet joissa VAPID-avain vaihtui tai SW menetti tilauksen.
 */
export async function ensurePushSubscription() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false
  }
  if (isIosDevice() && !isInstalledPwa()) return false
  const { publicKey } = await api<{ publicKey: string | null }>('/api/push/vapid-public-key').catch(
    () => ({ publicKey: null }),
  )
  if (!publicKey) return false
  try {
    await subscribeWithKey(publicKey)
    return true
  } catch {
    return false
  }
}

export async function disablePushNotifications() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => undefined)
    await api('/api/push/subscribe', {
      method: 'DELETE',
      json: { endpoint },
    }).catch(() => undefined)
  } else {
    await api('/api/push/subscribe', { method: 'DELETE', json: {} }).catch(() => undefined)
  }
}
