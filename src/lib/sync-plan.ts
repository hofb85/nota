import type { Step } from "@/lib/types"

export function planRemote(input: {
  localStep: Step
  localKey: string
  localStamp: number
  remoteKey: string
  remoteStamp: number
  lastSent: string | null
}): "defer" | "echo" | "same" | "keep-local" | "apply" {
  if (input.localStep === "scan" || input.localStep === "capture") return "defer"
  if (input.lastSent != null && input.remoteKey === input.lastSent) return "echo"
  if (input.remoteKey === input.localKey) return "same"
  if (input.localStamp > input.remoteStamp) return "keep-local"
  return "apply"
}

export function planPush(input: {
  hydrated: boolean
  configured: boolean
  tableId: string | null
  step: Step
  remoteReady: boolean
  hasContent: boolean
  docExists: boolean
  ignore: boolean
  key: string
  lastSent: string | null
}): "skip" | "local" | "push" {
  if (!input.hydrated) return "skip"
  if (input.step === "scan" || input.step === "capture") return "skip"
  if (!input.configured || !input.tableId) return "local"
  if (!input.remoteReady || input.ignore) return "local"
  if (input.key === input.lastSent) return "local"
  if (!input.hasContent && !input.docExists) return "local"
  return "push"
}
