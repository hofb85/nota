import { createInitialState } from "@/lib/bill-reducer"
import type { BillItem, BillState, Person, ResumeStep, Step } from "@/lib/types"

const STORAGE_KEY = "nota.bill.v1"

type PersistedBill = {
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
  const step = state.step === "scan" || state.step === "capture" ? state.resumeStep : state.step
  return {
    version: 1,
    step,
    resumeStep: state.resumeStep,
    venue: state.venue,
    items: state.items,
    people: state.people,
    activePersonId: state.activePersonId,
    tipCents: state.tipCents,
    rawText: state.rawText,
    receiptTotalCents: state.receiptTotalCents,
  }
}

export function saveBill(state: BillState): void {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(state)))
  } catch {
    // De foto blijft buiten de opslag. Een volle browseropslag mag de verdeling niet blokkeren.
  }
}

export function loadBill(): BillState | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return revive(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearBill(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

function revive(value: unknown): BillState | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<PersistedBill>
  if (record.version !== 1 || !Array.isArray(record.items) || !Array.isArray(record.people)) {
    return null
  }

  const items = record.items.filter(isItem)
  const people = record.people.filter(isPerson)
  const activePersonId = people.some((person) => person.id === record.activePersonId)
    ? (record.activePersonId ?? null)
    : (people[0]?.id ?? null)
  const step = isStep(record.step) ? record.step : "home"
  const resumeStep = isResumeStep(record.resumeStep) ? record.resumeStep : "review"
  const base = createInitialState()

  return {
    ...base,
    step: step === "capture" || step === "scan" ? "review" : step,
    resumeStep,
    venue: typeof record.venue === "string" ? record.venue.slice(0, 60) : "",
    items,
    people,
    activePersonId,
    tipCents: typeof record.tipCents === "number" ? Math.max(0, Math.round(record.tipCents)) : 0,
    rawText: typeof record.rawText === "string" ? record.rawText.slice(0, 20_000) : "",
    receiptTotalCents:
      typeof record.receiptTotalCents === "number" ? Math.round(record.receiptTotalCents) : null,
  }
}

function isItem(value: unknown): value is BillItem {
  if (!value || typeof value !== "object") return false
  const item = value as BillItem
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.quantity === "number" &&
    typeof item.lineTotalCents === "number" &&
    (item.mode === "units" || item.mode === "shared") &&
    !!item.shares &&
    typeof item.shares === "object"
  )
}

function isPerson(value: unknown): value is Person {
  if (!value || typeof value !== "object") return false
  const person = value as Person
  return typeof person.id === "string" && typeof person.name === "string" && typeof person.color === "string"
}

function isStep(value: unknown): value is Step {
  return value === "home" || value === "capture" || value === "scan" || value === "review" || value === "assign" || value === "settle"
}

function isResumeStep(value: unknown): value is ResumeStep {
  return value === "review" || value === "assign" || value === "settle"
}
