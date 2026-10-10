export type ShareMode = "units" | "shared"

export type ParsedItem = {
  name: string
  quantity: number
  lineTotalCents: number
}

export type ParsedReceipt = {
  venue: string | null
  items: ParsedItem[]
  totalCents: number | null
}

export type BillItem = {
  id: string
  name: string
  quantity: number
  lineTotalCents: number
  mode: ShareMode
  shares: Record<string, number>
}

export type Person = {
  id: string
  name: string
  color: string
}

export type Step = "home" | "capture" | "scan" | "review" | "assign" | "settle"

export type ResumeStep = "review" | "assign" | "settle"

export type BillState = {
  step: Step
  resumeStep: ResumeStep
  venue: string
  items: BillItem[]
  people: Person[]
  activePersonId: string | null
  tipCents: number
  photoUrl: string | null
  rawText: string
  receiptTotalCents: number | null
  scanProgress: number
  scanLabel: string
  scanError: string | null
  notice: string | null
  hint: string | null
}
