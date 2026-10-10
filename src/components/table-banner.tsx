"use client"

import { Link2 } from "lucide-react"
import { useState } from "react"
import { useBill } from "@/components/bill-context"
import { Button } from "@/components/ui/button"
import { isFirebaseConfigured } from "@/lib/firebase"
import { cn } from "@/lib/utils"

export function TableBanner({ localNote = false, className }: { localNote?: boolean; className?: string }) {
  const bill = useBill()
  const [note, setNote] = useState<string | null>(null)
  const configured = isFirebaseConfigured()
  const offline = configured && bill.cloud === "offline"
  const message = offline
    ? "Geen verbinding. Wijzigingen blijven op dit toestel tot de verbinding terug is."
    : bill.tableLink
      ? "Live gedeeld. Iedereen met de link ziet dezelfde verdeling."
      : localNote && !configured
        ? "Deze verdeling blijft op dit toestel."
        : null

  if (!message && !bill.tableLink) return null

  async function share() {
    const result = await bill.shareMessage("We verdelen de rekening in Nota.")
    if (result === "copied") flash("Link gekopieerd")
    if (result === "failed") flash("Delen lukt niet op dit toestel.")
  }

  function flash(text: string) {
    setNote(text)
    window.setTimeout(() => setNote(null), 2200)
  }

  return (
    <div className={cn("rounded-2xl bg-card px-4 py-3 ring-1 ring-border", className)}>
      {message ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {message}
        </p>
      ) : null}
      {bill.tableLink ? (
        <>
          <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{bill.tableLink}</p>
          <Button type="button" variant="outline" className="mt-3 h-10 w-full bg-background" onClick={() => void share()}>
            <Link2 />
            Deel de tafel
          </Button>
        </>
      ) : null}
      {note ? (
        <p className="mt-2 text-sm font-medium" role="status">
          {note}
        </p>
      ) : null}
    </div>
  )
}
