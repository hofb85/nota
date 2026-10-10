"use client"

import { ChevronLeft } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Terug",
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-3 py-3 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-lg items-start gap-1 md:max-w-3xl">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            onClick={onBack}
            aria-label={backLabel}
          >
            <ChevronLeft />
          </Button>
        ) : null}
        <div className="min-w-0 px-1 pt-1.5">
          <h1 className="font-heading text-[1.7rem] leading-none tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  )
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="pointer-events-auto mx-auto w-full max-w-lg border-t border-border bg-background/95 px-4 pt-3 backdrop-blur-md md:max-w-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}
