import { describe, expect, it } from "vitest"
import { DEMO_ITEMS, DEMO_TOTAL_CENTS, DEMO_VENUE, demoReceiptText } from "@/lib/demo-receipt"
import { parseReceiptText } from "@/lib/parse-receipt"

describe("parseReceiptText", () => {
  it("leest de voorbeeldbon van Café De Lantaarn", () => {
    const parsed = parseReceiptText(demoReceiptText())
    expect(parsed.venue).toBe(DEMO_VENUE)
    expect(parsed.totalCents).toBe(DEMO_TOTAL_CENTS)
    expect(parsed.items).toEqual(DEMO_ITEMS)
  })

  it("slaat btw, pin en totaal over en plakt een naam op de volgende prijs", () => {
    const parsed = parseReceiptText(`
      BRASSERIE HET PLEIN
      12-04-2026 19:41
      2000 Antwerpen

      2x Leffe blond          9,00
      Stoofvlees met friet
      1 x 22,50
      3 COLA 2,50 7,50
      Tafelwater            3,20
      BTW 12%               4,15
      Totaal EUR           42,20
      PIN                  42,20
      Bedankt en tot ziens
    `)

    expect(parsed.venue).toBe("Brasserie Het Plein")
    expect(parsed.totalCents).toBe(4220)
    expect(parsed.items).toEqual([
      { name: "Leffe blond", quantity: 2, lineTotalCents: 900 },
      { name: "Stoofvlees met friet", quantity: 1, lineTotalCents: 2250 },
      { name: "COLA", quantity: 3, lineTotalCents: 750 },
      { name: "Tafelwater", quantity: 1, lineTotalCents: 320 },
    ])
  })

  it("herkent een prijs waarin een letter als cijfer is gelezen", () => {
    const parsed = parseReceiptText("2 x Koffie 6,4O")
    expect(parsed.items).toEqual([{ name: "Koffie", quantity: 2, lineTotalCents: 640 }])
  })

  it("laat een inhoud zoals 33cl met rust", () => {
    const parsed = parseReceiptText("Leffe blond 33cl 4,50")
    expect(parsed.items).toEqual([{ name: "Leffe blond 33cl", quantity: 1, lineTotalCents: 450 }])
  })

  it("negeert een btw-blok met percentages", () => {
    const parsed = parseReceiptText(`
      Friet 4,50
      BTW
      A 12% 45,00 5,40
      B 21% 10,00 2,10
      Totaal 4,50
    `)
    expect(parsed.items).toEqual([{ name: "Friet", quantity: 1, lineTotalCents: 450 }])
    expect(parsed.totalCents).toBe(450)
  })
})
