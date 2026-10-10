"use client"

import { useBill } from "@/components/bill-context"
import { Button } from "@/components/ui/button"
import { isFirebaseConfigured } from "@/lib/firebase"

export function ScanScreen() {
  const bill = useBill()
  const progress = Math.max(0, Math.min(1, bill.scanProgress))
  const indeterminate = progress <= 0 || progress >= 1

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Nota</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">De bon wordt gelezen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isFirebaseConfigured()
            ? "Eerst leest Gemini de producten. Lukt dat niet, dan leest de app de bon op dit toestel."
            : "De bon wordt op dit toestel gelezen. De eerste keer duurt dat iets langer."}
        </p>

        <div className="mx-auto mt-8 w-full max-w-xs overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
          {bill.photoUrl ? (
            // De preview is een data-URL van de zojuist gemaakte foto.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bill.photoUrl} alt="Gefotografeerde rekening" className="max-h-[50dvh] w-full object-contain" />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Foto</div>
          )}
        </div>

        <div className="mt-6" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            {indeterminate ? (
              <div className="nota-indeterminate h-full w-1/3 rounded-full bg-primary" />
            ) : (
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{bill.scanLabel}</p>
        </div>

        <Button type="button" variant="ghost" className="mt-auto h-11 self-start" onClick={bill.cancelScan}>
          Annuleren
        </Button>
      </div>
    </div>
  )
}
