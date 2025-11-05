import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI Accounting Daily - Stay Ahead of AI in Accounting",
  description: "Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes.",
  other: {
    'impact-site-verification': '95d00837-a42c-4e90-abfb-559b7845cfa8',
  },
}

export default function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}
