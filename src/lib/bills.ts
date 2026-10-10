import { ensureDb } from "@/lib/firebase"
import { readUpdatedAt, revive, toRemoteBill } from "@/lib/storage"
import type { BillState } from "@/lib/types"

const COLLECTION = "bills"

export function watchBill(
  id: string,
  handlers: {
    onBill: (state: BillState, updatedAt: number) => void
    onMissing: () => void
    onError: () => void
  },
): Promise<() => void> {
  return ensureDb()
    .then(async (database) => {
      if (!database) {
        handlers.onError()
        return () => {}
      }
      const { doc, onSnapshot } = await import("firebase/firestore")
      return onSnapshot(
        doc(database, COLLECTION, id),
        (snapshot) => {
          if (!snapshot.exists()) {
            handlers.onMissing()
            return
          }
          const data = snapshot.data()
          const state = revive(data)
          if (!state) {
            handlers.onError()
            return
          }
          handlers.onBill(state, readUpdatedAt(data))
        },
        () => handlers.onError(),
      )
    })
    .catch(() => {
      handlers.onError()
      return () => {}
    })
}

export async function writeBill(id: string, state: BillState, updatedAt: number): Promise<void> {
  const database = await ensureDb()
  if (!database) throw new Error("Firebase is niet ingesteld.")
  const { doc, setDoc } = await import("firebase/firestore")
  await setDoc(doc(database, COLLECTION, id), toRemoteBill(state, updatedAt))
}
