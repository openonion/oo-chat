'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAgentForHuman } from '@connectonion/react'
import { useIdentity } from '@/hooks/use-identity'
import { isAgentAddress } from '@/hooks/use-agent-info'
import { InvalidAddress } from '@/components/invalid-address'

const WIKI_CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'\">"

export default function WikiPage() {
  const { address } = useParams<{ address: string }>()
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  useIdentity()
  const { connect, connectionState, error, wikiRead } = useAgentForHuman(address, sessionId)
  const [html, setHtml] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)

  useEffect(() => { connect() }, [connect])
  useEffect(() => {
    if (connectionState !== 'connected') return
    wikiRead().then(setHtml, cause => setReadError(String(cause)))
  }, [connectionState, wikiRead])

  if (!isAgentAddress(address)) return <InvalidAddress address={address} />
  if (readError || error) return <main role="alert" className="p-8">{readError || error?.message}</main>
  if (!html) return <main className="p-8">Opening Wiki…</main>
  return <iframe title="Private Wiki" sandbox="allow-scripts" className="block h-dvh w-full border-0"
    srcDoc={html.replace('<head>', `<head>${WIKI_CSP}`)} />
}
