/**
 * Auth proxy route to avoid CORS issues with OpenOnion API
 */

import { NextRequest, NextResponse } from 'next/server'

const OPENONION_API_URL = process.env.NEXT_PUBLIC_OPENONION_API_URL || 'https://oo.openonion.ai'

async function safeJsonResponse(response: Response): Promise<NextResponse> {
  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') && text) {
    return NextResponse.json(JSON.parse(text), { status: response.status })
  }
  return NextResponse.json(
    { error: text || `Upstream returned ${response.status}` },
    { status: response.status >= 400 ? response.status : 502 },
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${OPENONION_API_URL}/api/v1/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return safeJsonResponse(response)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  const response = await fetch(`${OPENONION_API_URL}/api/v1/auth/me`, {
    headers: authHeader ? { 'Authorization': authHeader } : {},
  })

  return safeJsonResponse(response)
}
