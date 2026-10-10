"use client"

import { Minus, Plus, Trash } from "lucide-react"
import { useBill } from "@/components/bill-context"
import { MoneyField } from "@/components/money-field"
import { ScreenFooter, ScreenHeader } from "@/components/screen-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatEuros, itemsTotalCents, pieceLabel, receiptGapCents, unitPriceCents } from "@/lib/money"
import type { BillItem } from "@/lib/types"

export function ReviewScreen() {
  const bill = useBill()
  const total = itemsTotalCents(bill.items)
  const gap = receiptGapCents(bill.items, bill.receiptTotalCents)
  const issue = bill.hint ?? bill.reviewIssue

  return (
    <div className="min-h-dvh pb-36">
      <ScreenHeader
        title="Klopt de bon?"
        subtitle="Pas namen, aantallen en prijzen aan. De foto is een hulpmiddel."
        onBack={() => bill.dispatch({ type: "go-back" })}
      />

      <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-4 md:max-w-3xl md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        <div className="space-y-3">
          {bill.scanError ? (
            <p className="rounded-2xl bg-clay/15 px-4 py-3 text-sm" role="status">
              {bill.scanError}
            </p>
          ) : null}
          {bill.notice ? (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm" role="status">
              {bill.notice}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Zaak</span>
            <Input
              value={bill.venue}
              placeholder="Bijvoorbeeld Café De Lantaarn"
              className="h-11 bg-card text-base"
              onChange={(event) => bill.dispatch({ type: "set-venue", venue: event.target.value })}
            />
          </label>

          {bill.items.length === 0 ? (
            <p className="rounded-2xl bg-card px-4 py-6 text-sm text-muted-foreground ring-1 ring-border">
              Nog geen gerechten. Voeg ze zelf toe.
            </p>
          ) : (
            <ul className="space-y-3">
              {bill.items.map((item, index) => (
                <ReviewItem
                  key={item.id}
                  item={item}
                  index={index}
                  onChange={(patch) => bill.dispatch({ type: "update-item", id: item.id, patch })}
                  onRemove={() => bill.dispatch({ type: "remove-item", id: item.id })}
                />
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full bg-card"
            onClick={() => bill.dispatch({ type: "add-item" })}
          >
            <Plus />
            Gerecht toevoegen
          </Button>

          {gap != null && gap > 0 ? (
            <div className="rounded-2xl bg-clay/15 px-4 py-3 text-sm">
              <p>
                Op de bon staat {formatEuros(bill.receiptTotalCents ?? 0)}, de gerechten tellen op tot{" "}
                {formatEuros(total)}.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-10 bg-card"
                onClick={() => bill.dispatch({ type: "add-gap-item" })}
              >
                Voeg het verschil toe
              </Button>
            </div>
          ) : null}
          {gap != null && gap < 0 ? (
            <p className="rounded-2xl bg-clay/15 px-4 py-3 text-sm" role="status">
              De gerechten zijn samen {formatEuros(Math.abs(gap))} meer dan het totaal op de bon. Kijk de prijzen na.
            </p>
          ) : null}
          {gap === 0 ? (
            <p className="text-sm text-muted-foreground">De som komt overeen met het totaal op de bon.</p>
          ) : null}

          {bill.rawText ? (
            <details className="rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border">
              <summary className="cursor-pointer font-medium">Gelezen tekst</summary>
              <pre className="mt-3 max-h-48 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap text-muted-foreground">
                {bill.rawText}
              </pre>
            </details>
          ) : null}
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-24 space-y-3">
            {bill.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bill.photoUrl}
                alt="Foto van de rekening"
                className="max-h-80 w-full rounded-2xl bg-card object-contain ring-1 ring-border"
              />
            ) : null}
            <TotalCard total={total} count={bill.items.length} />
          </div>
        </aside>
      </main>

      <ScreenFooter>
        {issue ? (
          <p className="mb-2 text-sm text-clay" role="status">
            {issue}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{bill.items.length === 1 ? "1 gerecht" : `${bill.items.length} gerechten`}</p>
            <p className="font-mono text-lg tabular-nums">{formatEuros(total)}</p>
          </div>
          <Button
            type="button"
            className="h-12 px-5 text-base"
            disabled={bill.reviewIssue != null}
            onClick={() => bill.dispatch({ type: "go-assign" })}
          >
            Verdelen
          </Button>
        </div>
      </ScreenFooter>
    </div>
  )
}

function ReviewItem({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: BillItem
  index: number
  onChange: (patch: Partial<Pick<BillItem, "name" | "quantity" | "lineTotalCents">>) => void
  onRemove: () => void
}) {
  const perPiece = unitPriceCents(item.lineTotalCents, item.quantity)

  return (
    <li className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <div className="flex items-start gap-2">
        <Input
          value={item.name}
          aria-label={`Naam van gerecht ${index + 1}`}
          placeholder="Naam van het gerecht"
          className="h-11 bg-background text-base"
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Verwijder ${item.name || "gerecht"}`}
          onClick={onRemove}
        >
          <Trash />
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-11 items-center rounded-lg border border-input bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Aantal verminderen"
            disabled={item.quantity <= 1}
            onClick={() => onChange({ quantity: item.quantity - 1 })}
          >
            <Minus />
          </Button>
          <span className="w-8 text-center font-mono text-sm tabular-nums">{item.quantity}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Aantal verhogen"
            disabled={item.quantity >= 99}
            onClick={() => onChange({ quantity: item.quantity + 1 })}
          >
            <Plus />
          </Button>
        </div>
        <MoneyField
          cents={item.lineTotalCents}
          label={`Bedrag van ${item.name || `gerecht ${index + 1}`}`}
          onCommit={(cents) => onChange({ lineTotalCents: cents })}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {pieceLabel(item.quantity)}
        {perPiece != null ? ` · ${formatEuros(perPiece)} per stuk` : " · totaalbedrag van de lijn"}
      </p>
    </li>
  )
}

function TotalCard({ total, count }: { total: number; count: number }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
      <p className="text-xs text-muted-foreground">{count === 1 ? "1 gerecht" : `${count} gerechten`}</p>
      <p className="font-mono text-2xl tabular-nums">{formatEuros(total)}</p>
    </div>
  )
}
