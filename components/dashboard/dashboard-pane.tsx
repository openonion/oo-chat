/**
 * @purpose Renders the agent-authored dashboard.html in a sandboxed iframe and
 *   relays button clicks (data-ochat-skill) back to the chat as skill runs.
 * @llm-note
 *   Safety: agent HTML is untrusted. Two browser-enforced layers, no DOMPurify:
 *   (1) sandbox="allow-scripts" (opaque origin) — the frame can't reach OChat's
 *   localStorage/keys/parent DOM; (2) the CSP + bridge wrapper from build-srcdoc
 *   (see its @llm-note) — only our bridge script runs, every agent <script>/onclick
 *   is blocked, and default-src 'none' blocks network egress. The bridge posts
 *   {skill,args} to the parent; the parent validates the skill and runs it through
 *   the normal chat send path, so a forged message can only ever produce a visible
 *   /skill turn.
 *
 *   Bridge messages are untrusted *intent*, so the allowlist check fails closed: a
 *   missing `skills` list (agent info still loading) runs nothing rather than
 *   accepting whatever name the frame supplies. The name is shape-checked too, since
 *   it is interpolated into a chat message — without that, a hostile dashboard could
 *   smuggle newlines and arbitrary prose into a user turn during the load window.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSrcDoc, generateNonce } from './build-srcdoc'

/** Skill names come from directory names: no spaces, no newlines, no separators. */
const SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

interface DashboardPaneProps {
  html: string | null
  /** User-invocable skills; a button only runs if its skill is in this list. */
  skills?: { name: string }[]
  onRunSkill: (skill: string, args?: string) => void
  /** True while a snapshot could still arrive; false means this agent has no Home. */
  loading?: boolean
  className?: string
}

export function DashboardPane({ html, skills, onRunSkill, loading, className }: DashboardPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // A dashboard is one self-contained page, so the frame should load exactly once.
  // The bridge cancels link clicks, but nothing stops a `<meta http-equiv="refresh">`
  // — neither the CSP (no `navigate-to` in any browser) nor the sandbox (which only
  // restricts navigating the *top* frame). A second load therefore means the page
  // navigated away from what we rendered, to a document under its own CSP. Replace
  // the frame rather than reload it: re-rendering the same srcDoc would let a
  // zero-delay refresh spin forever.
  const loadedFor = useRef<string | null>(null)
  const [blockedFor, setBlockedFor] = useState<string | null>(null)

  // Rebuild the srcDoc (with a fresh nonce) whenever the snapshot changes. An
  // unchanged snapshot is the same string, so React bails out and the iframe is not
  // reloaded — a run that didn't touch the dashboard leaves it exactly as it was.
  const srcDoc = useMemo(() => (html ? buildSrcDoc(html, generateNonce()) : null), [html])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return
      if (event.data?.type !== 'ochat:skill') return

      const skill = String(event.data.skill || '')
      if (!SKILL_NAME.test(skill)) return
      // Fails closed: until the skill list has loaded, nothing is invocable.
      if (!skills?.some((s) => s.name === skill)) return

      // Collapse whitespace so args can't break out of the single /skill line.
      const args = String(event.data.args || '').replace(/\s+/g, ' ').trim().slice(0, 500)
      onRunSkill(skill, args || undefined)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [skills, onRunSkill])

  // Both are keyed on the current srcDoc, so a new snapshot is a fresh document
  // whose first load is expected again — no reset needed.
  const navigatedAway = blockedFor !== null && blockedFor === srcDoc

  if (navigatedAway) {
    return (
      <div className={className}>
        <div className="h-full flex items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-400">
            This dashboard tried to navigate away and was blocked. A Home page is a
            single self-contained page — it can run skills, but not link out.
          </p>
        </div>
      </div>
    )
  }

  if (!srcDoc) {
    // Nothing on the wire says "this agent has no dashboard" — the Host simply never
    // sends one. So `loading` has to come from the caller (are we still connecting?),
    // or this pane sits on a spinner forever for every agent whose host predates the
    // feature.
    return (
      <div className={className}>
        <div className="h-full flex items-center justify-center p-8 text-center">
          <p className="text-sm text-neutral-400">
            {loading ? 'Loading dashboard…' : 'This agent has no Home page yet.'}
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
      onLoad={() => {
        if (loadedFor.current !== srcDoc) { loadedFor.current = srcDoc; return }
        setBlockedFor(srcDoc)
      }}
      className={className}
    />
  )
}
