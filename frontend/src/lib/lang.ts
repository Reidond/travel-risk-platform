import { useTranslation } from 'react-i18next'

import type { Lang } from '../api/types'

/** Current UI language narrowed to the two supported values (uk default). */
export function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.resolvedLanguage === 'en' ? 'en' : 'uk'
}

/** Bilingual entity name per the current language. */
export function localizedName(
  entity: { name_uk: string; name_en: string },
  lang: Lang,
): string {
  return lang === 'en' ? entity.name_en : entity.name_uk
}
