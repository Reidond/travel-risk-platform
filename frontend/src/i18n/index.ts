import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import uk from './uk.json'

export const LANG_STORAGE_KEY = 'travel-risk-lang'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uk: { translation: uk },
      en: { translation: en },
    },
    fallbackLng: 'uk',
    supportedLngs: ['uk', 'en'],
    detection: {
      // uk is the product default; only an explicit user choice overrides it.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: LANG_STORAGE_KEY,
    },
    interpolation: { escapeValue: false },
  })

export default i18n
