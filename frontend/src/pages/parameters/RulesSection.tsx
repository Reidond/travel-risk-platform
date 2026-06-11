import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { criteriaApi } from '../../api/criteria'
import { rulesetsApi } from '../../api/rulesets'
import {
  RISK_TERMS,
  type RiskTerm,
  type Rule,
  type RuleSetVersion,
} from '../../api/types'
import { ErrorNote, Loading } from '../../components/Feedback'

const MAX_RULES = 10
const TERM_LEVELS = [1, 2, 3, 4, 5] as const

export function RulesSection() {
  const { t } = useTranslation()
  const activeQuery = useQuery({ queryKey: ['ruleset'], queryFn: rulesetsApi.active })
  const criteriaQuery = useQuery({ queryKey: ['criteria'], queryFn: criteriaApi.get })
  const groupCount = criteriaQuery.data?.groups.length ?? 3

  return (
    <section className="panel-card" aria-labelledby="rules-title">
      <h2 id="rules-title">{t('parameters.rules.title')}</h2>
      <p className="muted">{t('parameters.rules.intro')}</p>
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
  const [savedVersion, setSavedVersion] = useState<number | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ruleset'] })
    void queryClient.invalidateQueries({ queryKey: ['rulesets'] })
  }

  const saveMutation = useMutation({
    mutationFn: rulesetsApi.create,
    onSuccess: (data) => {
      setSavedVersion(data.version)
      invalidate()
    },
  })

  const resetMutation = useMutation({
    mutationFn: rulesetsApi.resetDefault,
    onSuccess: invalidate,
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
    setSavedVersion(null)
    saveMutation.mutate({
      rules,
      default_output: defaultOutput,
      comment: comment.trim() === '' ? null : comment.trim(),
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <ol className="rule-list">
        {rules.map((rule, index) => (
          <li key={index} className="rule-row">
            <div className="rule-row-head">
              <strong>{t('parameters.rules.rule', { index: index + 1 })}</strong>
              <span className="rule-sentence">{ruleSentence(rule)}</span>
            </div>
            <div className="rule-row-controls">
              <div className="rule-slots">
                {rule.pattern.map((level, slotIndex) => {
                  const id = `rule-${index}-slot-${slotIndex}`
                  return (
                    <span key={id} className="rule-slot">
                      <label className="visually-hidden" htmlFor={id}>
                        {t('parameters.rules.slotLevel', { index: slotIndex + 1 })}
                      </label>
                      <select
                        id={id}
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
                      <button
                        type="button"
                        className="btn btn-icon"
                        disabled={rule.pattern.length <= 1}
                        aria-label={t('parameters.rules.removeSlot', { index: slotIndex + 1 })}
                        onClick={() =>
                          updateRule(index, (current) => ({
                            ...current,
                            pattern: current.pattern.filter((_, i) => i !== slotIndex),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={rule.pattern.length >= groupCount}
                  onClick={() =>
                    updateRule(index, (current) => ({
                      ...current,
                      pattern: [...current.pattern, 1],
                    }))
                  }
                >
                  {t('parameters.rules.addSlot')}
                </button>
              </div>
              <div className="form-field input-inline">
                <label htmlFor={`rule-${index}-output`}>
                  {t('parameters.rules.output', { index: index + 1 })}
                </label>
                <select
                  id={`rule-${index}-output`}
                  value={rule.output}
                  onChange={(e) =>
                    updateRule(index, (current) => ({
                      ...current,
                      output: e.target.value as RiskTerm,
                    }))
                  }
                >
                  {RISK_TERMS.map((term) => (
                    <option key={term} value={term}>
                      {term} — {t(`terms.${term}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={index === 0}
                  aria-label={t('common.moveUp')}
                  onClick={() => moveRule(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-icon"
                  disabled={index === rules.length - 1}
                  aria-label={t('common.moveDown')}
                  onClick={() => moveRule(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={rules.length <= 1}
                  aria-label={t('parameters.rules.removeRule', { index: index + 1 })}
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="form-actions form-actions-start">
        <button
          type="button"
          className="btn"
          disabled={rules.length >= MAX_RULES}
          onClick={() => setRules((prev) => [...prev, { pattern: [3], output: 'H' }])}
        >
          {t('parameters.rules.addRule')}
        </button>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="default-output">{t('parameters.rules.defaultOutput')}</label>
          <select
            id="default-output"
            value={defaultOutput}
            onChange={(e) => setDefaultOutput(e.target.value as RiskTerm)}
          >
            {RISK_TERMS.map((term) => (
              <option key={term} value={term}>
                {term} — {t(`terms.${term}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ruleset-comment">{t('common.comment')}</label>
          <input
            id="ruleset-comment"
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>

      {formError !== null && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      {saveMutation.isError && <ErrorNote error={saveMutation.error} />}
      {resetMutation.isError && <ErrorNote error={resetMutation.error} />}
      {savedVersion !== null && (
        <p className="alert alert-success" role="status">
          {t('parameters.rules.saved', { version: savedVersion })}
        </p>
      )}

      <div className="form-actions form-actions-start">
        <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('common.saving') : t('common.save')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={resetMutation.isPending}
          onClick={() => resetMutation.mutate()}
        >
          {t('parameters.rules.reset')}
        </button>
      </div>
    </form>
  )
}
