"use client"

import { Share2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useBill } from "@/components/bill-context"
import { TableBanner } from "@/components/table-banner"
import { MoneyField } from "@/components/money-field"
import { PersonAvatar } from "@/components/person-avatar"
import { ScreenFooter, ScreenHeader } from "@/components/screen-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatEuros } from "@/lib/money"
import { summarize, summaryText } from "@/lib/split"

const TIP_PRESETS = [0, 200, 500, 1000]

export function SettleScreen() {
  const bill = useBill()
  const [note, setNote] = useState<string | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)
  const summary = useMemo(
    () => summarize(bill.items, bill.people, bill.tipCents),
    [bill.items, bill.people, bill.tipCents],
  )
  const venue = bill.venue.trim() || "De rekening"

  async function share() {
    const result = await bill.shareMessage(summaryText(venue, summary))
    if (result === "copied") flash("Overzicht gekopieerd")
    if (result === "failed") flash("Delen lukt niet op dit toestel.")
  }

  function flash(text: string) {
    setNote(text)
    window.setTimeout(() => setNote(null), 2200)
  }

  return (
    <div className="min-h-dvh pb-36">
      <ScreenHeader
        title="Klaar om te betalen"
        subtitle={venue}
        onBack={() => bill.dispatch({ type: "go-back" })}
        backLabel="Terug naar verdelen"
      />

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 py-4 md:max-w-3xl">
        <TableBanner localNote />
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <h2 className="font-heading text-xl">Fooi, optioneel</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {TIP_PRESETS.map((cents) => (
              <Button
                key={cents}
                type="button"
                variant={bill.tipCents === cents ? "default" : "outline"}
                className="h-10"
                onClick={() => bill.dispatch({ type: "set-tip", cents })}
              >
                {cents === 0 ? "Geen" : formatEuros(cents)}
              </Button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <MoneyField
              cents={bill.tipCents}
              label="Fooi"
              onCommit={(cents) => bill.dispatch({ type: "set-tip", cents })}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">De fooi volgt ieders deel van de rekening.</p>
        </section>

        <div className="grid gap-3 md:grid-cols-2">
          {summary.people.map((person) => (
            <article key={person.person.id} className="receipt-card rounded-2xl bg-card px-4 py-4 ring-1 ring-border">
              <header className="flex items-center gap-3">
                <PersonAvatar name={person.person.name} color={person.person.color} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-heading text-2xl">{person.person.name}</h2>
                  <p className="text-sm text-muted-foreground">betaalt</p>
                </div>
                <p className="font-mono text-xl tabular-nums">{formatEuros(person.totalCents)}</p>
              </header>
              <ul className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
                {person.lines.length === 0 ? (
                  <li className="text-muted-foreground">Niets toegewezen</li>
                ) : (
                  person.lines.map((line) => (
                    <li key={line.itemId} className="flex justify-between gap-3">
                      <span>{line.label}</span>
                      <span className="shrink-0 font-mono tabular-nums">{formatEuros(line.cents)}</span>
                    </li>
                  ))
                )}
                {person.tipCents > 0 ? (
                  <li className="flex justify-between gap-3 text-muted-foreground">
                    <span>Fooi</span>
                    <span className="font-mono tabular-nums">{formatEuros(person.tipCents)}</span>
                  </li>
                ) : null}
              </ul>
            </article>
          ))}
        </div>

        <p className="text-center font-mono text-sm text-muted-foreground tabular-nums">
          Samen {formatEuros(summary.grandCents)}
          {summary.tipCents > 0 ? ` · waarvan ${formatEuros(summary.tipCents)} fooi` : ""}
        </p>
      </main>

      {note ? (
        <p className="fixed bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper" role="status">
          {note}
        </p>
      ) : null}

      <ScreenFooter>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-12 bg-card" onClick={() => setConfirmNew(true)}>
            Nieuwe rekening
          </Button>
          <Button type="button" className="h-12" onClick={() => void share()}>
            <Share2 />
            Deel overzicht
          </Button>
        </div>
      </ScreenFooter>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe rekening?</DialogTitle>
            <DialogDescription>
              {bill.tableLink
                ? "Op dit toestel begin je opnieuw. Wie de oude link heeft, ziet die rekening nog."
                : "Deze verdeling wordt gewist."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setConfirmNew(false)}>
              Annuleren
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                setConfirmNew(false)
                bill.dispatch({ type: "reset" })
              }}
            >
              Nieuwe rekening
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
