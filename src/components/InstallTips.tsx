type Props = {
  compact?: boolean
}

export function InstallTips({ compact = false }: Props) {
  return (
    <div className={`install-tips${compact ? ' is-compact' : ''}`}>
      {!compact && <h2>Lisää sovellus kotinäytölle</h2>}
      <p className="install-tips-lede">
        Neljä napautusta – sen jälkeen kuvake aukeaa kuin tavallinen sovellus.
      </p>

      <div className="install-tips-grid">
        <section className="install-tip-card" aria-labelledby="install-ios">
          <h3 id="install-ios">
            <span className="install-tip-platform">iPhone</span>
            <span className="install-tip-browser">Safari</span>
          </h3>
          <ol>
            <li>Avaa kutsulinkki <strong>Safarissa</strong>.</li>
            <li>
              Napauta alhaalla <strong>Jaa</strong>.
            </li>
            <li>
              Valitse <strong>Lisää Koti-valikkoon</strong>.
            </li>
            <li>
              Vahvista ja napauta <strong>Lisää</strong>.
            </li>
          </ol>
          <p className="hint">Käytä Safaria. Chrome iPhonella ei tue asennusta yhtä hyvin.</p>
        </section>

        <section className="install-tip-card" aria-labelledby="install-android">
          <h3 id="install-android">
            <span className="install-tip-platform">Android</span>
            <span className="install-tip-browser">Chrome</span>
          </h3>
          <ol>
            <li>Avaa kutsulinkki <strong>Chromessa</strong>.</li>
            <li>
              Napauta oikeassa yläkulmassa <strong>⋮-valikkoa</strong>.
            </li>
            <li>
              Valitse <strong>Asenna sovellus</strong> tai{' '}
              <strong>Lisää aloitusnäytölle</strong>.
            </li>
            <li>Vahvista. Kuvake ilmestyy kotinäytölle.</li>
          </ol>
          <p className="hint">Jos Asenna-kohtaa ei näy, valitse Lisää aloitusnäytölle.</p>
        </section>
      </div>
    </div>
  )
}
