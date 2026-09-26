import { NextResponse } from 'next/server'
import { publicCapabilities } from '../../../../lib/agent-capabilities'

const API_URL = process.env.NEXT_PUBLIC_OPENONION_API_URL || 'https://oo.openonion.ai'

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/agents?limit=100`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`Directory returned ${response.status}`)

    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || !('agents' in data) || !Array.isArray(data.agents)) {
      throw new Error('Invalid directory response')
    }

    // The relay also returns endpoints and the full raw tool/skill inventory.
    // Project a small set of described, user-facing capabilities for discovery.
    const agents = data.agents.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('address' in entry)) return []
      const item = entry as { address: unknown; profile?: unknown }
      if (typeof item.address !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(item.address)) return []
      const profile = item.profile && typeof item.profile === 'object'
        ? item.profile as Record<string, unknown>
        : {}
      const rawName = profile.name || profile.alias
      const name = typeof rawName === 'string' && rawName.trim()
        ? rawName.trim().slice(0, 80)
        : null
      const model = typeof profile.model === 'string' && profile.model.trim()
        ? profile.model.trim().slice(0, 60)
        : null
      const skillCount = Array.isArray(profile.skills) ? profile.skills.length : 0
      const capabilities = publicCapabilities(profile.skills, 2)
      return [{ address: item.address, name, model, skillCount, capabilities }]
    })

    // A complete public profile gives a visitor a real reason to choose an agent.
    // Keep undescribed agents reachable, but place them after described ones.
    agents.sort((a, b) =>
      Number(b.capabilities.length > 0) - Number(a.capabilities.length > 0)
      || (a.name || a.address).localeCompare(b.name || b.address)
    )

    return NextResponse.json({ agents }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'Could not load online agents. Please try again.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
