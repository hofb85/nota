"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { watchBill, writeBill } from "@/lib/bills"
import { billReducer, createInitialState, hasDraft, reviewIssues } from "@/lib/bill-reducer"
import type { BillAction } from "@/lib/bill-reducer"
import {
  DEMO_ITEMS,
  DEMO_TOTAL_CENTS,
  DEMO_VENUE,
  demoReceiptText,
  renderDemoReceipt,
} from "@/lib/demo-receipt"
import { isFirebaseConfigured } from "@/lib/firebase"
import { readReceiptWithGemini } from "@/lib/gemini-receipt"
import { fileToCanvas, recognizeReceipt } from "@/lib/ocr"
import { parseReceiptText } from "@/lib/parse-receipt"
import { describeReceipt } from "@/lib/receipt-json"
import { loadStoredBill, persistable, rememberTableId, rememberedTableId, saveBill } from "@/lib/storage"
import { planPush, planRemote } from "@/lib/sync-plan"
import { buildTableLink, createTableId, readTableId, replaceTableParam, stableJson, withTableLink } from "@/lib/table"
import type { BillState, ParsedReceipt } from "@/lib/types"

type ShareResult = "shared" | "copied" | "aborted" | "failed"

type BillContextValue = BillState & {
  draft: boolean
  reviewIssue: string | null
  cloud: "off" | "live" | "offline"
  tableLink: string | null
  dispatch: (action: BillAction) => void
  shareMessage: (text: string) => Promise<ShareResult>
  scanDemo: () => Promise<void>
  scanFile: (file: File) => Promise<void>
  scanCanvas: (canvas: HTMLCanvasElement) => Promise<void>
  cancelScan: () => void
}

const BillContext = createContext<BillContextValue | null>(null)

export function BillProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(billReducer, undefined, createInitialState)
  const [hydrated, setHydrated] = useState(false)
  const [tableId, setTableId] = useState<string | null>(null)
  const [cloud, setCloud] = useState<"off" | "live" | "offline">("off")
  const [syncNonce, setSyncNonce] = useState(0)
  const scanToken = useRef(0)
  const lastProgress = useRef(0)
  const lastLabel = useRef("")
  const stateRef = useRef(state)
  const localStamp = useRef(0)
  const lastSent = useRef<string | null>(null)
  const remoteReady = useRef(false)
  const docExists = useRef(false)
  const ignoreNextSave = useRef(false)
  const writeGen = useRef(0)
  const retryTimer = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const dispatch = useCallback((action: BillAction) => {
    if (action.type === "reset" && isFirebaseConfigured()) {
      const id = createTableId()
      rememberTableId(id)
      replaceTableParam(id)
      lastSent.current = null
      docExists.current = false
      remoteReady.current = false
      localStamp.current = 0
      ignoreNextSave.current = true
      writeGen.current += 1
      setTableId(id)
    }
    baseDispatch(action)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isFirebaseConfigured()) {
        const saved = loadStoredBill(null)
        if (saved) {
          localStamp.current = saved.updatedAt
          baseDispatch({ type: "hydrate", state: saved.state })
        }
        setCloud("off")
        setHydrated(true)
        return
      }

      const fromUrl = readTableId(window.location.search)
      const id = fromUrl ?? rememberedTableId()
      if (fromUrl) rememberTableId(fromUrl)

      if (id) {
        const cached = loadStoredBill(id) ?? (fromUrl ? null : loadStoredBill(null))
        if (cached) {
          localStamp.current = cached.updatedAt
          baseDispatch({ type: "hydrate", state: cached.state })
        }
        replaceTableParam(id)
        setTableId(id)
        setCloud("live")
        setHydrated(true)
        return
      }

      const generic = loadStoredBill(null)
      if (generic && hasDraft(generic.state)) {
        const created = createTableId()
        localStamp.current = generic.updatedAt
        rememberTableId(created)
        replaceTableParam(created)
        baseDispatch({ type: "hydrate", state: generic.state })
        setTableId(created)
      }
      setCloud("live")
      setHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!hydrated || tableId || !isFirebaseConfigured()) return
    if (state.step === "scan" || state.step === "capture") return
    if (!hasDraft(state)) return
    const timer = window.setTimeout(() => {
      const id = createTableId()
      rememberTableId(id)
      replaceTableParam(id)
      setTableId(id)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [hydrated, tableId, state])

  useEffect(() => {
    if (!tableId || !isFirebaseConfigured()) return
    let active = true
    let unsubscribe = () => {}
    remoteReady.current = false
    docExists.current = false
    lastSent.current = null

    void watchBill(tableId, {
      onBill(remote, updatedAt) {
        if (!active) return
        const local = stateRef.current
        const remoteKey = stableJson(persistable(remote))
        const decision = planRemote({
          localStep: local.step,
          localKey: stableJson(persistable(local)),
          localStamp: localStamp.current,
          remoteKey,
          remoteStamp: updatedAt,
          lastSent: lastSent.current,
        })
        docExists.current = true
        remoteReady.current = true
        if (decision === "defer") {
          setCloud("live")
          return
        }
        if (decision === "echo" || decision === "same") {
          lastSent.current = remoteKey
          localStamp.current = Math.max(localStamp.current, updatedAt)
          setCloud("live")
          setHydrated(true)
          return
        }
        if (decision === "keep-local") {
          setCloud("live")
          setHydrated(true)
          setSyncNonce((nonce) => nonce + 1)
          return
        }
        lastSent.current = remoteKey
        localStamp.current = updatedAt
        ignoreNextSave.current = true
        baseDispatch({ type: "hydrate", state: { ...remote, photoUrl: local.photoUrl } })
        setCloud("live")
        setHydrated(true)
      },
      onMissing() {
        if (!active) return
        docExists.current = false
        remoteReady.current = true
        setCloud("live")
        setHydrated(true)
        setSyncNonce((nonce) => nonce + 1)
      },
      onError() {
        if (!active) return
        remoteReady.current = true
        setCloud("offline")
        setHydrated(true)
      },
    }).then((stop) => {
      if (!active) stop()
      else unsubscribe = stop
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [tableId])

  useEffect(() => {
    const key = stableJson(persistable(state))
    const decision = planPush({
      hydrated,
      configured: isFirebaseConfigured(),
      tableId,
      step: state.step,
      remoteReady: remoteReady.current,
      hasContent: hasDraft(state),
      docExists: docExists.current,
      ignore: ignoreNextSave.current,
      key,
      lastSent: lastSent.current,
    })
    if (ignoreNextSave.current) ignoreNextSave.current = false
    if (decision === "skip") return

    if (decision === "local") {
      saveBill(state, tableId, localStamp.current || Date.now())
      return
    }

    const stamp = Date.now()
    localStamp.current = stamp
    saveBill(state, tableId, stamp)
    if (!tableId) return
    const generation = ++writeGen.current
    const handle = window.setTimeout(() => {
      void writeBill(tableId, state, stamp)
        .then(() => {
          if (writeGen.current !== generation) return
          lastSent.current = key
          docExists.current = true
          setCloud("live")
        })
        .catch(() => {
          if (writeGen.current !== generation) return
          setCloud("offline")
          if (retryTimer.current != null) window.clearTimeout(retryTimer.current)
          retryTimer.current = window.setTimeout(() => setSyncNonce((nonce) => nonce + 1), 5000)
        })
    }, 450)
    return () => window.clearTimeout(handle)
  }, [hydrated, state, tableId, syncNonce])

  useEffect(() => {
    const onOnline = () => setSyncNonce((nonce) => nonce + 1)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("online", onOnline)
      if (retryTimer.current != null) window.clearTimeout(retryTimer.current)
    }
  }, [])

  const shareMessage = useCallback(
    async (text: string): Promise<ShareResult> => {
      const link = tableId && isFirebaseConfigured() ? buildTableLink(window.location.origin, tableId, window.location.pathname) : null
      const payload = withTableLink(text, link)
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Nota", text: payload, url: link ?? undefined })
          return "shared"
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return "aborted"
        }
      }
      try {
        await navigator.clipboard.writeText(payload)
        return "copied"
      } catch {
        return "failed"
      }
    },
    [tableId],
  )

  const runScan = useCallback(async (canvas: HTMLCanvasElement, source: "photo" | "demo") => {
    const token = ++scanToken.current
    lastProgress.current = 0
    lastLabel.current = ""
    let photoUrl = ""
    try {
      photoUrl = canvas.toDataURL("image/jpeg", 0.82)
    } catch {
      photoUrl = ""
    }
    baseDispatch({ type: "begin-scan", photoUrl })

    const finish = (parsed: ParsedReceipt, rawText: string) => {
      if (scanToken.current !== token) return
      if (source === "demo") {
        const knownPrices = new Set(DEMO_ITEMS.map((item) => item.lineTotalCents))
        const hits = parsed.items.filter((item) => knownPrices.has(item.lineTotalCents)).length
        if (hits >= 5 && parsed.items.length >= 5) {
          baseDispatch({
            type: "scan-success",
            venue: parsed.venue || DEMO_VENUE,
            items: parsed.items,
            rawText,
            receiptTotalCents: parsed.totalCents ?? DEMO_TOTAL_CENTS,
            notice: null,
          })
          return
        }
        baseDispatch({
          type: "scan-success",
          venue: DEMO_VENUE,
          items: DEMO_ITEMS,
          rawText: rawText || demoReceiptText(),
          receiptTotalCents: DEMO_TOTAL_CENTS,
          notice: "De voorbeeldbon is ingevuld. Op een echte foto kan je elk gerecht nog aanpassen.",
        })
        return
      }

      if (parsed.items.length === 0) {
        baseDispatch({
          type: "scan-empty",
          rawText,
          message: "Geen gerechten gevonden. Vul ze zelf aan, of maak een scherpere foto.",
        })
        return
      }

      baseDispatch({
        type: "scan-success",
        venue: parsed.venue ?? "",
        items: parsed.items,
        rawText,
        receiptTotalCents: parsed.totalCents,
        notice: null,
      })
    }

    try {
      if (isFirebaseConfigured()) {
        baseDispatch({ type: "scan-progress", progress: 0.2, label: "Producten herkennen" })
        const ai = await readReceiptWithGemini(canvas)
        if (scanToken.current !== token) return
        if (ai && ai.items.length > 0) {
          finish(ai, describeReceipt(ai))
          return
        }
      }

      const text = await recognizeReceipt(canvas, (update) => {
        if (scanToken.current !== token) return
        const moved = update.progress === 1 || update.progress - lastProgress.current >= 0.05
        if (!moved && update.label === lastLabel.current) return
        lastProgress.current = update.progress
        lastLabel.current = update.label
        baseDispatch({ type: "scan-progress", progress: update.progress, label: update.label })
      })
      if (scanToken.current !== token) return
      finish(parseReceiptText(text), text)
    } catch {
      if (scanToken.current !== token) return
      if (source === "demo") {
        baseDispatch({
          type: "scan-success",
          venue: DEMO_VENUE,
          items: DEMO_ITEMS,
          rawText: demoReceiptText(),
          receiptTotalCents: DEMO_TOTAL_CENTS,
          notice: "De voorbeeldbon is ingevuld. Op een echte foto kan je elk gerecht nog aanpassen.",
        })
        return
      }
      baseDispatch({
        type: "scan-empty",
        rawText: "",
        message: "De bon kon niet gelezen worden. Vul de gerechten zelf aan, of probeer een andere foto.",
      })
    }
  }, [])

  const scanDemo = useCallback(async () => {
    await runScan(renderDemoReceipt(), "demo")
  }, [runScan])

  const scanCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      await runScan(canvas, "photo")
    },
    [runScan],
  )

  const scanFile = useCallback(
    async (file: File) => {
      try {
        const canvas = await fileToCanvas(file)
        await runScan(canvas, "photo")
      } catch {
        baseDispatch({
          type: "scan-empty",
          rawText: "",
          message: "Deze foto kon niet geopend worden. Kies een andere afbeelding.",
        })
      }
    },
    [runScan],
  )

  const cancelScan = useCallback(() => {
    scanToken.current += 1
    baseDispatch({ type: "go-back" })
  }, [])

  const tableLink =
    tableId && isFirebaseConfigured() && typeof window !== "undefined"
      ? buildTableLink(window.location.origin, tableId, window.location.pathname)
      : null

  const value: BillContextValue = {
    ...state,
    draft: hasDraft(state),
    reviewIssue: reviewIssues(state.items),
    cloud,
    tableLink,
    dispatch,
    shareMessage,
    scanDemo,
    scanFile,
    scanCanvas,
    cancelScan,
  }

  return <BillContext.Provider value={value}>{children}</BillContext.Provider>
}

export function useBill() {
  const value = useContext(BillContext)
  if (!value) throw new Error("useBill moet binnen Nota staan.")
  return value
}
