import type { ParsedItem, ParsedReceipt } from "@/lib/types"

const PRICE_TAIL = /(\d{1,4})\s*[.,]\s*(\d{1,2})\s*(?:eur)?\s*$/i
const SPACED_PRICE = /^(.*\p{L}.*)\s+(\d{1,3})\s+(\d{2})$/u

const REJECT_LINE =
  /^(btw|vat|contant|pin|bancontact|visa|mastercard|maestro|betaald|wisselgeld|bedankt|dank u|fooi|afronding|omzet|wissel|iban|bic|tel|gsm|www\.|https?:|factuur|kassier|ondernemings)\b/i

const REJECT_NAME =
  /^(totaal|te betalen|subtotaal|sub totaal|btw|vat|omzet|contant|bancontact|maestro|visa|mastercard|pin|pinbetaling|wisselgeld|bedankt|dank u|fooi|service|servicekost|afronding|betaald|wissel|kassier|factuur|tafel|tafel\s+\d+)$/i

const SECTION =
  /^(dranken|eten|keuken|dessert|desserts|lunch|diner|aperitief|wijnen|bieren|fris|frisdranken|gerechten|voorgerechten|hoofdgerechten|nagerechten|koude dranken|warme dranken)$/i

export function parseReceiptText(raw: string): ParsedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .flatMap((line) => explodePrices(normalizeLine(line)))
    .filter((line) => line.length > 0)

  const items: ParsedItem[] = []
  let venue: string | null = null
  let totalCents: number | null = null
  let pendingName: string | null = null
  let seenItem = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.includes("%") || isSection(line)) {
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
      if (isMetaLine(line) || isAddress(line) || !looksLikePendingName(line)) {
        pendingName = null
        continue
      }
      const nextPrice = nextPriceLine(lines, index + 1)
      if (!seenItem && !venue && looksLikeVenue(line) && !nextPrice?.only && !wantsJoin(cleanName(line))) {
        venue = prettifyVenue(line)
        pendingName = null
        continue
      }
      pendingName = joinName(pendingName, cleanName(line))
      continue
    }

    const parsed = parseQtyAndName(price.head)
    let name = parsed.name
    if (!isUsableName(name) && pendingName) name = pendingName
    else if (pendingName && wantsJoin(pendingName) && isUsableName(name)) name = joinName(pendingName, name)
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

export function scoreReceipt(parsed: ParsedReceipt): number {
  let score = 0
  for (const item of parsed.items) {
    const letters = item.name.match(/\p{L}/gu)?.length ?? 0
    if (letters >= 3) score += 10 + Math.min(letters, 12)
    else if (letters >= 2) score += 4
  }
  if (parsed.totalCents != null) score += 2
  return score
}

function explodePrices(line: string): string[] {
  if (!line) return []
  const matches = [...line.matchAll(/\d{1,4}\s*[.,]\s*\d{1,2}/g)]
  if (matches.length < 2) return [line]

  const parts: string[] = []
  let start = 0
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const end = (match.index ?? 0) + match[0].length
    const next = matches[index + 1]
    if (!next) {
      const tail = line.slice(start).trim()
      if (tail) parts.push(tail)
      break
    }
    const between = line.slice(end, next.index ?? end)
    if (/[\p{L}]{2,}/u.test(between)) {
      const part = line.slice(start, end).trim()
      if (part) parts.push(part)
      start = end
    }
  }
  return parts.length > 0 ? parts : [line]
}

function nextPriceLine(lines: string[], start: number): { only: boolean } | null {
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (isMetaLine(line) || isAddress(line) || isSection(line)) continue
    const price = matchPrice(line)
    if (!price) return null
    return { only: !isUsableName(parseQtyAndName(price.head).name) }
  }
  return null
}

function normalizeLine(line: string): string {
  const collapsed = line
    .replace(/\u00a0/g, " ")
    .replace(/[|]/g, " ")
    .replace(/€/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[._]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return softenPriceTokens(collapseSpacedLetters(collapsed))
}

function collapseSpacedLetters(line: string): string {
  return line.replace(/(?:\p{L}\s+){2,}\p{L}/gu, (match) => match.replace(/\s+/g, ""))
}

function softenPriceTokens(line: string): string {
  return line.replace(/[0-9OoIl|·.,]{3,}/g, (token) =>
    token.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/·/g, ","),
  )
}

function matchPrice(line: string): { cents: number; head: string } | null {
  const match = line.match(PRICE_TAIL)
  if (match && match.index != null) {
    const cents = centsFrom(match[1], match[2])
    if (cents == null) return null
    return { cents, head: line.slice(0, match.index).trim() }
  }

  const spaced = line.match(SPACED_PRICE)
  if (!spaced) return null
  const cents = centsFrom(spaced[2], spaced[3])
  if (cents == null) return null
  return { cents, head: spaced[1].trim() }
}

function centsFrom(whole: string, fraction: string): number | null {
  const cents = Number(whole) * 100 + Number(fraction.length === 1 ? `${fraction}0` : fraction)
  if (!Number.isFinite(cents) || cents <= 0 || cents > 500_000) return null
  return cents
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

function isSection(line: string): boolean {
  return SECTION.test(line)
}

function isMetaLine(line: string): boolean {
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/.test(line)) return true
  if (/^\d{1,2}:\d{2}\b/.test(line)) return true
  if (/^\d{4}\b/.test(line)) return true
  if (/^(tel|gsm|btw|iban|www\.|https?:)/i.test(line)) return true
  return false
}

function isAddress(line: string): boolean {
  if (/\b\d{4}\b/.test(line) && /\p{L}{2,}/u.test(line)) return true
  return /\b(straat|laan|plein|steeg|kaai|lei|weg|markt|dreef|baan)\b/i.test(line) && /\d/.test(line)
}

function looksLikeVenue(line: string): boolean {
  if (isMetaLine(line) || isAddress(line) || isRejectedLine(line) || isRejectedName(line) || isSection(line)) {
    return false
  }
  if (line.length > 42) return false
  return isUsableName(line)
}

function looksLikePendingName(line: string): boolean {
  if (isMetaLine(line) || isAddress(line) || isRejectedLine(line) || isRejectedName(line) || isSection(line)) {
    return false
  }
  if (line.length > 60) return false
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
  let rest = head.replace(/\d{1,4}\s*[.,]\s*\d{1,2}\s*$/, "").trim()
  rest = rest.replace(/^\d{3,6}\s+(?=\p{L})/u, "").trim()
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

function wantsJoin(pending: string): boolean {
  return /\b(met|van|de|het|een|op|in|en|à|a|with|aux)$/i.test(pending)
}

function joinName(pending: string | null, next: string): string {
  if (!pending) return next
  return cleanName(`${pending} ${next}`)
}

function cleanName(name: string): string {
  return name
    .replace(/[*•]+/g, " ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.:;\-]+|[\s.:;\-]+$/g, "")
    .trim()
}

function isUsableName(name: string): boolean {
  return /[\p{L}]{2,}/u.test(name) && name.length <= 80
}
