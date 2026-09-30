import { registerSW } from 'virtual:pwa-register'

/**
 * PWA-päivitykset kotivalikon sovellukselle:
 * - registerType autoUpdate + skipWaiting → uusi build aktivoituu ja sivu latautuu uudelleen
 * - tarkista päivitykset avauksessa, fokuksessa ja tunnin välein
 * Käyttäjän ei tarvitse poistaa sovellusta kotivalikosta.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdate = () => {
      void registration.update().catch(() => {
        /* verkko offline — ohita */
      })
    }

    // Tunti riittää taustatarkistukseen; visibility/focus peittää päivittäisen käytön
    const intervalMs = 60 * 60 * 1000
    window.setInterval(checkForUpdate, intervalMs)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })
    window.addEventListener('focus', checkForUpdate)
  },
  onOfflineReady() {
    // Ensimmäinen asennus valmis — ei UI:ta tarvita
  },
})
