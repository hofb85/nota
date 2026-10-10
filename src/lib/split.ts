import { formatEuros } from "@/lib/money"
import type { BillItem, Person } from "@/lib/types"

export type PersonLine = {
  itemId: string
  label: string
  cents: number
}

export type PersonSummary = {
  person: Person
  lines: PersonLine[]
  subtotalCents: number
  tipCents: number
  totalCents: number
}

export type BillSummary = {
  people: PersonSummary[]
  itemsTotalCents: number
  assignedCents: number
  unassignedCents: number
  tipCents: number
  grandCents: number
  complete: boolean
  openItemCount: number
}

export function sumShares(item: BillItem): number {
  return Object.values(item.shares).reduce((sum, count) => sum + count, 0)
}

export function remainingUnits(item: BillItem): number {
  if (item.mode === "shared") return 0
  return Math.max(0, item.quantity - sumShares(item))
}

export function isItemComplete(item: BillItem): boolean {
  if (item.mode === "shared") {
    return Object.values(item.shares).some((count) => count > 0)
  }
  return sumShares(item) === item.quantity
}

export function splitCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const total = Math.max(0, Math.round(totalCents))
  const safeWeights = weights.map((weight) => Math.max(0, weight))
  const sum = safeWeights.reduce((acc, weight) => acc + weight, 0)
  if (sum <= 0 || total === 0) return safeWeights.map(() => 0)

  const raw = safeWeights.map((weight) => (total * weight) / sum)
  const floors = raw.map((amount) => Math.floor(amount))
  let left = total - floors.reduce((acc, amount) => acc + amount, 0)
  const order = raw
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (const entry of order) {
    if (left <= 0) break
    floors[entry.index] += 1
    left -= 1
  }

  return floors
}

export function distributeRemaining(counts: number[], remaining: number): number[] {
  const next = counts.map((count) => Math.max(0, count))
  let left = Math.max(0, remaining)
  if (next.length === 0) return next

  while (left > 0) {
    let index = 0
    for (let cursor = 1; cursor < next.length; cursor += 1) {
      if (next[cursor] < next[index]) index = cursor
    }
    next[index] += 1
    left -= 1
  }

  return next
}

export function allocationForItem(
  item: BillItem,
  people: Person[],
): { personId: string; cents: number }[] {
  if (item.mode === "shared") {
    const included = people.filter((person) => (item.shares[person.id] ?? 0) > 0)
    const parts = splitCents(
      item.lineTotalCents,
      included.map(() => 1),
    )
    return included.map((person, index) => ({ personId: person.id, cents: parts[index] ?? 0 }))
  }

  const weights = people.map((person) => item.shares[person.id] ?? 0)
  const assigned = weights.reduce((sum, weight) => sum + weight, 0)
  const unassigned = Math.max(0, item.quantity - assigned)
  const parts = splitCents(item.lineTotalCents, [...weights, unassigned])
  return people.map((person, index) => ({ personId: person.id, cents: parts[index] ?? 0 }))
}

export function lineLabel(item: BillItem, share: number): string {
  if (item.mode === "shared") return `${item.name} · gedeeld`
  if (share === item.quantity) {
    return item.quantity > 1 ? `${item.quantity}× ${item.name}` : item.name
  }
  return `${share}× ${item.name}`
}

export function summarize(items: BillItem[], people: Person[], tipCents: number): BillSummary {
  const safeTip = Math.max(0, Math.round(tipCents))
  const itemsTotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0)
  const drafts = people.map((person) => {
    const lines: PersonLine[] = []
    for (const item of items) {
      const share = item.shares[person.id] ?? 0
      if (share <= 0) continue
      const cents = allocationForItem(item, people).find((entry) => entry.personId === person.id)?.cents ?? 0
      if (cents <= 0) continue
      lines.push({ itemId: item.id, label: lineLabel(item, share), cents })
    }
    const subtotalCents = lines.reduce((sum, line) => sum + line.cents, 0)
    return { person, lines, subtotalCents }
  })

  const weights = drafts.map((draft) => draft.subtotalCents)
  const tipWeights = weights.some((weight) => weight > 0) ? weights : drafts.map(() => 1)
  const tips = splitCents(safeTip, tipWeights)
  const summaries: PersonSummary[] = drafts.map((draft, index) => ({
    ...draft,
    tipCents: tips[index] ?? 0,
    totalCents: draft.subtotalCents + (tips[index] ?? 0),
  }))

  const assignedCents = summaries.reduce((sum, person) => sum + person.subtotalCents, 0)
  const openItemCount = items.filter((item) => !isItemComplete(item)).length

  return {
    people: summaries,
    itemsTotalCents,
    assignedCents,
    unassignedCents: itemsTotalCents - assignedCents,
    tipCents: safeTip,
    grandCents: itemsTotalCents + safeTip,
    complete: items.length > 0 && people.length > 0 && openItemCount === 0,
    openItemCount,
  }
}

export function summaryText(venue: string, summary: BillSummary): string {
  const title = venue.trim() || "Rekening"
  const lines = [title, `Rekening ${formatEuros(summary.grandCents)}`, ""]

  for (const person of summary.people) {
    lines.push(`${person.person.name} · ${formatEuros(person.totalCents)}`)
    if (person.lines.length === 0) {
      lines.push("· niets toegewezen")
    } else {
      for (const line of person.lines) {
        lines.push(`· ${line.label}`)
      }
    }
    if (person.tipCents > 0) lines.push(`· fooi ${formatEuros(person.tipCents)}`)
    lines.push("")
  }

  if (summary.tipCents > 0) lines.push(`Inclusief fooi ${formatEuros(summary.tipCents)}`)
  lines.push("Verdeeld met Nota")
  return lines.join("\n").trim()
}
