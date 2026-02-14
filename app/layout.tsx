/**
 * @purpose Next.js root layout - defines global HTML structure, fonts, and metadata
 * @llm-note
 *   Dependencies: imports from [next, next/font/google, ./globals.css] | imported by Next.js framework (entry point) | no test files found
 *   Data flow: receives {children: React.ReactNode} → wraps in html/body with Inter font → renders children (page.tsx)
 *   State/Effects: no state or side effects | defines static metadata exported to Next.js
 *   Integration: exposes RootLayout component and metadata export | Next.js renders this for all pages | children slot filled with app/page.tsx
 *   Performance: Inter font preloaded via next/font/google (optimized font loading) | latin subset only
 *   Errors: no error handling, Next.js handles layout errors
 *
 * Next.js Layout System:
 *   - Root layout required for app router
 *   - Wraps all pages in the app
 *   - Metadata exported for SEO/social sharing
 *   - Font optimization via next/font
 *
 * Metadata:
 *   - title: "oo-chat - Open Source AI Chat Client"
 *   - description: Used for meta tags, search engines, social media previews
 *
 * Font Loading:
 *   - Inter font from Google Fonts
 *   - latin subset (reduces file size for Latin characters only)
 *   - next/font automatically optimizes with font-display: swap
 *
 * File Relationships:
 *     app/
 *     ├── layout.tsx        # THIS FILE - root layout
 *     ├── page.tsx          # Rendered as {children}
 *     ├── globals.css       # Imported Tailwind styles
 *     └── api/chat/route.ts # API route (not rendered in layout)
 */

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "oo-chat - Open Source AI Chat Client",
  description: "An open-source chat client for AI agents powered by ConnectOnion",
  icons: {
    icon: "https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png",
    apple: "https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
