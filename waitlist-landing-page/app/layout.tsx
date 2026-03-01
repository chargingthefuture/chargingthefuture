import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Charging the Future — Join the Waitlist",
  description:
    "Get early access to the Charging the Future platform — secure support services for survivors.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
