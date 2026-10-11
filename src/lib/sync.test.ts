import { createInitialState } from "@/lib/bill-reducer"
import { persistable, revive, toRemoteBill } from "@/lib/storage"
import { planPush, planRemote } from "@/lib/sync-plan"
import { buildTableLink, createTableId, isTableId, readTableId, stableJson, withTableLink } from "@/lib/table"
import type { BillState } from "@/lib/types"
import { describe, expect, it } from "vitest"

function sample(): BillState {
  return {
    ...createInitialState(),
    step: "assign",
    resumeStep: "assign",
    venue: "Café De Lantaarn",
    photoUrl: "data:image/jpeg;base64,abc",
    rawText: "bon",
    receiptTotalCents: 10770,
    tipCents: 500,
    people: [
      { id: "sam", name: "Sam", color: "#355c4a" },
      { id: "alex", name: "Alex", color: "#8c4a32" },
    ],
    activePersonId: "sam",
    items: [
      {
        id: "soep",
        name: "Soep van de dag",
        quantity: 2,
        lineTotalCents: 2800,
        mode: "units",
        shares: { sam: 1, alex: 1 },
      },
    ],
  }
}

describe("tafel", () => {
  it("maakt een lang onraadbaar id", () => {
    const ids = new Set(Array.from({ length: 20 }, () => createTableId()))
    expect(ids.size).toBe(20)
    for (const id of ids) expect(isTableId(id)).toBe(true)
  })

  it("leest alleen een geldig tafel-id uit de url", () => {
    expect(readTableId("?tafel=abc")).toBeNull()
    expect(readTableId("?tafel=abcdefghijklmnopqrst")).toBe("abcdefghijklmnopqrst")
    expect(readTableId("?andere=abcdefghijklmnopqrst")).toBeNull()
  })

  it("zet de link op de hoofdpagina", () => {
    expect(buildTableLink("http://127.0.0.1:47231/ergens", "abcdefghijklmnopqrst")).toBe(
      "http://127.0.0.1:47231/?tafel=abcdefghijklmnopqrst",
    )
    expect(buildTableLink("https://hofb85.github.io", "abcdefghijklmnopqrst", "/nota/")).toBe(
      "https://hofb85.github.io/nota/?tafel=abcdefghijklmnopqrst",
    )
  })

  it("voegt de tafellink toe aan het overzicht", () => {
    expect(withTableLink("Sam · €10,00", null)).toBe("Sam · €10,00")
    expect(withTableLink("Sam · €10,00", "http://nota.test/?tafel=abcdefghijklmnopqrst")).toContain(
      "http://nota.test/?tafel=abcdefghijklmnopqrst",
    )
  })
})

describe("bewaren", () => {
  it("laat de foto weg en is stabiel na een rondje", () => {
    const saved = persistable(sample())
    expect(JSON.stringify(saved)).not.toContain("data:image")
    const again = persistable(revive(saved)!)
    expect(again).toEqual(saved)
    expect(stableJson(again)).toBe(stableJson(saved))
  })

  it("houdt een onbekende sleutelvolgorde gelijk", () => {
    const bill = persistable(sample())
    const reversed = {
      receiptTotalCents: bill.receiptTotalCents,
      rawText: bill.rawText,
      tipCents: bill.tipCents,
      activePersonId: bill.activePersonId,
      people: bill.people,
      items: bill.items.map((item) => ({
        shares: { alex: 1, sam: 1 },
        mode: item.mode,
        lineTotalCents: item.lineTotalCents,
        quantity: item.quantity,
        name: item.name,
        id: item.id,
      })),
      venue: bill.venue,
      resumeStep: bill.resumeStep,
      step: bill.step,
      version: bill.version,
    }
    expect(stableJson(reversed)).toBe(stableJson(bill))
  })

  it("stuurt naar Firestore exact de afgesproken velden", () => {
    const remote = toRemoteBill(sample(), 1_700_000_000_000)
    expect(Object.keys(remote).sort()).toEqual([
      "activePersonId",
      "items",
      "people",
      "rawText",
      "receiptTotalCents",
      "resumeStep",
      "step",
      "tipCents",
      "updatedAt",
      "venue",
      "version",
    ])
    expect(remote.updatedAt).toBe(1_700_000_000_000)
    expect(persistable(revive(remote)!)).toEqual(persistable(sample()))
  })
})

describe("sync", () => {
  const base = {
    localStep: "assign" as const,
    localKey: "lokaal",
    localStamp: 10,
    remoteKey: "ver",
    remoteStamp: 20,
    lastSent: null,
  }

  it("past een nieuwere tafel toe en negeert de eigen echo", () => {
    expect(planRemote(base)).toBe("apply")
    expect(planRemote({ ...base, lastSent: "ver", remoteKey: "ver" })).toBe("echo")
    expect(planRemote({ ...base, localKey: "ver", remoteKey: "ver" })).toBe("same")
    expect(planRemote({ ...base, localStamp: 30, remoteStamp: 20 })).toBe("keep-local")
    expect(planRemote({ ...base, localStep: "scan" })).toBe("defer")
  })

  it("schrijft pas als de tafel live is en er iets te delen valt", () => {
    const push = {
      hydrated: true,
      configured: true,
      tableId: "abcdefghijklmnopqrst",
      step: "review" as const,
      remoteReady: true,
      hasContent: true,
      docExists: false,
      ignore: false,
      key: "nu",
      lastSent: null,
    }
    expect(planPush(push)).toBe("push")
    expect(planPush({ ...push, remoteReady: false })).toBe("local")
    expect(planPush({ ...push, hasContent: false, docExists: false })).toBe("local")
    expect(planPush({ ...push, hasContent: false, docExists: true })).toBe("push")
    expect(planPush({ ...push, step: "scan" })).toBe("skip")
    expect(planPush({ ...push, configured: false })).toBe("local")
    expect(planPush({ ...push, key: "nu", lastSent: "nu" })).toBe("local")
  })
})
