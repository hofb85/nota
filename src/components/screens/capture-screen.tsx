"use client"

import { ImagePlus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useBill } from "@/components/bill-context"
import { Button } from "@/components/ui/button"

export function CaptureScreen() {
  const bill = useBill()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Deze browser heeft geen camera. Kies een foto uit je bibliotheek.")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setReady(true)
      } catch {
        if (!cancelled) {
          setCameraError("Geen toegang tot de camera. Kies een foto uit je bibliotheek.")
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(video, 0, 0)
    void bill.scanCanvas(canvas)
  }

  return (
    <div className="relative min-h-dvh bg-ink text-paper">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-ink/20" />
      <FrameCorners />

      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-paper hover:bg-white/10 hover:text-paper"
          onClick={() => bill.dispatch({ type: "go-back" })}
        >
          Annuleren
        </Button>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg">
          <p className="mb-4 text-center text-sm text-white drop-shadow">
            {cameraError ?? "Houd de bon vlak, in het licht, en zorg dat de prijzen leesbaar zijn."}
          </p>
          <div className="flex items-center justify-center gap-6">
            <Button
              type="button"
              variant="outline"
              className="h-12 border-white/30 bg-ink/50 text-paper hover:bg-ink/70 hover:text-paper"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
              Kies een foto
            </Button>
            <button
              type="button"
              aria-label="Foto nemen"
              disabled={!ready}
              onClick={shoot}
              className="size-20 rounded-full border-4 border-white bg-white/90 disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Kies een foto van de rekening"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void bill.scanFile(file)
        }}
      />
    </div>
  )
}

function FrameCorners() {
  const corner = "absolute size-10 border-white"
  return (
    <div className="pointer-events-none absolute inset-0">
      <span className={`${corner} top-24 left-6 border-t-4 border-l-4`} />
      <span className={`${corner} top-24 right-6 border-t-4 border-r-4`} />
      <span className={`${corner} bottom-40 left-6 border-b-4 border-l-4`} />
      <span className={`${corner} right-6 bottom-40 border-r-4 border-b-4`} />
    </div>
  )
}
