import { describe, expect, it } from "vitest"
import { describeReceipt, receiptFromModelJson } from "@/lib/receipt-json"

describe("receiptFromModelJson", () => {
  it("leest de drie producten van de voorbeeldbon", () => {
    const parsed = receiptFromModelJson({
      venue: "Thursdays Cafe",
      items: [
        { name: "Jupiler 25cl", quantity: 2, lineTotalCents: 460 },
        { name: "Affligem Blond", quantity: 2, lineTotalCents: 800 },
        { name: "Orval", quantity: 1, lineTotalCents: 500 },
        { name: "Cash", quantity: 1, lineTotalCents: 1760 },
        { name: "Netto A-Hoog", quantity: 1, lineTotalCents: 1455 },
      ],
      totalCents: 1760,
    })

    expect(parsed).toEqual({
      venue: "Thursdays Cafe",
      items: [
        { name: "Jupiler 25cl", quantity: 2, lineTotalCents: 460 },
        { name: "Affligem Blond", quantity: 2, lineTotalCents: 800 },
        { name: "Orval", quantity: 1, lineTotalCents: 500 },
      ],
      totalCents: 1760,
    })
    expect(describeReceipt(parsed!)).toContain("2 x Affligem Blond 8,00")
  })

  it("zet eurobedragen met een komma om naar centen en haalt het aantal uit de naam", () => {
    const parsed = receiptFromModelJson(`\`\`\`json
      {
        "venue": "Thursdays Cafe",
        "items": [
          { "name": "2 Jupiler 25cl", "quantity": 1, "lineTotalCents": 4.6 },
          { "name": "Affligem Blond", "quantity": "2", "lineTotalCents": "8,00" },
          { "name": "Orval", "quantity": 1, "lineTotalCents": "5,00" }
        ],
        "totalCents": 17.6
      }
    \`\`\``)

    expect(parsed?.items).toEqual([
      { name: "Jupiler 25cl", quantity: 2, lineTotalCents: 460 },
      { name: "Affligem Blond", quantity: 2, lineTotalCents: 800 },
      { name: "Orval", quantity: 1, lineTotalCents: 500 },
    ])
    expect(parsed?.totalCents).toBe(1760)
  })

  it("vermenigvuldigt hele euro's als het model de centen vergat", () => {
    const parsed = receiptFromModelJson({
      venue: null,
      items: [
        { name: "Jupiler", quantity: 2, lineTotalCents: 4 },
        { name: "Orval", quantity: 1, lineTotalCents: 5 },
      ],
      totalCents: 9,
    })

    expect(parsed?.items.map((item) => item.lineTotalCents)).toEqual([400, 500])
    expect(parsed?.totalCents).toBe(900)
  })

  it("geeft null terug als er geen producten in staan", () => {
    expect(receiptFromModelJson({ venue: "Thursdays", items: [], totalCents: 1760 })).toBeNull()
    expect(receiptFromModelJson("geen json")).toBeNull()
  })
})
