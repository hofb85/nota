import { describe, expect, it } from "vitest"
import { billReducer, createInitialState } from "@/lib/bill-reducer"
import { DEMO_ITEMS, DEMO_TOTAL_CENTS } from "@/lib/demo-receipt"
import { parseEuroToCents, receiptGapCents } from "@/lib/money"
import { splitCents, summarize } from "@/lib/split"
import type { BillItem, Person } from "@/lib/types"

const sam: Person = { id: "sam", name: "Sam", color: "#c4512c" }
const alex: Person = { id: "alex", name: "Alex", color: "#1f7a5c" }
const noor: Person = { id: "noor", name: "Noor", color: "#1d4e89" }

function item(partial: Pick<BillItem, "id" | "name" | "quantity" | "lineTotalCents"> & Partial<BillItem>): BillItem {
  return {
    mode: "units",
    shares: {},
    ...partial,
  }
}

describe("splitCents", () => {
  it("geeft het restcent aan de eerste persoon bij gelijke delen", () => {
    expect(splitCents(100, [1, 1, 1])).toEqual([34, 33, 33])
  })

  it("verdeelt een lijntotaal volgens het aantal stuks", () => {
    expect(splitCents(750, [2, 1, 0])).toEqual([500, 250, 0])
  })
})

describe("summarize", () => {
  it("laat één persoon de hele bon betalen", () => {
    const items = DEMO_ITEMS.map((entry, index) =>
      item({
        id: `item-${index}`,
        ...entry,
        shares: { sam: entry.quantity },
      }),
    )
    const summary = summarize(items, [sam, alex], 0)
    expect(summary.complete).toBe(true)
    expect(summary.people[0].totalCents).toBe(DEMO_TOTAL_CENTS)
    expect(summary.people[1].totalCents).toBe(0)
    expect(summary.unassignedCents).toBe(0)
  })

  it("splitst een gedeeld gerecht en een fooi zodat de som klopt", () => {
    const items = [
      item({
        id: "pasta",
        name: "Vegetarische pasta",
        quantity: 1,
        lineTotalCents: 1850,
        mode: "shared",
        shares: { sam: 1, alex: 1 },
      }),
      item({
        id: "wijn",
        name: "Huiswijn rood",
        quantity: 3,
        lineTotalCents: 1350,
        shares: { sam: 1, alex: 1, noor: 1 },
      }),
    ]
    const summary = summarize(items, [sam, alex, noor], 500)
    const peopleTotal = summary.people.reduce((sum, person) => sum + person.totalCents, 0)
    expect(summary.people.map((person) => person.subtotalCents)).toEqual([925 + 450, 925 + 450, 450])
    expect(peopleTotal).toBe(1850 + 1350 + 500)
    expect(summary.grandCents).toBe(peopleTotal)
  })
})

describe("parseEuroToCents", () => {
  it("aanvaardt komma, punt en een duizendtal", () => {
    expect(parseEuroToCents("12,50")).toBe(1250)
    expect(parseEuroToCents("€ 12.50")).toBe(1250)
    expect(parseEuroToCents("1.234,50")).toBe(123450)
  })
})

describe("receiptGapCents", () => {
  it("rekent het verschil met het totaal op de bon", () => {
    expect(receiptGapCents([{ lineTotalCents: 1000 }], 1250)).toBe(250)
  })
})

describe("billReducer", () => {
  it("wijst stuks toe en vult de rest samen aan", () => {
    let state = createInitialState()
    state = billReducer(state, {
      type: "scan-success",
      venue: "Café De Lantaarn",
      items: [
        { name: "Huiswijn rood", quantity: 3, lineTotalCents: 1350 },
        { name: "Plat water", quantity: 1, lineTotalCents: 280 },
      ],
      rawText: "",
      receiptTotalCents: 1630,
      notice: null,
    })
    state = billReducer(state, { type: "add-person", name: "Sam" })
    state = billReducer(state, { type: "add-person", name: "Alex" })
    const samId = state.people[0].id
    const wineId = state.items[0].id
    state = billReducer(state, { type: "give-unit", itemId: wineId, personId: samId })
    expect(state.items[0].shares[samId]).toBe(1)
    state = billReducer(state, { type: "fill-rest" })
    expect(state.items[0].mode).toBe("units")
    expect(Object.values(state.items[0].shares).reduce((sum, count) => sum + count, 0)).toBe(3)
    expect(state.items[1].mode).toBe("shared")
    expect(state.items.every((entry) => Object.keys(entry.shares).length > 0)).toBe(true)
  })

  it("voegt het ontbrekende verschil op de bon toe", () => {
    let state = createInitialState()
    state = billReducer(state, {
      type: "scan-success",
      venue: "",
      items: [{ name: "Koffie", quantity: 1, lineTotalCents: 320 }],
      rawText: "",
      receiptTotalCents: 500,
      notice: null,
    })
    state = billReducer(state, { type: "add-gap-item" })
    expect(state.items[1]).toMatchObject({ name: "Overig op de bon", lineTotalCents: 180 })
  })
})
