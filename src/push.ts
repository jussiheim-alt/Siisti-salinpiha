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

export async function getPushStatus() {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { supported: false, permission: 'denied' as NotificationPermission, subscribed: false }
  }
  const [data, keyData] = await Promise.all([
    api<{ subscribed: boolean }>('/api/push/status').catch(() => ({ subscribed: false })),
    api<{ publicKey: string | null }>('/api/push/vapid-public-key').catch(() => ({
      publicKey: null,
    })),
  ])
  // Netlify/local Drop: no VAPID keys → hide push UI instead of crashing on enable
  if (!keyData.publicKey) {
    return {
      supported: false,
      permission: Notification.permission,
      subscribed: false,
    }
  }
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(data.subscribed),
  }
}

export async function enablePushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Tämä selain/laite ei tue push-ilmoituksia')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Ilmoituslupa evättiin')
  }
  const { publicKey } = await api<{ publicKey: string | null }>('/api/push/vapid-public-key')
  if (!publicKey) {
    throw new Error('Push-ilmoitukset eivät ole käytössä tässä ympäristössä')
  }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
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
  return true
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
