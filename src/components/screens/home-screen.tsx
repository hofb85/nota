"use client"

import { Camera, ImagePlus, ReceiptText } from "lucide-react"
import { useRef, useState } from "react"
import { useBill } from "@/components/bill-context"
import { TableBanner } from "@/components/table-banner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatEuros, itemsTotalCents } from "@/lib/money"

type StartAction = "capture" | "demo" | "manual" | "file"

const STEPS = [
  "Maak een foto van de bon",
  "Controleer aantallen en prijzen",
  "Koppel elk gerecht aan een persoon",
]

export function HomeScreen() {
  const bill = useBill()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<StartAction | null>(null)

  function request(action: StartAction) {
    if (bill.draft) {
      setPending(action)
      return
    }
    void run(action, false)
  }

  async function run(action: StartAction, shouldReset: boolean) {
    setPending(null)
    if (shouldReset) bill.dispatch({ type: "reset" })
    if (action === "capture") bill.dispatch({ type: "start-capture" })
    if (action === "manual") bill.dispatch({ type: "start-manual" })
    if (action === "demo") await bill.scanDemo()
    if (action === "file") fileRef.current?.click()
  }

  const openTotal = itemsTotalCents(bill.items)

  return (
    <div className="flex min-h-dvh flex-col md:grid md:grid-cols-2">
      <section className="bg-ink px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-12 text-paper md:flex md:min-h-dvh md:flex-col md:justify-between md:px-10 md:py-12">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-paper/70 uppercase">Aan tafel</p>
          <h1 className="mt-3 font-heading text-7xl leading-none italic md:text-8xl">Nota</h1>
          <p className="mt-4 max-w-sm text-lg leading-7 text-paper/85">
            Fotografeer de rekening. De gerechten komen in de app, daarna wijs je ze toe.
          </p>
        </div>
        <p className="mt-8 text-sm text-paper/65">De foto blijft op dit toestel.</p>
      </section>

      <section className="-mt-6 flex flex-1 flex-col rounded-t-[2rem] bg-background px-5 pt-7 pb-10 md:mt-0 md:justify-center md:rounded-none md:px-10">
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <TableBanner className="mt-6" />

        {bill.draft ? (
          <button
            type="button"
            onClick={() => bill.dispatch({ type: "resume" })}
            className="mt-6 cursor-pointer rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-border"
          >
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Open rekening
            </span>
            <span className="mt-1 flex items-baseline justify-between gap-3">
              <span className="font-heading text-xl">{bill.venue.trim() || "Nog zonder zaak"}</span>
              <span className="font-mono text-sm tabular-nums">{formatEuros(openTotal)}</span>
            </span>
            <span className="mt-2 block text-sm font-medium text-primary">Verdergaan</span>
          </button>
        ) : null}

        <div className="mt-6 grid gap-3">
          <Button type="button" className="h-12 text-base" onClick={() => request("capture")}>
            <Camera />
            Foto maken
          </Button>
          <Button type="button" variant="outline" className="h-12 bg-card text-base" onClick={() => request("file")}>
            <ImagePlus />
            Kies een foto
          </Button>
          <Button type="button" variant="secondary" className="h-12 text-base" onClick={() => request("demo")}>
            <ReceiptText />
            Probeer de voorbeeldbon
          </Button>
          <button
            type="button"
            className="cursor-pointer py-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => request("manual")}
          >
            Zelf gerechten invoeren
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Kies een foto van de rekening"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void bill.scanFile(file)
          }}
        />
      </section>

      <Dialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe rekening?</DialogTitle>
            <DialogDescription>
              De gerechten en de verdeling die nu openstaan, worden gewist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setPending(null)}>
              Annuleren
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => pending && void run(pending, true)}
            >
              Opnieuw
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
