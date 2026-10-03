type Props = {
  compact?: boolean
}

export function InstallTips({ compact = false }: Props) {
  return (
    <div className={`install-tips${compact ? ' is-compact' : ''}`}>
      {!compact && <h2>Lisää sovellus kotivalikkoon</h2>}
      <p className="install-tips-lede">
        Näin Siisti salin piha aukeaa kuin sovellus — ilman App Storea.
      </p>

      <div className="install-tips-grid">
        <section className="install-tip-card" aria-labelledby="install-ios">
          <h3 id="install-ios">iPhone (Safari)</h3>
          <ol>
            <li>Avaa kutsulinkki tai kirjautunut sovellus <strong>Safarilla</strong>.</li>
            <li>Napauta alareunan <strong>Jaa</strong>-painiketta (neliö ja nuoli ylös).</li>
            <li>Vieritä ja valitse <strong>Lisää Koti-valikkoon</strong>.</li>
            <li>Vahvista nimellä “Siisti salin piha” ja napauta <strong>Lisää</strong>.</li>
          </ol>
          <p className="hint">Chrome iPhonella ei tue tätä yhtä luotettavasti — käytä Safaria.</p>
        </section>

        <section className="install-tip-card" aria-labelledby="install-android">
          <h3 id="install-android">Android (Chrome)</h3>
          <ol>
            <li>Avaa kutsulinkki tai kirjautunut sovellus <strong>Chromella</strong>.</li>
            <li>Napauta oikean yläkulman <strong>⋮</strong>-valikkoa.</li>
            <li>Valitse <strong>Asenna sovellus</strong> tai <strong>Lisää aloitusnäytölle</strong>.</li>
            <li>Vahvista asennus — kuvake ilmestyy kotivalikkoon.</li>
          </ol>
          <p className="hint">Jos et näe Asenna-kohtaa, valitse “Lisää aloitusnäytölle”.</p>
        </section>
      </div>
    </div>
  )
}
