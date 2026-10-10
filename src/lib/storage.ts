import { createInitialState } from "@/lib/bill-reducer"
import { isTableId } from "@/lib/table"
import type { BillItem, BillState, Person, ResumeStep, Step } from "@/lib/types"

const STORAGE_KEY = "nota.bill.v1"
const TABLE_KEY = "nota.table.v1"
const MAX_ITEMS = 80
const MAX_PEOPLE = 12

export type PersistedBill = {
  version: 1
  step: Step
  resumeStep: ResumeStep
  venue: string
  items: BillItem[]
  people: Person[]
  activePersonId: string | null
  tipCents: number
  rawText: string
  receiptTotalCents: number | null
}

export function persistable(state: BillState): PersistedBill {
  const people = state.people.slice(0, MAX_PEOPLE).map(sanitizePerson).filter((person) => person != null)
  const items = state.items.slice(0, MAX_ITEMS).map(sanitizeItem).filter((item) => item != null)
  const step = storedStep(state.step === "scan" || state.step === "capture" ? state.resumeStep : state.step)
  return {
    version: 1,
    step,
    resumeStep: isResumeStep(state.resumeStep) ? state.resumeStep : "review",
    venue: state.venue.slice(0, 60),
    items,
    people,
    activePersonId: activeId(state.activePersonId, people),
    tipCents: clamp(state.tipCents, 0, 50_000),
    rawText: state.rawText.slice(0, 20_000),
    receiptTotalCents:
      typeof state.receiptTotalCents === "number" && Number.isFinite(state.receiptTotalCents)
        ? clamp(state.receiptTotalCents, 0, 100_000_000)
        : null,
  }
}

export function toRemoteBill(state: BillState, updatedAt: number): PersistedBill & { updatedAt: number } {
  return { ...persistable(state), updatedAt: clamp(updatedAt, 1, Number.MAX_SAFE_INTEGER) }
}

export function revive(value: unknown): BillState | null {
  const bill = persistedFromUnknown(value)
  if (!bill) return null
  const base = createInitialState()
  return {
    ...base,
    step: bill.step,
    resumeStep: bill.resumeStep,
    venue: bill.venue,
    items: bill.items,
    people: bill.people,
    activePersonId: bill.activePersonId,
    tipCents: bill.tipCents,
    rawText: bill.rawText,
    receiptTotalCents: bill.receiptTotalCents,
  }
}

export function readUpdatedAt(value: unknown): number {
  if (!value || typeof value !== "object") return 0
  const stamp = (value as { updatedAt?: unknown }).updatedAt
  return typeof stamp === "number" && Number.isFinite(stamp) ? Math.round(stamp) : 0
}

export function saveBill(state: BillState, tableId: string | null = null, updatedAt = Date.now()): void {
  if (typeof localStorage === "undefined") return
  try {
    const payload = JSON.stringify({ ...persistable(state), updatedAt })
    localStorage.setItem(STORAGE_KEY, payload)
    if (tableId && isTableId(tableId)) localStorage.setItem(billKey(tableId), payload)
  } catch {
    // Een volle browseropslag mag de verdeling niet blokkeren. De foto blijft erbuiten.
  }
}

export function loadBill(tableId: string | null = null): BillState | null {
  return loadStoredBill(tableId)?.state ?? null
}

export function loadStoredBill(tableId: string | null = null): { state: BillState; updatedAt: number } | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(tableId && isTableId(tableId) ? billKey(tableId) : STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const state = revive(parsed)
    if (!state) return null
    return { state, updatedAt: readUpdatedAt(parsed) }
  } catch {
    return null
  }
}

export function clearBill(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function rememberTableId(id: string | null): void {
  if (typeof localStorage === "undefined") return
  if (id && isTableId(id)) localStorage.setItem(TABLE_KEY, id)
  else localStorage.removeItem(TABLE_KEY)
}

export function rememberedTableId(): string | null {
  if (typeof localStorage === "undefined") return null
  const id = localStorage.getItem(TABLE_KEY)
  return id && isTableId(id) ? id : null
}

function billKey(tableId: string): string {
  return `${STORAGE_KEY}:${tableId}`
}

function persistedFromUnknown(value: unknown): PersistedBill | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<PersistedBill>
  if (record.version !== 1 || !Array.isArray(record.items) || !Array.isArray(record.people)) return null
  const people = record.people.slice(0, MAX_PEOPLE).map(sanitizePerson).filter((person) => person != null)
  const items = record.items.slice(0, MAX_ITEMS).map(sanitizeItem).filter((item) => item != null)
  return {
    version: 1,
    step: storedStep(record.step),
    resumeStep: isResumeStep(record.resumeStep) ? record.resumeStep : "review",
    venue: typeof record.venue === "string" ? record.venue.slice(0, 60) : "",
    items,
    people,
    activePersonId: activeId(record.activePersonId, people),
    tipCents: typeof record.tipCents === "number" ? clamp(record.tipCents, 0, 50_000) : 0,
    rawText: typeof record.rawText === "string" ? record.rawText.slice(0, 20_000) : "",
    receiptTotalCents:
      typeof record.receiptTotalCents === "number" && Number.isFinite(record.receiptTotalCents)
        ? clamp(record.receiptTotalCents, 0, 100_000_000)
        : null,
  }
}

function sanitizeItem(value: unknown): BillItem | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<BillItem>
  if (typeof item.id !== "string" || item.id.length === 0 || item.id.length > 80) return null
  if (item.mode !== "units" && item.mode !== "shared") return null
  return {
    id: item.id,
    name: typeof item.name === "string" ? item.name.slice(0, 80) : "",
    quantity: typeof item.quantity === "number" ? clamp(item.quantity, 1, 99) : 1,
    lineTotalCents: typeof item.lineTotalCents === "number" ? clamp(item.lineTotalCents, 0, 1_000_000) : 0,
    mode: item.mode,
    shares: sanitizeShares(item.shares),
  }
}

function sanitizePerson(value: unknown): Person | null {
  if (!value || typeof value !== "object") return null
  const person = value as Partial<Person>
  if (typeof person.id !== "string" || person.id.length === 0 || person.id.length > 80) return null
  if (typeof person.name !== "string" || person.name.trim().length === 0) return null
  return {
    id: person.id,
    name: person.name.trim().replace(/\s+/g, " ").slice(0, 24),
    color: typeof person.color === "string" ? person.color.slice(0, 32) : "#1c3329",
  }
}

function sanitizeShares(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {}
  const shares: Record<string, number> = {}
  for (const [id, count] of Object.entries(value as Record<string, unknown>)) {
    if (id.length === 0 || id.length > 80) continue
    if (typeof count !== "number" || !Number.isFinite(count)) continue
    const rounded = Math.round(count)
    if (rounded <= 0 || rounded > 99) continue
    shares[id] = rounded
  }
  return shares
}

function activeId(value: unknown, people: Person[]): string | null {
  if (typeof value === "string" && people.some((person) => person.id === value)) return value
  return people[0]?.id ?? null
}

function storedStep(value: unknown): Step {
  const step = isStep(value) ? value : "home"
  return step === "capture" || step === "scan" ? "review" : step
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function isStep(value: unknown): value is Step {
  return value === "home" || value === "capture" || value === "scan" || value === "review" || value === "assign" || value === "settle"
}

function isResumeStep(value: unknown): value is ResumeStep {
  return value === "review" || value === "assign" || value === "settle"
}
