/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Ota uusi SW käyttöön heti — kotivalikon PWA päivittyy ilman uudelleenasennusta
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/uploads\//],
  }),
)

self.addEventListener('push', (event) => {
  let payload: {
    title?: string
    body?: string
    url?: string
    kind?: string
    tag?: string
    renotify?: boolean
  } = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }
  const title = payload.title || 'Siisti salin piha'
  const url = payload.url || '/'
  // Älä käytä SVG-ikonia — osa iOS/Android-versioista hylkää ilmoituksen.
  // Asennettu PWA käyttää kotivalikon kuvaketta.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || 'Uusi ilmoitus',
    tag: payload.tag || payload.kind || 'general',
    renotify: Boolean(payload.renotify),
    data: { url, kind: payload.kind || 'general' },
  }
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, options)
      } catch (err) {
        console.error('showNotification failed', err)
        // Viimeinen yritys ilman tagia
        await self.registration.showNotification(title, {
          body: options.body,
          data: options.data,
        })
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        client.postMessage({
          type: 'siisti-push',
          title,
          body: options.body,
          url,
          kind: payload.kind || 'general',
        })
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = String(event.notification.data?.url || '/')
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await (client as WindowClient).navigate(url)
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
