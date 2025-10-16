import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AI Accounting Daily - Stay Ahead of AI in Accounting",
  description: "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes.",
}

export default function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
