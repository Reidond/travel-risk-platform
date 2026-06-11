import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { criteriaApi } from '../../api/criteria'
import { rulesetsApi } from '../../api/rulesets'
import {
  RISK_TERMS,
  type RiskTerm,
  type Rule,
  type RuleSetVersion,
} from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorNote, Loading } from '../../components/Feedback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MAX_RULES = 10
const TERM_LEVELS = [1, 2, 3, 4, 5] as const

export function RulesSection() {
  const { t } = useTranslation()
  const activeQuery = useQuery({ queryKey: ['ruleset'], queryFn: rulesetsApi.active })
  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })
  const groupCount = criteriaQuery.data?.groups.length ?? 3

  return (
    <section
      className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
      aria-labelledby="rules-title"
    >
      <h2 id="rules-title" className="text-lg font-semibold mb-3">
        {t('parameters.rules.title')}
      </h2>
      <p className="text-muted-foreground text-sm mb-4">{t('parameters.rules.intro')}</p>
      {activeQuery.isPending && <Loading />}
      {activeQuery.isError && <ErrorNote error={activeQuery.error} />}
      {activeQuery.isSuccess && (
        <RuleBuilder
          key={activeQuery.data.version}
          initial={activeQuery.data}
          groupCount={groupCount}
        />
      )}
    </section>
  )
}

function RuleBuilder({ initial, groupCount }: { initial: RuleSetVersion; groupCount: number }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rules, setRules] = useState<Rule[]>(() =>
    initial.rules.map((rule) => ({ pattern: [...rule.pattern], output: rule.output })),
  )
  const [defaultOutput, setDefaultOutput] = useState<RiskTerm>(initial.default_output)
  const [comment, setComment] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ruleset'] })
    void queryClient.invalidateQueries({ queryKey: ['rulesets'] })
  }

  const saveMutation = useMutation({
    mutationFn: rulesetsApi.create,
    onSuccess: (data) => {
      toast.success(t('parameters.rules.saved', { version: data.version }))
      invalidate()
    },
  })

  const resetMutation = useMutation({
    mutationFn: rulesetsApi.resetDefault,
    onSuccess: () => {
      setResetConfirmOpen(false)
      toast.success(t('toast.rulesReset'))
      invalidate()
    },
  })

  const updateRule = (index: number, updater: (rule: Rule) => Rule) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? updater(rule) : rule)))
  }

  const moveRule = (index: number, direction: -1 | 1) => {
    setRules((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const a = next[index]
      const b = next[target]
      if (!a || !b) return prev
      next[index] = b
      next[target] = a
      return next
    })
  }

  const ruleSentence = (rule: Rule): string => {
    const counts = new Map<number, number>()
    for (const level of [...rule.pattern].sort((a, b) => b - a)) {
      counts.set(level, (counts.get(level) ?? 0) + 1)
    }
    const clauses = [...counts.entries()].map(([level, count]) =>
      t('parameters.rules.clause', { count, level }),
    )
    return `${t('parameters.rules.if')} ${clauses.join(` ${t('parameters.rules.and')} `)} ${t(
      'parameters.rules.then',
    )} ${t(`terms.${rule.output}`)}`
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (rules.length < 1 || rules.length > MAX_RULES) {
      setFormError(t('validation.rulesCount'))
      return
    }
    if (rules.some((rule) => rule.pattern.length === 0 || rule.pattern.length > groupCount)) {
      setFormError(t('validation.patternLength', { max: groupCount }))
      return
    }
    setFormError(null)
    saveMutation.mutate({
      rules,
      default_output: defaultOutput,
      comment: comment.trim() === '' ? null : comment.trim(),
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* list-none strips list semantics in VoiceOver — restore them explicitly */}
      <ol className="list-none space-y-3" role="list">
        {rules.map((rule, index) => (
          <li key={index} role="listitem" className="rounded-lg border bg-muted/40 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <strong>{t('parameters.rules.rule', { index: index + 1 })}</strong>
              <span className="text-muted-foreground text-sm">{ruleSentence(rule)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {rule.pattern.map((level, slotIndex) => {
                  const id = `rule-${index}-slot-${slotIndex}`
                  return (
                    <span
                      key={id}
                      className="bg-card inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5"
                    >
                      <label className="sr-only" htmlFor={id}>
                        {t('parameters.rules.slotLevel', { index: slotIndex + 1 })}
                      </label>
                      <select
                        id={id}
                        className="border-none bg-transparent text-sm py-0.5 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        value={level}
                        onChange={(e) =>
                          updateRule(index, (current) => ({
                            ...current,
                            pattern: current.pattern.map((l, i) =>
                              i === slotIndex ? Number(e.target.value) : l,
                            ),
                          }))
                        }
                      >
                        {TERM_LEVELS.map((value) => (
                          <option key={value} value={value}>
                            ≥ T{value}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={rule.pattern.length <= 1}
                        aria-label={t('parameters.rules.removeSlot', { index: slotIndex + 1 })}
                        onClick={() =>
                          updateRule(index, (current) => ({
                            ...current,
                            pattern: current.pattern.filter((_, i) => i !== slotIndex),
                          }))
                        }
                      >
                        <XIcon aria-hidden="true" />
                      </Button>
                    </span>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rule.pattern.length >= groupCount}
                  onClick={() =>
                    updateRule(index, (current) => ({
                      ...current,
                      pattern: [...current.pattern, 1],
                    }))
                  }
                >
                  {t('parameters.rules.addSlot')}
                </Button>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`rule-${index}-output`}>
                  {t('parameters.rules.output', { index: index + 1 })}
                </Label>
                <Select
                  value={rule.output}
                  onValueChange={(value) =>
                    updateRule(index, (current) => ({
                      ...current,
                      output: value as RiskTerm,
                    }))
                  }
                >
                  <SelectTrigger id={`rule-${index}-output`} size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_TERMS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term} — {t(`terms.${term}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  aria-label={t('common.moveUp')}
                  onClick={() => moveRule(index, -1)}
                >
                  <ArrowUpIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === rules.length - 1}
                  aria-label={t('common.moveDown')}
                  onClick={() => moveRule(index, 1)}
                >
                  <ArrowDownIcon aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline-destructive"
                  size="sm"
                  disabled={rules.length <= 1}
                  aria-label={t('parameters.rules.removeRule', { index: index + 1 })}
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex justify-start gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={rules.length >= MAX_RULES}
          onClick={() => setRules((prev) => [...prev, { pattern: [3], output: 'H' }])}
        >
          {t('parameters.rules.addRule')}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <div className="grid gap-1.5 flex-1 min-w-40">
          <Label htmlFor="default-output">{t('parameters.rules.defaultOutput')}</Label>
          <Select
            value={defaultOutput}
            onValueChange={(value) => setDefaultOutput(value as RiskTerm)}
          >
            <SelectTrigger id="default-output" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_TERMS.map((term) => (
                <SelectItem key={term} value={term}>
                  {term} — {t(`terms.${term}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5 flex-1 min-w-40">
          <Label htmlFor="ruleset-comment">{t('common.comment')}</Label>
          <Input
            id="ruleset-comment"
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>

      {formError !== null && (
        <p className="text-destructive text-sm mt-3" role="alert">
          {formError}
        </p>
      )}
      {saveMutation.isError && (
        <div className="mt-3">
          <ErrorNote error={saveMutation.error} />
        </div>
      )}
      {resetMutation.isError && (
        <div className="mt-3">
          <ErrorNote error={resetMutation.error} />
        </div>
      )}

      <div className="mt-4 flex justify-start gap-2">
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={resetMutation.isPending}
          onClick={() => setResetConfirmOpen(true)}
        >
          {t('parameters.rules.reset')}
        </Button>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title={t('confirm.resetRulesTitle')}
        description={t('confirm.resetRulesBody')}
        confirmLabel={t('parameters.rules.reset')}
        pendingLabel={t('common.saving')}
        onConfirm={() => resetMutation.mutate()}
        isPending={resetMutation.isPending}
      />
    </form>
  )
}
