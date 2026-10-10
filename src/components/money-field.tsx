"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { formatInputCents, parseEuroToCents } from "@/lib/money"

export function MoneyField({
  cents,
  onCommit,
  label,
  className,
}: {
  cents: number
  onCommit: (cents: number) => void
  label: string
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? formatInputCents(cents)

  return (
    <div className={className ?? "relative min-w-0 flex-1"}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        €
      </span>
      <Input
        inputMode="decimal"
        aria-label={label}
        className="h-11 pr-3 pl-8 text-right font-mono text-base tabular-nums"
        value={text}
        onFocus={() => setDraft(formatInputCents(cents))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const parsed = parseEuroToCents(text)
          setDraft(null)
          if (parsed != null) onCommit(parsed)
        }}
      />
    </div>
  )
}
