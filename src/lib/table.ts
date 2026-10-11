const TABLE_PATTERN = /^[A-Za-z0-9]{16,64}$/

export function isTableId(value: string): boolean {
  return TABLE_PATTERN.test(value)
}

export function createTableId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function readTableId(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search
  const id = new URLSearchParams(query).get("tafel")?.trim() ?? ""
  return isTableId(id) ? id : null
}

export function buildTableLink(origin: string, tableId: string, pathname = "/"): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  const url = new URL(path, origin)
  url.searchParams.set("tafel", tableId)
  return url.toString()
}

export function replaceTableParam(id: string | null): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (id && isTableId(id)) url.searchParams.set("tafel", id)
  else url.searchParams.delete("tafel")
  const next = `${url.pathname}${url.search}${url.hash}`
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, "", next)
  }
}

export function withTableLink(summary: string, link: string | null): string {
  if (!link) return summary
  return `${summary}\n\nOpen dezelfde tafel:\n${link}`
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) sorted[key] = sortValue(record[key])
    return sorted
  }
  return value
}
