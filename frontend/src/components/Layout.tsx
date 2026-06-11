import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

export function Layout() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'uk'

  useEffect(() => {
    document.title = t('app.title')
    document.documentElement.lang = current
  }, [t, current])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-title">{t('app.title')}</span>
          <nav className="app-nav" aria-label={t('nav.label')}>
            <NavLink to="/regions">{t('nav.regions')}</NavLink>
            <NavLink to="/panel">{t('nav.panel')}</NavLink>
            <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
            <NavLink to="/parameters">{t('nav.parameters')}</NavLink>
          </nav>
          <div className="lang-switch" role="group" aria-label={t('lang.label')}>
            <button
              type="button"
              className="lang-btn"
              aria-pressed={current === 'uk'}
              onClick={() => void i18n.changeLanguage('uk')}
            >
              {t('lang.uk')}
            </button>
            <button
              type="button"
              className="lang-btn"
              aria-pressed={current === 'en'}
              onClick={() => void i18n.changeLanguage('en')}
            >
              {t('lang.en')}
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
