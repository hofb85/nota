import type { FirebaseApp } from "firebase/app"
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

let appPromise: Promise<FirebaseApp | null> | null = null
let database: Promise<Firestore | null> | null = null

export function ensureApp(): Promise<FirebaseApp | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  if (!appPromise) {
    appPromise = import("firebase/app")
      .then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(firebaseOptions()))
      .catch((error: unknown) => {
        appPromise = null
        throw error
      })
  }
  return appPromise
}

export function ensureDb(): Promise<Firestore | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  if (!database) {
    database = ensureApp()
      .then(async (app) => {
        if (!app) return null
        const { getFirestore } = await import("firebase/firestore")
        return getFirestore(app)
      })
      .catch((error: unknown) => {
        database = null
        throw error
      })
  }
  return database
}
