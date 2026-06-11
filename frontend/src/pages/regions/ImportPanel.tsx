import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2Icon, ChevronDownIcon, InfoIcon } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '../../api/client'
import { importApi } from '../../api/importApi'
import type { ImportReport, Region } from '../../api/types'
import { ErrorNote } from '../../components/Feedback'
import { useLang, localizedName } from '../../lib/lang'

interface ImportPanelProps {
  regions: Region[]
  /** Open the panel automatically (e.g. when no regions exist yet). */
  defaultOpen?: boolean
}

/** Radix SelectItem values must not be ''; sentinel for the auto-detect option. */
const REGION_AUTO = 'auto'

export function ImportPanel({ regions, defaultOpen = false }: ImportPanelProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  // Derived default: open while there are no regions, until the user toggles.
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? defaultOpen
  const setOpen = setUserOpen
  const [file, setFile] = useState<File | null>(null)
  const [regionId, setRegionId] = useState('') // '' = auto-detect
  const [fileError, setFileError] = useState<string | null>(null)

  const invalidateData = () => {
    void queryClient.invalidateQueries({ queryKey: ['regions'] })
    void queryClient.invalidateQueries({ queryKey: ['respondents'] })
  }

  const importMutation = useMutation({
    mutationFn: ({ file, targetRegionId }: { file: File; targetRegionId: number | null }) =>
      importApi.importFile(file, targetRegionId),
    onSuccess: () => {
      invalidateData()
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    },
  })

  const demoMutation = useMutation({
    mutationFn: importApi.loadDemo,
    onSuccess: invalidateData,
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    demoMutation.reset()
    const chosen = fileRef.current?.files?.[0] ?? file
    if (!chosen) {
      setFileError(t('regions.import.noFile'))
      return
    }
    setFileError(null)
    importMutation.mutate({
      file: chosen,
      targetRegionId: regionId === '' ? null : Number(regionId),
    })
  }

  const demoConflict =
    demoMutation.isError &&
    demoMutation.error instanceof ApiError &&
    demoMutation.error.status === 409

  return (
    <section
      className="bg-card text-card-foreground rounded-xl border p-5 shadow-sm"
      aria-labelledby="import-title"
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="import-title" className="text-lg font-semibold">
            {t('regions.import.title')}
          </h2>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t('regions.import.title')}
            >
              <ChevronDownIcon
                className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
            <div className="flex flex-wrap gap-4">
              <div className="grid flex-1 gap-1.5 min-w-40">
                <Label htmlFor="import-file">{t('regions.import.file')}</Label>
                <Input
                  id="import-file"
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null)
                    setFileError(null)
                  }}
                />
              </div>
              <div className="grid flex-1 gap-1.5 min-w-40">
                <Label htmlFor="import-region">{t('regions.import.targetRegion')}</Label>
                <Select
                  value={regionId === '' ? REGION_AUTO : regionId}
                  onValueChange={(value) => setRegionId(value === REGION_AUTO ? '' : value)}
                >
                  <SelectTrigger id="import-region" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={REGION_AUTO}>{t('regions.import.autoDetect')}</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={String(region.id)}>
                        {localizedName(region, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap justify-start gap-2">
              <Button type="submit" disabled={importMutation.isPending || file === null}>
                {importMutation.isPending
                  ? t('regions.import.importing')
                  : t('regions.import.submit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={demoMutation.isPending}
                onClick={() => {
                  importMutation.reset()
                  setFileError(null)
                  demoMutation.mutate()
                }}
              >
                {demoMutation.isPending
                  ? t('regions.import.demoLoading')
                  : t('regions.import.demo')}
              </Button>
            </div>
          </form>
          <div aria-live="polite" className="mt-4 grid gap-3 empty:hidden">
            {fileError !== null && (
              <p className="text-destructive text-sm" role="alert">
                {fileError}
              </p>
            )}
            {importMutation.isError && <ErrorNote error={importMutation.error} />}
            {demoConflict ? (
              <Alert variant="info" role="status">
                <InfoIcon aria-hidden="true" />
                <AlertDescription>{t('regions.import.demoConflict')}</AlertDescription>
              </Alert>
            ) : (
              demoMutation.isError && <ErrorNote error={demoMutation.error} />
            )}
            {demoMutation.isSuccess && (
              <Alert variant="success" role="status">
                <CheckCircle2Icon aria-hidden="true" />
                <AlertDescription>
                  {t('regions.import.demoDone', { imported: demoMutation.data.imported })}
                </AlertDescription>
              </Alert>
            )}
            {importMutation.isSuccess && <ImportReportView report={importMutation.data} />}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

function ImportReportView({ report }: { report: ImportReport }) {
  const { t } = useTranslation()
  const lang = useLang()
  return (
    <div className="grid gap-3">
      <Alert variant="success" role="status">
        <CheckCircle2Icon aria-hidden="true" />
        <AlertTitle>{t('regions.import.result')}</AlertTitle>
        <AlertDescription>
          <p>
            {t('regions.import.imported')}: <strong>{report.imported}</strong>
            {' · '}
            {t('regions.import.skipped')}: <strong>{report.skipped}</strong>
          </p>
          {report.created_regions.length > 0 && (
            <p>
              {t('regions.import.createdRegions')}:{' '}
              {report.created_regions.map((region) => localizedName(region, lang)).join(', ')}
            </p>
          )}
        </AlertDescription>
      </Alert>
      {report.errors.length > 0 && (
        <Table>
          <TableCaption>{t('regions.import.rowErrors')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-20 text-right">
                {t('regions.import.row')}
              </TableHead>
              <TableHead scope="col">{t('regions.import.message')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.errors.map((error) => (
              <TableRow key={`${error.row}-${error.message}`}>
                <TableCell className="text-right tabular-nums">{error.row}</TableCell>
                <TableCell className="whitespace-normal">{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
