import { registerSW } from 'virtual:pwa-register'

/**
 * PWA-päivitykset kotivalikon sovellukselle:
 * - registerType autoUpdate + skipWaiting → uusi build aktivoituu
 * - controllerchange → pakota reload, jotta CSS/JS ei jää vanhaan SW:hen
 * - tarkista päivitykset heti, fokuksessa, sivun paluussa ja 5 min välein
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

    const intervalMs = 5 * 60 * 1000
    window.setInterval(checkForUpdate, intervalMs)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('pageshow', () => {
      checkForUpdate()
    })
  },
  onOfflineReady() {
    // Ensimmäinen asennus valmis — ei UI:ta tarvita
  },
})
