import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinkClass = cn(
  buttonVariants({ variant: 'ghost', size: 'sm' }),
  'aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground',
)

export function Layout() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'uk'

  useEffect(() => {
    document.title = t('app.title')
    document.documentElement.lang = current
  }, [t, current])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-card border-border sticky top-0 z-40 border-b shadow-sm">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <span className="max-w-[22rem] text-sm leading-snug font-bold">{t('app.title')}</span>
          <nav className="flex flex-wrap gap-1" aria-label={t('nav.label')}>
            <NavLink className={navLinkClass} to="/regions">
              {t('nav.regions')}
            </NavLink>
            <NavLink className={navLinkClass} to="/panel">
              {t('nav.panel')}
            </NavLink>
            <NavLink className={navLinkClass} to="/dashboard">
              {t('nav.dashboard')}
            </NavLink>
            <NavLink className={navLinkClass} to="/parameters">
              {t('nav.parameters')}
            </NavLink>
          </nav>
          <div className="ml-auto flex gap-1" role="group" aria-label={t('lang.label')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary"
              aria-pressed={current === 'uk'}
              onClick={() => void i18n.changeLanguage('uk')}
            >
              {t('lang.uk')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary"
              aria-pressed={current === 'en'}
              onClick={() => void i18n.changeLanguage('en')}
            >
              {t('lang.en')}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-5 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
