import type { Metadata, Viewport } from "next"
import { Fraunces, Geist_Mono, Outfit } from "next/font/google"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-heading",
})

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Nota — de rekening delen",
  description: "Fotografeer een rekening en wijs elk gerecht toe aan wie het genomen heeft.",
  applicationName: "Nota",
  appleWebApp: {
    capable: true,
    title: "Nota",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  themeColor: "#1c3329",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${outfit.variable} ${fraunces.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  )
}
