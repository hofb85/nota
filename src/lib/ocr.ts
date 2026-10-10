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

  const enhanced = preprocess(source, 1.35)
  const first = await withTimeout(read(enhanced, "6"), 90_000)
  if (countPrices(first) > 0) return first

  onProgress({ progress: 0.15, label: "Opnieuw proberen" })
  const second = await withTimeout(read(source, "4"), 90_000)
  return second
}

export function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return createImageBitmap(file, { imageOrientation: "from-image" }).then((bitmap) => {
    const maxWidth = 1600
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

function preprocess(source: HTMLCanvasElement, contrast: number): HTMLCanvasElement {
  const targetWidth = 1400
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

  const worker = await create("nld", 1, {
    logger: (message: { status?: string; progress?: number }) => {
      progressListener({
        progress: typeof message.progress === "number" ? message.progress : 0,
        label: labelFor(message.status ?? ""),
      })
    },
  })
  return worker as OcrWorker
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

function countPrices(text: string): number {
  return text.split(/\r?\n/).filter((line) => /\d[.,]\d{2}/.test(line)).length
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
