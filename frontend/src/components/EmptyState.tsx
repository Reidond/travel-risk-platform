import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint: string
  /** Action buttons (CTA funnel). */
  children?: ReactNode
}

export function EmptyState({ title, hint, children }: EmptyStateProps) {
  return (
    <div className="border-border bg-card flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{hint}</p>
      {children !== undefined && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>
      )}
    </div>
  )
}
