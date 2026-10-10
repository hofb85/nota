import { formatCommaCents, parseEuroToCents } from "@/lib/money"
import { isNonProductName } from "@/lib/parse-receipt"
import type { ParsedItem, ParsedReceipt } from "@/lib/types"

export function receiptFromModelJson(raw: unknown): ParsedReceipt | null {
  const value = unwrap(raw)
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const entries = Array.isArray(record.items) ? record.items : []
  const items: ParsedItem[] = []
  for (const entry of entries) {
    const item = readItem(entry)
    if (item) items.push(item)
  }
  if (items.length === 0) return null

  const scaled = scaleIfWholeEuros(items, readMoney(record.totalCents))
  return {
    venue: readVenue(record.venue),
    items: scaled.items,
    totalCents: scaled.totalCents,
  }
}

export function describeReceipt(parsed: ParsedReceipt): string {
  const lines: string[] = []
  if (parsed.venue) lines.push(parsed.venue)
  for (const item of parsed.items) {
    lines.push(`${item.quantity} x ${item.name} ${formatCommaCents(item.lineTotalCents)}`)
  }
  if (parsed.totalCents != null) lines.push(`Totaal ${formatCommaCents(parsed.totalCents)}`)
  return lines.join("\n")
}

function unwrap(raw: unknown): unknown {
  if (typeof raw !== "string") return raw
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown
    } catch {
      return null
    }
  }
}

function readItem(entry: unknown): ParsedItem | null {
  if (!entry || typeof entry !== "object") return null
  const record = entry as Record<string, unknown>
  const quantity = readQuantity(record.quantity)
  const nameValue = typeof record.name === "string" ? record.name : ""
  const peeled = peelQuantity(clean(nameValue), quantity)
  if (!peeled || isNonProductName(peeled.name)) return null
  const lineTotalCents = readMoney(record.lineTotalCents ?? record.priceCents ?? record.total)
  if (lineTotalCents == null) return null
  return { name: peeled.name, quantity: peeled.quantity, lineTotalCents }
}

function peelQuantity(name: string, quantity: number | null): { name: string; quantity: number } | null {
  const stripped = name.replace(/\s+[A-D]$/i, "").trim()
  const match = stripped.match(/^(\d{1,2})\s*[x×*]?\s+(?=\p{L})/u)
  let nextName = stripped
  let nextQuantity = quantity ?? 1
  if (match) {
    const lead = Number(match[1])
    const rest = stripped.slice(match[0].length).trim()
    const unit = /^(cl|ml|l|g|kg|st)\b/i.test(rest)
    if (!unit && lead >= 1 && lead <= 20 && /[\p{L}]{2,}/u.test(rest) && (nextQuantity === 1 || nextQuantity === lead)) {
      nextName = rest
      nextQuantity = lead
    }
  }
  if (nextQuantity < 1 || nextQuantity > 99) return null
  if (!/[\p{L}]{2,}/u.test(nextName) || nextName.length > 80) return null
  return { name: nextName, quantity: nextQuantity }
}

function readQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "string" && /^\d{1,2}$/.test(value.trim())) return Number(value.trim())
  return null
}

function readMoney(value: unknown): number | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed || /^null$/i.test(trimmed)) return null
    if (/^\d+$/.test(trimmed)) {
      const cents = Number(trimmed)
      return cents > 0 && cents <= 500_000 ? cents : null
    }
    const parsed = parseEuroToCents(trimmed)
    return parsed != null && parsed > 0 ? parsed : null
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 500_000) return null
  if (!Number.isInteger(value)) {
    const cents = Math.round(value * 100)
    return cents > 0 && cents <= 500_000 ? cents : null
  }
  return value
}

function readVenue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const name = clean(value)
  if (name.length < 2 || name.length > 60) return null
  if (/^(null|onbekend|geen)$/i.test(name)) return null
  return name
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function scaleIfWholeEuros(
  items: ParsedItem[],
  totalCents: number | null,
): { items: ParsedItem[]; totalCents: number | null } {
  const sum = items.reduce((total, item) => total + item.lineTotalCents, 0)
  const values = items.map((item) => item.lineTotalCents)
  if (totalCents != null) values.push(totalCents)
  const wholeEuros = values.every((value) => value < 100) && (totalCents == null || totalCents === sum)
  if (!wholeEuros) return { items, totalCents }
  return {
    items: items.map((item) => ({ ...item, lineTotalCents: item.lineTotalCents * 100 })),
    totalCents: totalCents == null ? null : totalCents * 100,
  }
}
