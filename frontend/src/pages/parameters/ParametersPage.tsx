import { useTranslation } from 'react-i18next'

import { ConfigSection } from './ConfigSection'
import { CriteriaSection } from './CriteriaSection'
import { RulesSection } from './RulesSection'

export function ParametersPage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <h1>{t('parameters.title')}</h1>
      <ConfigSection />
      <RulesSection />
      <CriteriaSection />
    </div>
  )
}
