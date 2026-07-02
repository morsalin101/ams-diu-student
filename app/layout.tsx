import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { DisableContextMenu } from "@/components/disable-context-menu"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DIU Admission Test Portal",
  description: "Daffodil International University Admission Test System",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} overflow-x-hidden`}>
        <DisableContextMenu />
        {children}
      </body>
    </html>
  )
}
