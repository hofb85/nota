import { createId } from "@/lib/ids"
import { nextPersonColor } from "@/lib/people"
import { distributeRemaining, isItemComplete, remainingUnits, sumShares } from "@/lib/split"
import type { BillItem, BillState, ParsedItem, Person, ResumeStep, ShareMode } from "@/lib/types"

export type BillAction =
  | { type: "hydrate"; state: BillState }
  | { type: "reset" }
  | { type: "go-back" }
  | { type: "resume" }
  | { type: "start-capture" }
  | { type: "start-manual" }
  | { type: "begin-scan"; photoUrl: string }
  | { type: "scan-progress"; progress: number; label: string }
  | {
      type: "scan-success"
      venue: string
      items: ParsedItem[]
      rawText: string
      receiptTotalCents: number | null
      notice: string | null
    }
  | { type: "scan-empty"; rawText: string; message: string }
  | { type: "set-venue"; venue: string }
  | { type: "update-item"; id: string; patch: ItemPatch }
  | { type: "add-item" }
  | { type: "remove-item"; id: string }
  | { type: "add-gap-item" }
  | { type: "go-assign" }
  | { type: "go-settle" }
  | { type: "add-person"; name: string }
  | { type: "remove-person"; id: string }
  | { type: "set-active"; id: string }
  | { type: "give-unit"; itemId: string; personId: string | null }
  | { type: "take-unit"; itemId: string; personId: string }
  | { type: "give-rest"; itemId: string; personId: string | null }
  | { type: "set-shared"; itemId: string; personIds: string[] }
  | { type: "set-mode"; itemId: string; mode: ShareMode }
  | { type: "clear-shares"; itemId: string }
  | { type: "fill-rest" }
  | { type: "set-tip"; cents: number }
  | { type: "set-hint"; hint: string | null }
  | { type: "clear-notice" }

type ItemPatch = Partial<Pick<BillItem, "name" | "quantity" | "lineTotalCents">>

export function createInitialState(): BillState {
  return {
    step: "home",
    resumeStep: "review",
    venue: "",
    items: [],
    people: [],
    activePersonId: null,
    tipCents: 0,
    photoUrl: null,
    rawText: "",
    receiptTotalCents: null,
    scanProgress: 0,
    scanLabel: "Bon lezen",
    scanError: null,
    notice: null,
    hint: null,
  }
}

export function hasDraft(state: BillState): boolean {
  if (state.people.length > 0) return true
  if (state.venue.trim()) return true
  return state.items.some((item) => item.name.trim().length > 0 || item.lineTotalCents > 0)
}

export function reviewIssues(items: BillItem[]): string | null {
  if (items.length === 0) return "Voeg minstens één gerecht toe."
  if (items.some((item) => item.name.trim().length < 2)) return "Geef elk gerecht een naam."
  if (items.some((item) => item.lineTotalCents <= 0)) return "Geef elk gerecht een prijs boven nul."
  return null
}

export function billReducer(state: BillState, action: BillAction): BillState {
  switch (action.type) {
    case "hydrate":
      return action.state
    case "reset":
      return createInitialState()
    case "go-back":
      return goBack(state)
    case "resume":
      return resume(state)
    case "start-capture":
      return { ...state, step: "capture", scanError: null, notice: null, hint: null }
    case "start-manual":
      return {
        ...state,
        step: "review",
        resumeStep: "review",
        items: state.items.length > 0 ? state.items : [emptyItem()],
        scanError: null,
        notice: null,
        hint: null,
      }
    case "begin-scan":
      return {
        ...state,
        step: "scan",
        photoUrl: action.photoUrl,
        scanProgress: 0,
        scanLabel: "Lezer starten",
        scanError: null,
        notice: null,
        hint: null,
      }
    case "scan-progress":
      return { ...state, scanProgress: action.progress, scanLabel: action.label }
    case "scan-success":
      return {
        ...state,
        step: "review",
        resumeStep: "review",
        venue: action.venue || state.venue,
        rawText: action.rawText,
        receiptTotalCents: action.receiptTotalCents,
        notice: action.notice,
        scanError: null,
        scanProgress: 1,
        items: action.items.slice(0, 80).map(toBillItem),
      }
    case "scan-empty":
      return {
        ...state,
        step: "review",
        resumeStep: "review",
        rawText: action.rawText,
        scanError: action.message,
        notice: null,
        items: state.items.length > 0 ? state.items : [emptyItem()],
      }
    case "set-venue":
      return { ...state, venue: action.venue.slice(0, 60) }
    case "update-item":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? clampShares(applyPatch(item, action.patch)) : item,
        ),
      }
    case "add-item":
      if (state.items.length >= 80) {
        return { ...state, hint: "Een rekening kan hoogstens 80 gerechten hebben." }
      }
      return { ...state, items: [...state.items, emptyItem()] }
    case "remove-item":
      return { ...state, items: state.items.filter((item) => item.id !== action.id) }
    case "add-gap-item":
      return addGapItem(state)
    case "go-assign": {
      const issue = reviewIssues(state.items)
      if (issue) return { ...state, hint: issue }
      return { ...state, step: "assign", resumeStep: "assign", hint: null }
    }
    case "go-settle":
      if (!canSettle(state)) {
        return { ...state, hint: "Verdeel eerst elk gerecht." }
      }
      return { ...state, step: "settle", resumeStep: "settle", hint: null }
    case "add-person":
      return addPerson(state, action.name)
    case "remove-person":
      return removePerson(state, action.id)
    case "set-active":
      if (!state.people.some((person) => person.id === action.id)) return state
      return { ...state, activePersonId: action.id, hint: null }
    case "give-unit":
      return giveUnit(state, action.itemId, action.personId)
    case "take-unit":
      return takeUnit(state, action.itemId, action.personId)
    case "give-rest":
      return giveRest(state, action.itemId, action.personId)
    case "set-shared":
      return setShared(state, action.itemId, action.personIds)
    case "set-mode":
      return setMode(state, action.itemId, action.mode)
    case "clear-shares":
      return clearShares(state, action.itemId)
    case "fill-rest":
      return fillRest(state)
    case "set-tip":
      return { ...state, tipCents: Math.max(0, Math.min(50_000, Math.round(action.cents))) }
    case "set-hint":
      return { ...state, hint: action.hint }
    case "clear-notice":
      return { ...state, notice: null, scanError: null }
    default:
      return state
  }
}

function goBack(state: BillState): BillState {
  if (state.step === "assign") return { ...state, step: "review", hint: null }
  if (state.step === "settle") return { ...state, step: "assign", hint: null }
  if (state.step === "review") {
    return { ...state, step: "home", resumeStep: "review", hint: null }
  }
  return { ...state, step: "home", hint: null }
}

function resume(state: BillState): BillState {
  if (!hasDraft(state)) return { ...state, step: "home" }
  const target: ResumeStep = state.resumeStep
  if (target === "settle" && canSettle(state)) return { ...state, step: "settle" }
  if ((target === "assign" || target === "settle") && !reviewIssues(state.items)) {
    return { ...state, step: "assign" }
  }
  return { ...state, step: "review" }
}

function canSettle(state: BillState): boolean {
  return (
    state.people.length > 0 &&
    state.items.length > 0 &&
    !reviewIssues(state.items) &&
    state.items.every(isItemComplete)
  )
}

function emptyItem(): BillItem {
  return {
    id: createId(),
    name: "",
    quantity: 1,
    lineTotalCents: 0,
    mode: "units",
    shares: {},
  }
}

function toBillItem(item: ParsedItem): BillItem {
  return {
    id: createId(),
    name: item.name.slice(0, 80),
    quantity: item.quantity,
    lineTotalCents: item.lineTotalCents,
    mode: "units",
    shares: {},
  }
}

function applyPatch(item: BillItem, patch: ItemPatch): BillItem {
  const next: BillItem = { ...item, shares: { ...item.shares } }
  if (patch.name != null) next.name = patch.name.slice(0, 80)
  if (patch.quantity != null) {
    next.quantity = Math.max(1, Math.min(99, Math.round(patch.quantity)))
  }
  if (patch.lineTotalCents != null) {
    next.lineTotalCents = Math.max(0, Math.min(1_000_000, Math.round(patch.lineTotalCents)))
  }
  return next
}

function clampShares(item: BillItem): BillItem {
  if (item.mode === "shared") return item
  let room = item.quantity
  const shares: Record<string, number> = {}
  for (const [personId, count] of Object.entries(item.shares)) {
    if (room <= 0) break
    const next = Math.min(Math.max(0, count), room)
    if (next > 0) shares[personId] = next
    room -= next
  }
  return { ...item, shares }
}

function replaceItem(state: BillState, itemId: string, item: BillItem, hint: string | null = null): BillState {
  return {
    ...state,
    hint,
    items: state.items.map((current) => (current.id === itemId ? item : current)),
  }
}

function addPerson(state: BillState, rawName: string): BillState {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 24)
  if (name.length < 1) return state
  if (state.people.length >= 12) {
    return { ...state, hint: "Twaalf personen is het maximum aan één tafel." }
  }
  const person: Person = {
    id: createId(),
    name,
    color: nextPersonColor(state.people.map((current) => current.color)),
  }
  return {
    ...state,
    people: [...state.people, person],
    activePersonId: person.id,
    hint: null,
  }
}

function removePerson(state: BillState, personId: string): BillState {
  const people = state.people.filter((person) => person.id !== personId)
  return {
    ...state,
    people,
    activePersonId:
      state.activePersonId === personId ? (people[0]?.id ?? null) : state.activePersonId,
    items: state.items.map((item) => {
      if (!(personId in item.shares)) return item
      const shares = { ...item.shares }
      delete shares[personId]
      return { ...item, shares }
    }),
    hint: null,
  }
}

function giveUnit(state: BillState, itemId: string, personId: string | null): BillState {
  if (!personId) return { ...state, hint: "Kies eerst een persoon." }
  const item = state.items.find((current) => current.id === itemId)
  if (!item || !state.people.some((person) => person.id === personId)) return state

  if (item.mode === "shared") {
    const shares = { ...item.shares, [personId]: 1 }
    return replaceItem(state, itemId, { ...item, shares })
  }

  if (remainingUnits(item) <= 0) {
    return {
      ...state,
      hint: "Dit gerecht is al verdeeld. Tik op Aanpassen om iets te wijzigen.",
    }
  }

  const shares = {
    ...item.shares,
    [personId]: (item.shares[personId] ?? 0) + 1,
  }
  return replaceItem(state, itemId, { ...item, shares })
}

function takeUnit(state: BillState, itemId: string, personId: string): BillState {
  const item = state.items.find((current) => current.id === itemId)
  if (!item) return state
  const current = item.shares[personId] ?? 0
  if (current <= 0) return state
  const shares = { ...item.shares }
  if (current === 1) delete shares[personId]
  else shares[personId] = current - 1
  return replaceItem(state, itemId, { ...item, shares })
}

function giveRest(state: BillState, itemId: string, personId: string | null): BillState {
  if (!personId) return { ...state, hint: "Kies eerst een persoon." }
  const item = state.items.find((current) => current.id === itemId)
  if (!item || item.mode !== "units") return state
  const remaining = remainingUnits(item)
  if (remaining <= 0) return state
  const shares = {
    ...item.shares,
    [personId]: (item.shares[personId] ?? 0) + remaining,
  }
  return replaceItem(state, itemId, { ...item, shares })
}

function setShared(state: BillState, itemId: string, personIds: string[]): BillState {
  const item = state.items.find((current) => current.id === itemId)
  if (!item) return state
  const known = new Set(state.people.map((person) => person.id))
  const shares: Record<string, number> = {}
  for (const personId of personIds) {
    if (known.has(personId)) shares[personId] = 1
  }
  return replaceItem(state, itemId, { ...item, mode: "shared", shares })
}

function setMode(state: BillState, itemId: string, mode: ShareMode): BillState {
  const item = state.items.find((current) => current.id === itemId)
  if (!item || item.mode === mode) return state
  if (mode === "units") {
    return replaceItem(state, itemId, { ...item, mode, shares: {} })
  }
  const shares: Record<string, number> = {}
  if (state.activePersonId) shares[state.activePersonId] = 1
  return replaceItem(state, itemId, { ...item, mode: "shared", shares })
}

function clearShares(state: BillState, itemId: string): BillState {
  const item = state.items.find((current) => current.id === itemId)
  if (!item) return state
  return replaceItem(state, itemId, { ...item, shares: {} })
}

function fillRest(state: BillState): BillState {
  if (state.people.length === 0) {
    return { ...state, hint: "Voeg eerst de mensen aan tafel toe." }
  }

  const items = state.items.map((item) => {
    if (isItemComplete(item)) return item
    if (item.mode === "shared" || sumShares(item) === 0) {
      const shares: Record<string, number> = {}
      for (const person of state.people) shares[person.id] = 1
      return { ...item, mode: "shared" as const, shares }
    }
    const counts = state.people.map((person) => item.shares[person.id] ?? 0)
    const next = distributeRemaining(counts, remainingUnits(item))
    const shares: Record<string, number> = {}
    state.people.forEach((person, index) => {
      if (next[index] > 0) shares[person.id] = next[index]
    })
    return { ...item, shares }
  })

  return { ...state, items, hint: null }
}

function addGapItem(state: BillState): BillState {
  if (state.receiptTotalCents == null) return state
  const sum = state.items.reduce((total, item) => total + item.lineTotalCents, 0)
  const gap = state.receiptTotalCents - sum
  if (gap <= 0) return state
  if (state.items.length >= 80) return { ...state, hint: "Een rekening kan hoogstens 80 gerechten hebben." }
  return {
    ...state,
    items: [
      ...state.items,
      {
        id: createId(),
        name: "Overig op de bon",
        quantity: 1,
        lineTotalCents: gap,
        mode: "units",
        shares: {},
      },
    ],
  }
}
