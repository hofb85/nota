import { parseReceiptText, scoreReceipt } from "@/lib/parse-receipt"

export type ScanUpdate = {
  progress: number
  label: string
}

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>
  setParameters: (params: Record<string, string>) => Promise<unknown>
  terminate: () => Promise<unknown>
}

let workerPromise: Promise<OcrWorker> | null = null
let progressListener: (update: ScanUpdate) => void = () => {}

export async function recognizeReceipt(
  source: HTMLCanvasElement,
  onProgress: (update: ScanUpdate) => void,
): Promise<string> {
  progressListener = onProgress
  onProgress({ progress: 0, label: "Lezer starten" })

  const enhanced = preprocess(source)
  const first = await withTimeout(read(enhanced, "6"), 90_000)
  if (scoreReceipt(parseReceiptText(first)) >= 28) return first

  onProgress({ progress: 0.2, label: "Namen nog eens lezen" })
  const second = await withTimeout(read(binarize(enhanced), "4"), 90_000)
  const firstScore = scoreReceipt(parseReceiptText(first))
  const secondScore = scoreReceipt(parseReceiptText(second))
  return secondScore > firstScore ? second : first
}

export function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return createImageBitmap(file, { imageOrientation: "from-image" }).then((bitmap) => {
    const maxWidth = 2400
    const scale = Math.min(1, maxWidth / bitmap.width)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      throw new Error("Canvas is niet beschikbaar.")
    }
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas
  })
}

function preprocess(source: HTMLCanvasElement): HTMLCanvasElement {
  const contrast = 1.75
  const targetWidth = 2000
  const scale = Math.max(1, targetWidth / source.width)
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return source
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.drawImage(source, 0, 0, width, height)
  const image = context.getImageData(0, 0, width, height)
  const pixels = image.data
  for (let index = 0; index < pixels.length; index += 4) {
    let gray = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2]
    gray = (gray - 128) * contrast + 128
    const value = gray < 0 ? 0 : gray > 255 ? 255 : gray
    pixels[index] = value
    pixels[index + 1] = value
    pixels[index + 2] = value
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function binarize(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = source.width
  canvas.height = source.height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return source
  context.drawImage(source, 0, 0)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = image.data
  const gray = new Uint8Array(pixels.length / 4)
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) gray[pixel] = pixels[index]
  const threshold = otsu(gray)
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = gray[pixel] > threshold ? 255 : 0
    pixels[index] = value
    pixels[index + 1] = value
    pixels[index + 2] = value
  }
  context.putImageData(image, 0, 0)
  return canvas
}

function otsu(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0)
  for (const value of gray) histogram[value] += 1
  let sum = 0
  for (let tone = 0; tone < 256; tone += 1) sum += tone * histogram[tone]
  let sumBackground = 0
  let weightBackground = 0
  let best = 0
  let threshold = 160
  const total = gray.length
  for (let tone = 0; tone < 256; tone += 1) {
    weightBackground += histogram[tone]
    if (weightBackground === 0) continue
    const weightForeground = total - weightBackground
    if (weightForeground === 0) break
    sumBackground += tone * histogram[tone]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sum - sumBackground) / weightForeground
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
    if (between > best) {
      best = between
      threshold = tone
    }
  }
  return threshold
}

async function read(image: HTMLCanvasElement, pageMode: string): Promise<string> {
  const worker = await getWorker()
  await worker.setParameters({
    tessedit_pageseg_mode: pageMode,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  })
  const result = await worker.recognize(image)
  return result.data.text ?? ""
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createWorker().catch((error: unknown) => {
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

async function createWorker(): Promise<OcrWorker> {
  const tesseract = await import("tesseract.js")
  const api = tesseract as unknown as {
    createWorker?: OcrFactory
    default?: { createWorker?: OcrFactory }
  }
  const create = api.createWorker ?? api.default?.createWorker
  if (!create) throw new Error("De lezer kon niet starten.")

  const options = {
    logger: (message: { status?: string; progress?: number }) => {
      progressListener({
        progress: typeof message.progress === "number" ? message.progress : 0,
        label: labelFor(message.status ?? ""),
      })
    },
  }
  try {
    return (await create("nld+eng", 1, options)) as OcrWorker
  } catch {
    return (await create("nld", 1, options)) as OcrWorker
  }
}

type OcrFactory = (
  lang: string,
  oem: number,
  options: { logger: (message: { status?: string; progress?: number }) => void },
) => Promise<OcrWorker>

function labelFor(status: string): string {
  switch (status) {
    case "loading tesseract core":
    case "initializing tesseract":
      return "Lezer starten"
    case "loading language traineddata":
      return "Nederlands laden"
    case "initializing api":
      return "Klaarmaken"
    case "recognizing text":
      return "Tekst herkennen"
    default:
      return "Bon lezen"
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
