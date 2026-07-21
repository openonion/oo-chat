/**
 * @purpose Next.js root layout - defines global HTML structure and metadata
 * @llm-note
 *   Dependencies: imports from [next, ./globals.css] | imported by Next.js framework (entry point) | no test files found
 *   Data flow: receives {children: React.ReactNode} → wraps in html/body → renders children (page.tsx)
 *   State/Effects: no state or side effects | defines static metadata exported to Next.js
 *   Integration: exposes RootLayout component and metadata export | Next.js renders this for all pages | children slot filled with app/page.tsx
 *   Performance: font stack is declared in globals.css, avoiding build-time network font fetches
 *   Errors: no error handling, Next.js handles layout errors
 *
 * Next.js Layout System:
 *   - Root layout required for app router
 *   - Wraps all pages in the app
 *   - Metadata exported for SEO/social sharing
 *
 * Metadata:
 *   - title: "oo-chat - Open Source AI Chat Client"
 *   - description: Used for meta tags, search engines, social media previews
 *
 * File Relationships:
 *     app/
 *     ├── layout.tsx        # THIS FILE - root layout
 *     ├── page.tsx          # Rendered as {children}
 *     ├── globals.css       # Imported Tailwind styles
 *     └── api/chat/route.ts # API route (not rendered in layout)
 */

import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "oo-chat - Open Source AI Chat Client",
  description: "An open-source chat client for AI agents powered by ConnectOnion",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
