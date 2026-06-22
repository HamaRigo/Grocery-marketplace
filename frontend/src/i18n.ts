import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ar from './locales/ar.json'

const RTL_LANGS = new Set(['ar'])

function applyDirection(lang: string) {
  const isRtl = RTL_LANGS.has(lang)
  document.documentElement.dir  = isRtl ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

const savedLang = localStorage.getItem('lang') ?? 'en'
applyDirection(savedLang)

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', applyDirection)

export default i18n
