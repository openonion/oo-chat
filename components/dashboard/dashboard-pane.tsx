/**
 * @purpose Renders the agent-authored dashboard.html in a sandboxed iframe and
 *   relays button clicks (data-ochat-skill) back to the chat as skill runs.
 * @llm-note
 *   Safety: agent HTML is untrusted. Two browser-enforced layers, no DOMPurify:
 *   (1) sandbox="allow-scripts" (opaque origin) — the frame can't reach OChat's
 *   localStorage/keys/parent DOM; (2) an injected CSP <meta> with a per-render
 *   nonce — only our bridge script runs, every agent <script>/onclick is blocked,
 *   and default-src 'none' blocks network egress. The bridge posts {skill,args}
 *   to the parent; the parent validates the skill and runs it through the normal
 *   chat send path, so a forged message can only ever produce a visible /skill turn.
 */
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { buildSrcDoc, generateNonce } from './build-srcdoc'

interface DashboardPaneProps {
  html: string | null
  /** User-invocable skills; a button is only run if its skill is in this list. */
  skills?: { name: string }[]
  onRunSkill: (skill: string, args?: string) => void
  className?: string
}

export function DashboardPane({ html, skills, onRunSkill, className }: DashboardPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Rebuild the srcDoc (with a fresh nonce) whenever the snapshot changes.
  const srcDoc = useMemo(() => (html ? buildSrcDoc(html, generateNonce()) : null), [html])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'ochat:skill') return
      const skill = String(event.data.skill || '')
      if (!skill) return
      // Bridge messages are untrusted intent: only run a real user-invocable skill.
      if (skills && !skills.some((s) => s.name === skill)) return
      const args = String(event.data.args || '').slice(0, 500)
      onRunSkill(skill, args || undefined)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [skills, onRunSkill])

  if (!srcDoc) {
    return (
      <div className={className}>
        <div className="h-full flex items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-400">
            Loading dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title="Agent dashboard"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className={className}
    />
  )
}
