import { formatCommaCents } from "@/lib/money"
import type { ParsedItem } from "@/lib/types"

export const DEMO_VENUE = "Café De Lantaarn"

export const DEMO_ITEMS: ParsedItem[] = [
  { name: "Soep van de dag", quantity: 2, lineTotalCents: 1400 },
  { name: "Stoofvlees met friet", quantity: 1, lineTotalCents: 2250 },
  { name: "Vol-au-vent", quantity: 1, lineTotalCents: 2100 },
  { name: "Vegetarische pasta", quantity: 1, lineTotalCents: 1850 },
  { name: "Huiswijn rood", quantity: 3, lineTotalCents: 1350 },
  { name: "Leffe blond", quantity: 2, lineTotalCents: 900 },
  { name: "Plat water", quantity: 1, lineTotalCents: 280 },
  { name: "Koffie", quantity: 2, lineTotalCents: 640 },
]

export const DEMO_TOTAL_CENTS = DEMO_ITEMS.reduce((sum, item) => sum + item.lineTotalCents, 0)

export function demoCanvasLines(): string[] {
  return [
    DEMO_VENUE,
    "Grote Markt 8",
    "2000 Antwerpen",
    "",
    ...DEMO_ITEMS.map(
      (item) => `${item.quantity} x ${item.name} ${formatCommaCents(item.lineTotalCents)}`,
    ),
    "",
    `Totaal ${formatCommaCents(DEMO_TOTAL_CENTS)}`,
    "Bedankt en tot ziens",
  ]
}

export function demoReceiptText(): string {
  return demoCanvasLines().join("\n")
}

export function renderDemoReceipt(): HTMLCanvasElement {
  const lines = demoCanvasLines()
  const fontSize = 42
  const lineHeight = 68
  const pad = 64
  const width = 1180
  const height = pad * 2 + lines.length * lineHeight
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is niet beschikbaar.")

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.fillStyle = "#111111"
  context.font = `${fontSize}px "Cascadia Mono", "Liberation Mono", monospace`
  context.textBaseline = "top"

  lines.forEach((line, index) => {
    context.fillText(line, pad, pad + index * lineHeight)
  })

  return canvas
}
