import type { AI, Schema } from "firebase/ai"
import { ensureApp } from "@/lib/firebase"
import { receiptFromModelJson } from "@/lib/receipt-json"
import type { ParsedReceipt } from "@/lib/types"

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"]

const INSTRUCTION = `Je leest een Belgische of Nederlandse kassabon van een foto.
Geef alleen producten terug: dranken, gerechten en andere verbruiksartikelen.
Negeer zaakgegevens, adres, btw-nummer, telefoon, e-mail, tafelnummer, rekeningnummer, datum, uur, kassier, betaalwijze (cash, bancontact, pin), btw-uitsplitsing (netto, A-hoog, percentages) en reclame.

quantity is het aantal op die regel, het getal vóór de productnaam.
lineTotalCents is het bedrag dat op die regel staat, in eurocent. 4,60 euro is 460. Dat is het lijntotaal voor dat aantal, niet de prijs per stuk. Een letter A, B, C of D achter de prijs is een btw-code en hoort niet bij de naam of het bedrag.
totalCents is het eindtotaal in eurocent. 17,60 euro is 1760. Gebruik het bedrag bij Totaal. Gebruik niet het nettobedrag en niet het aantal artikelen.
Schrijf de productnaam zoals op de bon, inclusief formaat zoals 25cl, maar zonder het aantal.
venue is de naam van de zaak, of null als die niet leesbaar is.`

export async function readReceiptWithGemini(source: HTMLCanvasElement): Promise<ParsedReceipt | null> {
  try {
    const app = await ensureApp()
    if (!app) return null
    const jpeg = canvasToJpeg(source)
    if (!jpeg) return null

    const firebaseAi = await import("firebase/ai")
    const ai = firebaseAi.getAI(app, { backend: new firebaseAi.GoogleAIBackend() })
    const schema = firebaseAi.Schema.object({
      properties: {
        venue: firebaseAi.Schema.string({ nullable: true, description: "Naam van de zaak, of null" }),
        totalCents: firebaseAi.Schema.integer({ nullable: true, description: "Eindtotaal in eurocent" }),
        items: firebaseAi.Schema.array({
          description: "Alleen producten",
          items: firebaseAi.Schema.object({
            properties: {
              name: firebaseAi.Schema.string({ description: "Productnaam zonder aantal" }),
              quantity: firebaseAi.Schema.integer({ description: "Aantal op de regel" }),
              lineTotalCents: firebaseAi.Schema.integer({ description: "Lijntotaal in eurocent" }),
            },
          }),
        }),
      },
    })

    for (const modelName of MODELS) {
      try {
        const text = await ask(firebaseAi, ai, modelName, schema, jpeg)
        return receiptFromModelJson(text)
      } catch (error) {
        if (!isMissingModel(error)) return null
      }
    }
    return null
  } catch {
    return null
  }
}

async function ask(
  firebaseAi: typeof import("firebase/ai"),
  ai: AI,
  modelName: string,
  schema: Schema,
  jpeg: string,
): Promise<string> {
  const run = (withThinking: boolean) => {
    const model = firebaseAi.getGenerativeModel(
      ai,
      {
        model: modelName,
        systemInstruction: INSTRUCTION,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          responseSchema: schema,
          ...(withThinking ? { thinkingConfig: { thinkingLevel: firebaseAi.ThinkingLevel.LOW } } : {}),
        },
      },
      { timeout: 40_000 },
    )
    return model.generateContent([
      { type: "inlineData", inlineData: { mimeType: "image/jpeg", data: jpeg } },
      "Lees deze kassabon.",
    ])
  }

  try {
    const result = await run(true)
    return result.response.text()
  } catch (error) {
    if (!isThinkingError(error)) throw error
    const result = await run(false)
    return result.response.text()
  }
}

function canvasToJpeg(source: HTMLCanvasElement): string | null {
  const maxEdge = 1600
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext("2d")
  if (!context) return null
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  const url = canvas.toDataURL("image/jpeg", 0.85)
  const comma = url.indexOf(",")
  return comma < 0 ? null : url.slice(comma + 1)
}

function isMissingModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /not found|404|unknown model|is not supported|no longer available/i.test(message)
}

function isThinkingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /thinking/i.test(message)
}
