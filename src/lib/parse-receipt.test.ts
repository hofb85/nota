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

  it("houdt een merknaam die op een eigen regel staat", () => {
    const parsed = parseReceiptText(`
      CAFÉ ROMA
      Grote Markt 4
      DUVEL
      4,50
      JUPILER 25CL 3,40
      2 STELLA ARTOIS 2,80 5,60
      DRANKEN
      Coca-Cola Zero 3,20
      Totaal 16,70
    `)

    expect(parsed.venue).toBe("Café Roma")
    expect(parsed.items).toEqual([
      { name: "DUVEL", quantity: 1, lineTotalCents: 450 },
      { name: "JUPILER 25CL", quantity: 1, lineTotalCents: 340 },
      { name: "STELLA ARTOIS", quantity: 2, lineTotalCents: 560 },
      { name: "Coca-Cola Zero", quantity: 1, lineTotalCents: 320 },
    ])
    expect(parsed.totalCents).toBe(1670)
  })

  it("plakt een doorgesneden gerechtnaam weer aan elkaar", () => {
    const parsed = parseReceiptText(`
      Stoofvlees met
      friet 18,50
      D u v e l 4,50
    `)
    expect(parsed.items).toEqual([
      { name: "Stoofvlees met friet", quantity: 1, lineTotalCents: 1850 },
      { name: "Duvel", quantity: 1, lineTotalCents: 450 },
    ])
  })

  it("leest twee producten op één regel en een prijs zonder nul", () => {
    const parsed = parseReceiptText("Duvel 4,50 Jupiler 3,8")
    expect(parsed.items).toEqual([
      { name: "Duvel", quantity: 1, lineTotalCents: 450 },
      { name: "Jupiler", quantity: 1, lineTotalCents: 380 },
    ])
  })

  it("leest een Belgische bon met btw-letter, cash en een totaal met aantal", () => {
    const parsed = parseReceiptText(`
      Thursdays
      cafe
      BE0476371354
      Marktstraat 63 - 1745 Opwijk
      052/35.37.35
      www.thursdays.be
      info@thursdayscafe.be
      REKENING 3969
      Tafel 1
      12
      2 Jupiler 25cl 4,60 A
      2 Affligem Blond 8,00 A
      1 Orval 5,00 A
      5 Totaal 17,60
      Netto A-Hoog 14,55
      21% A-Hoog 3,05
      Cash 17,60
      Zaterdag 10-10-26 0:35:52
      #559499 YNKE
      Like us on Facebook!
    `)

    expect(parsed.venue).toBe("Thursdays cafe")
    expect(parsed.totalCents).toBe(1760)
    expect(parsed.items).toEqual([
      { name: "Jupiler 25cl", quantity: 2, lineTotalCents: 460 },
      { name: "Affligem Blond", quantity: 2, lineTotalCents: 800 },
      { name: "Orval", quantity: 1, lineTotalCents: 500 },
    ])
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
