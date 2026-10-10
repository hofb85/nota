"use client"

import { BillProvider, useBill } from "@/components/bill-context"
import { AssignScreen } from "@/components/screens/assign-screen"
import { CaptureScreen } from "@/components/screens/capture-screen"
import { HomeScreen } from "@/components/screens/home-screen"
import { ReviewScreen } from "@/components/screens/review-screen"
import { ScanScreen } from "@/components/screens/scan-screen"
import { SettleScreen } from "@/components/screens/settle-screen"

export function NotaApp() {
  return (
    <BillProvider>
      <AppRouter />
    </BillProvider>
  )
}

function AppRouter() {
  const { step } = useBill()
  switch (step) {
    case "capture":
      return <CaptureScreen />
    case "scan":
      return <ScanScreen />
    case "review":
      return <ReviewScreen />
    case "assign":
      return <AssignScreen />
    case "settle":
      return <SettleScreen />
    default:
      return <HomeScreen />
  }
}
