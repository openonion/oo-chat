/**
 * @purpose Next.js API route for HTTP-based chat - handles both LLM completions and agent requests
 * @llm-note
 *   Dependencies: imports from [next/server, connectonion, path] | called by [app/page.tsx via fetch('/api/chat')] | no test files found
 *   Data flow: receives POST {message: string, messages: ChatMessage[], apiKey?: string, model?: string, agentUrl?: string, agentSession?: unknown} → if agentUrl: signs request with Ed25519 + POSTs to agent/input → if LLM: calls createLLM().complete() → returns {response: string, session?: unknown}
 *   State/Effects: module-level serverKeys cache (singleton) | generates/loads Ed25519 keys from .co/ directory | POSTs to external agent URLs or LLM APIs
 *   Integration: exposes POST /api/chat endpoint | used by app/page.tsx's useChat hook when connectionMode='llm' OR agent non-streaming mode | supports stateful agent sessions via session parameter
 *   Performance: serverKeys cached in memory (regenerated on server restart) | synchronous key loading/generation on first request
 *   Errors: returns JSON errors with appropriate status codes | agent errors forwarded from agent response | LLM errors bubble up from SDK
 *
 * Two Connection Modes:
 *
 *   1. Agent Mode (agentUrl provided):
 *      - Fetch agent address from {agentUrl}/info
 *      - Create Ed25519 signed payload with prompt, to, timestamp
 *      - POST to {agentUrl}/input with {payload, from, signature, session?}
 *      - Returns {response: agent result, session: updated session}
 *      - Session enables multi-turn conversations (agent maintains state)
 *
 *   2. LLM Mode (no agentUrl):
 *      - Build message history from messages array
 *      - Create LLM instance via createLLM(model, apiKey)
 *      - Call llm.complete(messages, tools=[])
 *      - Returns {response: LLM content}
 *      - Stateless (no session)
 *
 * Ed25519 Signing (Agent Mode):
 *   - Server generates/loads keypair from .co/ directory
 *   - Creates canonical JSON: sorted keys for {prompt, to, timestamp}
 *   - Signs with address.sign(keys, canonicalMessage)
 *   - Sends {payload, from: publicKey, signature}
 *   - Agent verifies signature before processing
 *
 * Server Keys Management:
 *   - Singleton serverKeys variable (module scope)
 *   - getServerKeys() loads from .co/ or generates new
 *   - NOT saved to disk in current implementation (regenerated on restart)
 *   - Production should persist keys to avoid changing identity
 *
 * Session Handling:
 *   - Agent mode: session passed in body, returned in response
 *   - Enables stateful multi-turn conversations
 *   - Session contains: session_id, messages, trace, turn
 *   - Frontend stores session per conversation
 *
 * File Relationships:
 *     app/
 *     ├── api/chat/route.ts   # THIS FILE - API endpoint
 *     └── page.tsx            # Client, calls via fetch('/api/chat')
 *
 *     components/chat/
 *     └── use-chat.ts         # Hook that calls this endpoint
 *
 * Related ConnectOnion SDK:
 *     connectonion/
 *     ├── llm.ts              # createLLM() function
 *     ├── address.ts          # Ed25519 signing utilities
 *     └── connect.ts          # RemoteAgent class (not used here, direct fetch instead)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createLLM, connect, address } from 'connectonion'
import { join } from 'path'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Load or generate server keys for signed requests
let serverKeys: ReturnType<typeof address.load> = null

function getServerKeys() {
  if (serverKeys) return serverKeys

  // Try to load existing keys
  const coDir = join(process.cwd(), '.co')
  serverKeys = address.load(coDir)

  if (!serverKeys) {
    // Generate new keys if none exist
    console.log('Generating new server keys for oo-chat...')
    serverKeys = address.generate()
    // Note: In production, you'd want to save these keys
    // For now, they're regenerated on each server restart
  }

  console.log(`oo-chat identity: ${serverKeys.shortAddress}`)
  return serverKeys
}

export async function POST(request: NextRequest) {
  const { message, messages, apiKey, model, agentUrl, agentSession } = await request.json()

  // If agentUrl is provided, connect to remote agent with signing
  if (agentUrl) {
    const keys = getServerKeys()

    // Extract agent address from URL
    // URL pattern: https://{name}-{short_address}.agents.openonion.ai
    const addressMatch = agentUrl.match(/-(0x[a-f0-9]+)\./i)
    let agentAddress = addressMatch ? addressMatch[1] : ''

    // If we have a short address, fetch the full address from /info
    if (agentAddress && agentAddress.length < 66) {
      const infoResponse = await fetch(`${agentUrl}/info`)
      if (infoResponse.ok) {
        const info = await infoResponse.json() as { address?: string }
        agentAddress = info.address || ''
      } else {
        agentAddress = ''
      }
    }

    // Direct HTTP with session support for multi-turn conversations
    const body = createSignedBody(keys, message, agentAddress || '0x', agentSession)
    const response = await fetch(`${agentUrl}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Agent error: ${error}` }, { status: response.status })
    }

    const data = await response.json() as {
      result?: string
      response?: string
      content?: string
      session?: unknown
    }
    const content = typeof data === 'string' ? data : (data.response || data.content || data.result || JSON.stringify(data))

    // Return session for multi-turn conversation continuation
    return NextResponse.json({
      response: content,
      session: data.session,
    })
  }

  // Otherwise use direct LLM connection
  const history = messages
    .filter((m: ChatMessage) => m.role !== 'system')
    .map((m: ChatMessage) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  history.push({ role: 'user' as const, content: message })

  const llm = createLLM(model || 'co/gemini-2.5-flash', apiKey || undefined)

  const llmMessages = [
    { role: 'system' as const, content: 'You are a helpful AI assistant. Be concise and helpful.' },
    ...history,
  ]

  const result = await llm.complete(llmMessages, [])
  return NextResponse.json({ response: result.content })
}

/**
 * Create signed request body for direct fetch (when address not extractable)
 */
function createSignedBody(
  keys: NonNullable<ReturnType<typeof address.load>>,
  prompt: string,
  toAddress: string,
  session?: unknown
): Record<string, unknown> {
  const payload = {
    prompt,
    to: toAddress,
    timestamp: Math.floor(Date.now() / 1000),
  }

  // Canonical JSON with sorted keys
  const sortedKeys = Object.keys(payload).sort()
  const sortedPayload: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    sortedPayload[key] = payload[key as keyof typeof payload]
  }
  const canonicalMessage = JSON.stringify(sortedPayload)

  const signature = address.sign(keys, canonicalMessage)

  const body: Record<string, unknown> = {
    payload,
    from: keys.address,
    signature,
  }

  // Include session for multi-turn conversation continuation
  if (session) {
    body.session = session
  }

  return body
}
