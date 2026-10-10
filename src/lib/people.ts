export const PERSON_COLORS = [
  "#c4512c",
  "#1f7a5c",
  "#1d4e89",
  "#8a5a12",
  "#6d3fa0",
  "#0f6e7a",
  "#9a3b55",
  "#3f6212",
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function nextPersonColor(used: string[]): string {
  const free = PERSON_COLORS.find((color) => !used.includes(color))
  return free ?? PERSON_COLORS[used.length % PERSON_COLORS.length]
}
