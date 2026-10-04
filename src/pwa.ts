import { registerSW } from 'virtual:pwa-register'

/**
 * PWA-päivitykset kotivalikon sovellukselle:
 * - registerType autoUpdate + skipWaiting → uusi build aktivoituu
 * - controllerchange → pakota reload (iOS ei muuten aina vaihda CSS:ää)
 * - tarkista päivitykset heti, fokuksessa, sivun paluussa ja 2 min välein
 */
let refreshing = false
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      void registration.update().catch(() => {
        /* verkko offline — ohita */
      })
    }

    checkForUpdate()
    window.setInterval(checkForUpdate, 2 * 60 * 1000)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('pageshow', checkForUpdate)
  },
  onOfflineReady() {
    // Ensimmäinen asennus valmis — ei UI:ta tarvita
  },
})
