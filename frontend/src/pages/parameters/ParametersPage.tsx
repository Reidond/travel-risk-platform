import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ConfigSection } from './ConfigSection'
import { CriteriaSection } from './CriteriaSection'
import { RulesSection } from './RulesSection'

const TAB_VALUES = ['config', 'rules', 'criteria']

export function ParametersPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = tabParam !== null && TAB_VALUES.includes(tabParam) ? tabParam : 'config'

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t('parameters.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.set('tab', value)
              return next
            },
            { replace: false },
          )
        }}
      >
        <TabsList>
          <TabsTrigger value="config">{t('parameters.config.title')}</TabsTrigger>
          <TabsTrigger value="rules">{t('parameters.rules.title')}</TabsTrigger>
          <TabsTrigger value="criteria">{t('parameters.criteria.title')}</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <ConfigSection />
        </TabsContent>
        <TabsContent value="rules">
          <RulesSection />
        </TabsContent>
        <TabsContent value="criteria">
          <CriteriaSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
