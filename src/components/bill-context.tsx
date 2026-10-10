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
import { billReducer, createInitialState, hasDraft, reviewIssues } from "@/lib/bill-reducer"
import type { BillAction } from "@/lib/bill-reducer"
import {
  DEMO_ITEMS,
  DEMO_TOTAL_CENTS,
  DEMO_VENUE,
  demoReceiptText,
  renderDemoReceipt,
} from "@/lib/demo-receipt"
import { fileToCanvas, recognizeReceipt } from "@/lib/ocr"
import { parseReceiptText } from "@/lib/parse-receipt"
import { loadBill, saveBill } from "@/lib/storage"
import type { BillState } from "@/lib/types"

type BillContextValue = BillState & {
  draft: boolean
  reviewIssue: string | null
  dispatch: (action: BillAction) => void
  scanDemo: () => Promise<void>
  scanFile: (file: File) => Promise<void>
  scanCanvas: (canvas: HTMLCanvasElement) => Promise<void>
  cancelScan: () => void
}

const BillContext = createContext<BillContextValue | null>(null)

export function BillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(billReducer, undefined, createInitialState)
  const [ready, setReady] = useState(false)
  const scanToken = useRef(0)
  const lastProgress = useRef(0)
  const lastLabel = useRef("")

  useEffect(() => {
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return
      const saved = loadBill()
      if (saved) dispatch({ type: "hydrate", state: saved })
      setReady(true)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!ready || state.step === "scan") return
    saveBill(state)
  }, [ready, state])

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
    dispatch({ type: "begin-scan", photoUrl })

    try {
      const text = await recognizeReceipt(canvas, (update) => {
        if (scanToken.current !== token) return
        const moved = update.progress === 1 || update.progress - lastProgress.current >= 0.05
        if (!moved && update.label === lastLabel.current) return
        lastProgress.current = update.progress
        lastLabel.current = update.label
        dispatch({ type: "scan-progress", progress: update.progress, label: update.label })
      })
      if (scanToken.current !== token) return

      const parsed = parseReceiptText(text)
      if (source === "demo") {
        const knownPrices = new Set(DEMO_ITEMS.map((item) => item.lineTotalCents))
        const hits = parsed.items.filter((item) => knownPrices.has(item.lineTotalCents)).length
        if (hits >= 5 && parsed.items.length >= 5) {
          dispatch({
            type: "scan-success",
            venue: parsed.venue || DEMO_VENUE,
            items: parsed.items,
            rawText: text,
            receiptTotalCents: parsed.totalCents ?? DEMO_TOTAL_CENTS,
            notice: null,
          })
          return
        }
        dispatch({
          type: "scan-success",
          venue: DEMO_VENUE,
          items: DEMO_ITEMS,
          rawText: text || demoReceiptText(),
          receiptTotalCents: DEMO_TOTAL_CENTS,
          notice: "De voorbeeldbon is ingevuld. Op een echte foto kan je elk gerecht nog aanpassen.",
        })
        return
      }

      if (parsed.items.length === 0) {
        dispatch({
          type: "scan-empty",
          rawText: text,
          message: "Geen gerechten gevonden. Vul ze zelf aan, of maak een scherpere foto.",
        })
        return
      }

      dispatch({
        type: "scan-success",
        venue: parsed.venue ?? "",
        items: parsed.items,
        rawText: text,
        receiptTotalCents: parsed.totalCents,
        notice: null,
      })
    } catch {
      if (scanToken.current !== token) return
      if (source === "demo") {
        dispatch({
          type: "scan-success",
          venue: DEMO_VENUE,
          items: DEMO_ITEMS,
          rawText: demoReceiptText(),
          receiptTotalCents: DEMO_TOTAL_CENTS,
          notice: "De voorbeeldbon is ingevuld. Op een echte foto kan je elk gerecht nog aanpassen.",
        })
        return
      }
      dispatch({
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
        dispatch({
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
    dispatch({ type: "go-back" })
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink text-paper">
        <p className="font-heading text-5xl italic">Nota</p>
      </div>
    )
  }

  const value: BillContextValue = {
    ...state,
    draft: hasDraft(state),
    reviewIssue: reviewIssues(state.items),
    dispatch,
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
