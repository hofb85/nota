"use client"

import { Check, Plus, X } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { useBill } from "@/components/bill-context"
import { TableBanner } from "@/components/table-banner"
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
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatEuros, pieceLabel, unitPriceCents } from "@/lib/money"
import { isItemComplete, remainingUnits, summarize } from "@/lib/split"
import type { BillItem, Person } from "@/lib/types"

export function AssignScreen() {
  const bill = useBill()
  const [name, setName] = useState("")
  const [adding, setAdding] = useState(bill.people.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const summary = useMemo(
    () => summarize(bill.items, bill.people, bill.tipCents),
    [bill.items, bill.people, bill.tipCents],
  )
  const active = bill.people.find((person) => person.id === bill.activePersonId) ?? null
  const editing = bill.items.find((item) => item.id === editingId) ?? null
  const removing = bill.people.find((person) => person.id === removeId) ?? null

  function addPerson(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    bill.dispatch({ type: "add-person", name: trimmed })
    setName("")
    setAdding(false)
  }

  function tapItem(item: BillItem) {
    if (!active) {
      bill.dispatch({ type: "set-hint", hint: "Kies eerst een persoon." })
      setAdding(true)
      return
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8)
    bill.dispatch({ type: "give-unit", itemId: item.id, personId: active.id })
  }

  return (
    <div className="min-h-dvh pb-40 md:pb-8">
      <ScreenHeader
        title="Wie neemt wat?"
        subtitle="Kies een persoon. Tik op een gerecht voor één stuk."
        onBack={() => bill.dispatch({ type: "go-back" })}
      />

      <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-4 md:max-w-3xl md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
        <div>
          <TableBanner localNote className="mb-4" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {bill.people.map((person) => {
              const selected = person.id === active?.id
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => bill.dispatch({ type: "set-active", id: person.id })}
                  className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card pr-3 pl-1.5"
                  style={
                    selected
                      ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${person.color}` }
                      : undefined
                  }
                >
                  <PersonAvatar name={person.name} color={person.color} size="sm" />
                  <span className="font-medium">{person.name}</span>
                </button>
              )
            })}
            {bill.people.length > 0 && !adding ? (
              <button
                type="button"
                className="flex h-12 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm font-medium"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-4" />
                Persoon
              </button>
            ) : null}
          </div>

          {adding || bill.people.length === 0 ? (
            <form onSubmit={addPerson} className="mt-3 flex gap-2">
              <Input
                value={name}
                autoFocus={bill.people.length === 0}
                placeholder="Naam, bijvoorbeeld Sam"
                aria-label="Naam"
                className="h-12 bg-card text-base"
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" className="h-12 px-4">
                Toevoegen
              </Button>
            </form>
          ) : null}

          {active ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card px-3 py-2 ring-1 ring-border">
              <p className="text-sm">
                Je wijst toe aan <span className="font-semibold">{active.name}</span>
              </p>
              <Button type="button" variant="ghost" className="h-9" onClick={() => setRemoveId(active.id)}>
                Verwijder
              </Button>
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-sm">Zet eerst de namen aan tafel.</p>
          )}

          {bill.hint ? (
            <p className="mt-3 text-sm text-clay" role="status">
              {bill.hint}
            </p>
          ) : null}

          <ul className="mt-4 space-y-3">
            {bill.items.map((item) => (
              <AssignItem
                key={item.id}
                item={item}
                people={bill.people}
                active={active}
                onTap={() => tapItem(item)}
                onRest={() => bill.dispatch({ type: "give-rest", itemId: item.id, personId: active?.id ?? null })}
                onTake={(personId) => bill.dispatch({ type: "take-unit", itemId: item.id, personId })}
                onEdit={() => setEditingId(item.id)}
              />
            ))}
          </ul>
        </div>

        <aside className="hidden md:block">
          <SummaryCard
            people={summary.people.map((person) => ({
              id: person.person.id,
              name: person.person.name,
              color: person.person.color,
              cents: person.subtotalCents,
            }))}
            openItemCount={summary.openItemCount}
            total={summary.itemsTotalCents}
            onFill={() => bill.dispatch({ type: "fill-rest" })}
            onSettle={() => bill.dispatch({ type: "go-settle" })}
            canSettle={summary.complete}
          />
        </aside>
      </main>

      <div className="md:hidden">
        <ScreenFooter>
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {summary.openItemCount === 0
              ? "Alles is verdeeld."
              : summary.openItemCount === 1
                ? "Nog 1 gerecht open."
                : `Nog ${summary.openItemCount} gerechten open.`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 bg-card"
              disabled={bill.people.length === 0 || summary.openItemCount === 0}
              onClick={() => bill.dispatch({ type: "fill-rest" })}
            >
              Vul de rest aan
            </Button>
            <Button type="button" className="h-12" disabled={!summary.complete} onClick={() => bill.dispatch({ type: "go-settle" })}>
              Overzicht
            </Button>
          </div>
        </ScreenFooter>
      </div>

      <Sheet open={editing != null} onOpenChange={(open) => !open && setEditingId(null)}>
        {editing ? (
          <ItemSheet
            item={editing}
            people={bill.people}
            onClose={() => setEditingId(null)}
          />
        ) : null}
      </Sheet>

      <Dialog open={removing != null} onOpenChange={(open) => !open && setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{removing ? `${removing.name} verwijderen?` : "Persoon verwijderen?"}</DialogTitle>
            <DialogDescription>De gerechten van deze persoon komen weer vrij.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setRemoveId(null)}>
              Annuleren
            </Button>
            <Button
              type="button"
              className="h-11"
              onClick={() => {
                if (removing) bill.dispatch({ type: "remove-person", id: removing.id })
                setRemoveId(null)
              }}
            >
              Verwijder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssignItem({
  item,
  people,
  active,
  onTap,
  onRest,
  onTake,
  onEdit,
}: {
  item: BillItem
  people: Person[]
  active: Person | null
  onTap: () => void
  onRest: () => void
  onTake: (personId: string) => void
  onEdit: () => void
}) {
  const complete = isItemComplete(item)
  const remaining = remainingUnits(item)
  const holders = people
    .map((person) => ({ person, count: item.shares[person.id] ?? 0 }))
    .filter((entry) => entry.count > 0)

  return (
    <li className={`rounded-2xl bg-card p-3 ring-1 ${complete ? "ring-border" : "ring-clay/70"}`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onTap} className="min-w-0 flex-1 text-left">
          <span className="block font-medium">{item.name}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {item.mode === "shared"
              ? "Samen gedeeld"
              : remaining > 0
                ? `${pieceLabel(item.quantity)} · nog ${remaining} open`
                : pieceLabel(item.quantity)}
          </span>
        </button>
        <div className="text-right">
          <p className="font-mono tabular-nums">{formatEuros(item.lineTotalCents)}</p>
          {complete ? <Check className="mt-1 ml-auto size-4 text-primary" aria-label="Verdeeld" /> : null}
        </div>
      </div>

      {holders.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {holders.map(({ person, count }) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onTake(person.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary pr-2 pl-2 text-sm"
              aria-label={`Haal één stuk ${item.name} weg bij ${person.name}`}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: person.color }} />
              {person.name}
              {item.mode === "units" && count > 1 ? <span className="font-mono">{count}</span> : null}
              <X className="size-3.5 opacity-60" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        {item.mode === "units" && remaining > 0 && active ? (
          <Button type="button" variant="secondary" className="h-10 flex-1" onClick={onRest}>
            Alles voor {active.name}
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="h-10 flex-1 bg-background" onClick={onEdit}>
          Aanpassen
        </Button>
      </div>
    </li>
  )
}

function ItemSheet({
  item,
  people,
  onClose,
}: {
  item: BillItem
  people: Person[]
  onClose: () => void
}) {
  const bill = useBill()
  const remaining = remainingUnits(item)
  const perPiece = unitPriceCents(item.lineTotalCents, item.quantity)

  return (
    <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
      <SheetHeader>
        <SheetTitle className="font-heading text-2xl">{item.name}</SheetTitle>
        <SheetDescription>
          {formatEuros(item.lineTotalCents)} voor {pieceLabel(item.quantity)}
          {perPiece != null ? ` · ${formatEuros(perPiece)} per stuk` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {item.mode === "units" ? (
          <ul className="space-y-2">
            {people.map((person) => {
              const count = item.shares[person.id] ?? 0
              return (
                <li key={person.id} className="flex items-center gap-3">
                  <PersonAvatar name={person.name} color={person.color} size="sm" />
                  <span className="flex-1 font-medium">{person.name}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Minder voor ${person.name}`}
                    disabled={count <= 0}
                    onClick={() => bill.dispatch({ type: "take-unit", itemId: item.id, personId: person.id })}
                  >
                    –
                  </Button>
                  <span className="w-6 text-center font-mono tabular-nums">{count}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Meer voor ${person.name}`}
                    disabled={remaining <= 0}
                    onClick={() => bill.dispatch({ type: "give-unit", itemId: item.id, personId: person.id })}
                  >
                    +
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-2">
            {people.map((person) => {
              const on = (item.shares[person.id] ?? 0) > 0
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const current = people.filter((candidate) => (item.shares[candidate.id] ?? 0) > 0).map((candidate) => candidate.id)
                    const next = on ? current.filter((id) => id !== person.id) : [...current, person.id]
                    bill.dispatch({ type: "set-shared", itemId: item.id, personIds: next })
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-full border px-3"
                  style={on ? { borderColor: person.color, boxShadow: `inset 0 0 0 1px ${person.color}` } : undefined}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: person.color }} />
                  {person.name}
                </button>
              )
            })}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {item.mode === "units"
            ? remaining === 0
              ? "Alle stuks zijn toegewezen."
              : `Nog ${remaining} ${remaining === 1 ? "stuk" : "stuks"} open.`
            : "Iedereen die meedoet, betaalt evenveel van dit gerecht."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() =>
              bill.dispatch({
                type: "set-mode",
                itemId: item.id,
                mode: item.mode === "units" ? "shared" : "units",
              })
            }
          >
            {item.mode === "units" ? "Samen delen" : "Per stuk"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => bill.dispatch({ type: "clear-shares", itemId: item.id })}
          >
            Wissen
          </Button>
        </div>
        <Button type="button" className="h-11 w-full" onClick={onClose}>
          Klaar
        </Button>
      </div>
    </SheetContent>
  )
}

function SummaryCard({
  people,
  openItemCount,
  total,
  onFill,
  onSettle,
  canSettle,
}: {
  people: { id: string; name: string; color: string; cents: number }[]
  openItemCount: number
  total: number
  onFill: () => void
  onSettle: () => void
  canSettle: boolean
}) {
  return (
    <div className="sticky top-24 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="font-heading text-xl">Onderweg</h2>
      <ul className="mt-3 space-y-2">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: person.color }} />
            <span className="flex-1">{person.name}</span>
            <span className="font-mono tabular-nums">{formatEuros(person.cents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        {openItemCount === 0 ? "Alles is verdeeld." : `Nog ${openItemCount} open · ${formatEuros(total)} in totaal`}
      </p>
      <Button type="button" variant="outline" className="mt-3 h-11 w-full" disabled={openItemCount === 0 || people.length === 0} onClick={onFill}>
        Vul de rest aan
      </Button>
      <Button type="button" className="mt-2 h-11 w-full" disabled={!canSettle} onClick={onSettle}>
        Overzicht
      </Button>
    </div>
  )
}
