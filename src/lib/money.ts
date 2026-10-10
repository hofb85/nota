export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100)
}

export function formatCommaCents(cents: number): string {
  const sign = cents < 0 ? "-" : ""
  const absolute = Math.abs(Math.round(cents))
  const euros = Math.floor(absolute / 100)
  const rest = absolute % 100
  return `${sign}${euros},${String(rest).padStart(2, "0")}`
}

export function formatInputCents(cents: number): string {
  return formatCommaCents(cents)
}

export function parseEuroToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")

  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return null

  let normalized = cleaned
  const hasComma = normalized.includes(",")
  const hasDot = normalized.includes(".")

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".")
    } else {
      normalized = normalized.replace(/,/g, "")
    }
  } else if (hasComma) {
    normalized = normalized.replace(",", ".")
  }

  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 10000) return null
  return Math.round(value * 100)
}

export function itemsTotalCents(items: { lineTotalCents: number }[]): number {
  return items.reduce((sum, item) => sum + item.lineTotalCents, 0)
}

export function receiptGapCents(
  items: { lineTotalCents: number }[],
  receiptTotalCents: number | null,
): number | null {
  if (receiptTotalCents == null) return null
  return receiptTotalCents - itemsTotalCents(items)
}

export function pieceLabel(quantity: number): string {
  return quantity === 1 ? "1 stuk" : `${quantity} stuks`
}

export function unitPriceCents(lineTotalCents: number, quantity: number): number | null {
  if (quantity <= 0 || lineTotalCents % quantity !== 0) return null
  return lineTotalCents / quantity
}
