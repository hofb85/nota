import type { ParsedItem, ParsedReceipt } from "@/lib/types"

const PRICE_TAIL = /(\d{1,4})\s*[.,]\s*(\d{2})\s*(?:eur)?\s*$/i

const REJECT_LINE =
  /^(btw|vat|contant|pin|bancontact|visa|mastercard|maestro|betaald|wisselgeld|bedankt|dank u|fooi|afronding|omzet|wissel|iban|bic|tel|gsm|www\.|https?:|factuur|kassier|ondernemings)\b/i

const REJECT_NAME =
  /^(totaal|te betalen|subtotaal|sub totaal|btw|vat|omzet|contant|bancontact|maestro|visa|mastercard|pin|pinbetaling|wisselgeld|bedankt|dank u|fooi|service|servicekost|afronding|betaald|wissel|kassier|factuur|tafel|tafel\s+\d+)$/i

export function parseReceiptText(raw: string): ParsedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.length > 0)

  const items: ParsedItem[] = []
  let venue: string | null = null
  let totalCents: number | null = null
  let pendingName: string | null = null
  let seenItem = false

  for (const line of lines) {
    if (line.includes("%")) {
      pendingName = null
      continue
    }

    const total = matchTotal(line)
    if (total != null) {
      totalCents = total
      pendingName = null
      continue
    }

    if (isRejectedLine(line)) {
      pendingName = null
      continue
    }

    const price = matchPrice(line)
    if (!price) {
      if (!seenItem && !venue && looksLikeVenue(line)) {
        venue = prettifyVenue(line)
        continue
      }
      if (looksLikePendingName(line)) pendingName = cleanName(line)
      continue
    }

    const parsed = parseQtyAndName(price.head)
    let name = parsed.name
    if (name.length < 2 && pendingName) name = pendingName
    pendingName = null

    if (!isUsableName(name) || isRejectedName(name)) continue
    if (parsed.quantity < 1 || parsed.quantity > 99) continue

    items.push({
      name,
      quantity: parsed.quantity,
      lineTotalCents: price.cents,
    })
    seenItem = true
  }

  return { venue, items, totalCents }
}

function normalizeLine(line: string): string {
  const collapsed = line
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/€/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
  return softenPriceTokens(collapsed)
}

function softenPriceTokens(line: string): string {
  return line.replace(/[0-9OoIl|·.,]{3,}/g, (token) =>
    token.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/·/g, ","),
  )
}

function matchPrice(line: string): { cents: number; head: string } | null {
  const match = line.match(PRICE_TAIL)
  if (!match || match.index == null) return null
  const cents = Number(match[1]) * 100 + Number(match[2])
  if (!Number.isFinite(cents) || cents <= 0 || cents > 500_000) return null
  return { cents, head: line.slice(0, match.index).trim() }
}

function matchTotal(line: string): number | null {
  if (/^sub\s?totaal\b/i.test(line)) return null
  if (!/^(totaal|te betalen)\b/i.test(line)) return null
  return matchPrice(line)?.cents ?? null
}

function isRejectedLine(line: string): boolean {
  return REJECT_LINE.test(line)
}

function isRejectedName(name: string): boolean {
  if (REJECT_NAME.test(name)) return true
  return /^(btw|totaal|sub\s?totaal|vat)\b/i.test(name)
}

function isMetaLine(line: string): boolean {
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(line)) return true
  if (/^\d{1,2}:\d{2}\b/.test(line)) return true
  if (/^\d{4}\b/.test(line)) return true
  if (/^(tel|gsm|btw|iban|www\.|https?:)/i.test(line)) return true
  return false
}

function looksLikeVenue(line: string): boolean {
  if (isMetaLine(line) || isRejectedLine(line) || isRejectedName(line)) return false
  if (line.length > 42) return false
  return isUsableName(line)
}

function looksLikePendingName(line: string): boolean {
  if (isMetaLine(line) || isRejectedLine(line) || isRejectedName(line)) return false
  if (line.length > 48) return false
  return isUsableName(line)
}

function prettifyVenue(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, "")
  if (letters.length < 2 || letters !== letters.toUpperCase()) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, separator: string, char: string) => separator + char.toUpperCase())
}

function parseQtyAndName(head: string): { quantity: number; name: string } {
  let rest = head.replace(/\d{1,4}\s*[.,]\s*\d{2}\s*$/, "").trim()
  let quantity = 1

  const leadTimes = rest.match(/^(\d{1,2})\s*[x×*]\s*/i)
  if (leadTimes && Number(leadTimes[1]) >= 1) {
    quantity = Number(leadTimes[1])
    rest = rest.slice(leadTimes[0].length).trim()
  } else if (!/^\d{1,3}\s*(cl|ml|l|g|kg)\b/i.test(rest)) {
    const leadNumber = rest.match(/^(\d{1,2})\s+(?=\p{L})/u)
    if (leadNumber && Number(leadNumber[1]) >= 1 && Number(leadNumber[1]) <= 20) {
      quantity = Number(leadNumber[1])
      rest = rest.slice(leadNumber[0].length).trim()
    } else {
      const trailing = rest.match(/^(.*\p{L}.*)\s+(\d{1,2})$/u)
      if (trailing && Number(trailing[2]) >= 1 && Number(trailing[2]) <= 15) {
        const candidate = cleanName(trailing[1])
        if (isUsableName(candidate)) {
          rest = trailing[1]
          quantity = Number(trailing[2])
        }
      }
    }
  }

  return { quantity, name: cleanName(rest) }
}

function cleanName(name: string): string {
  return name
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.:;\-]+|[\s.:;\-]+$/g, "")
    .trim()
}

function isUsableName(name: string): boolean {
  return /[\p{L}]{2,}/u.test(name) && name.length <= 80
}
