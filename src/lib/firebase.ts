import type { Firestore } from "firebase/firestore"

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  )
}

function firebaseOptions() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  }
}

let database: Promise<Firestore | null> | null = null

export function ensureDb(): Promise<Firestore | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  if (!database) {
    database = import("firebase/app")
      .then(async ({ getApps, initializeApp }) => {
        const { getFirestore } = await import("firebase/firestore")
        const app = getApps()[0] ?? initializeApp(firebaseOptions())
        return getFirestore(app)
      })
      .catch((error: unknown) => {
        database = null
        throw error
      })
  }
  return database
}
