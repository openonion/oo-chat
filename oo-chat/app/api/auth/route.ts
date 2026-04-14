/**
 * Auth proxy route to avoid CORS issues with OpenOnion API
 */

import { NextRequest, NextResponse } from 'next/server'

const OPENONION_API_URL = process.env.NEXT_PUBLIC_OPENONION_API_URL || 'https://oo.openonion.ai'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const response = await fetch(`${OPENONION_API_URL}/api/v1/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  const response = await fetch(`${OPENONION_API_URL}/api/v1/auth/me`, {
    headers: authHeader ? { 'Authorization': authHeader } : {},
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
