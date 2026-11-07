/**
 * @purpose Renders the agent's Control Center snapshot in a sandboxed iframe and
 *   answers its bridge: skills (data-ochat-skill) and prompts (the Run box,
 *   data-ochat-prompt suggestions) become ordinary chat turns, data-ochat-open
 *   switches to Chat, data-ochat-copy copies. The frame gets O Chat's theme and is
 *   told when Run must wait (offline, busy) without losing its draft.
 * @llm-note
 *   Safety: agent HTML is untrusted. Two browser-enforced layers, no DOMPurify:
 *   (1) sandbox="allow-scripts" (opaque origin) — the frame can't reach OChat's
 *   localStorage/keys/parent DOM; (2) the CSP + bridge wrapper from build-srcdoc
 *   (see its @llm-note) — only our bridge script runs, every agent <script>/onclick
 *   is blocked, and default-src 'none' blocks network egress. The bridge posts
 *   intents to the parent; control-center-bridge.ts validates them and the page
 *   sends them through the normal chat path, so a forged message can only ever
 *   produce a visible turn.
 *
 *   Bridge messages are untrusted *intent*, so the allowlist check fails closed: a
 *   missing `skills` list (agent info still loading) runs nothing rather than
 *   accepting whatever name the frame supplies. The name is shape-checked too, since
 *   it is interpolated into a chat message — without that, a hostile dashboard could
 *   smuggle newlines and arbitrary prose into a user turn during the load window.
 */
'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { buildSrcDoc, generateNonce } from './build-srcdoc'
import { readBridgeMessage } from './control-center-bridge'
import { useControlCenterDocked, useShowChat } from './workspace-shell'

interface DashboardPaneProps {
  html: string | null
  /** User-invocable skills; a button only runs if its skill is in this list. */
  skills?: { name: string }[]
  onRunSkill: (skill: string, args?: string) => void
  /** The Run box and prompt suggestions: sent as an ordinary message. */
  onSendPrompt: (prompt: string) => void
  /** Why a run cannot start now (offline, busy), or null when it can. */
  runBlockedReason?: string | null
  agentName: string
  /** True while a snapshot could still arrive; false means this agent has no Home. */
  loading?: boolean
  className?: string
}

function postCanRun(frame: HTMLIFrameElement | null, reason: string | null) {
  frame?.contentWindow?.postMessage({ type: 'ochat:can-run', value: !reason, reason: reason ?? '' }, '*')
}

const DARK = '(prefers-color-scheme: dark)'

/** O Chat's own theme: it follows the OS unless the page pins data-theme="light". */
function useAppTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DARK)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => document.documentElement.dataset.theme !== 'light' && window.matchMedia(DARK).matches ? 'dark' : 'light',
    () => 'light',
  )
}

export function DashboardPane({
  html, skills, onRunSkill, onSendPrompt, runBlockedReason = null, agentName, loading, className,
}: DashboardPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const showChat = useShowChat()
  const theme = useAppTheme()
  const embed = useControlCenterDocked() ? 'docked' : 'full'
  // A dashboard is one self-contained page, so the frame should load exactly once.
  // The bridge cancels link clicks and form submissions, but nothing stops a
  // `<meta http-equiv="refresh">` — neither the CSP (no `navigate-to` in any
  // browser) nor the sandbox (which only restricts navigating the *top* frame). A
  // second load therefore means the page navigated away from what we rendered, to a
  // document under its own CSP. Replace the frame rather than reload it:
  // re-rendering the same srcDoc would let a zero-delay refresh spin forever.
  const loadedFor = useRef<string | null>(null)
  const [blockedFor, setBlockedFor] = useState<string | null>(null)

  // Rebuild the srcDoc (with a fresh nonce) whenever the snapshot or theme changes.
  // An unchanged snapshot is the same string, so React bails out and the iframe is
  // not reloaded — a run that didn't touch the dashboard leaves it exactly as it was.
  // The agent's name is deliberately not part of it: the name resolves after the
  // snapshot arrives, and a reload then would wipe a draft in the Run box. It names
  // the frame through its title attribute instead.
  // Docking changes only with the pane or the window, never while a draft is
  // open in a docked page, because a docked page has no Run box to type in.
  const rendered = useMemo(() => {
    if (!html) return null
    const channel = generateNonce()
    return { channel, srcDoc: buildSrcDoc(html, generateNonce(), channel, theme, embed) }
  }, [html, theme, embed])
  const srcDoc = rendered?.srcDoc ?? null
  const channel = rendered?.channel ?? ''

  // Tell the frame whether Run may be pressed. Re-sent for every new document; the
  // "running" fold is never re-sent, because the next snapshot already shows that
  // run in Now and re-applying it would show the run twice.
  useEffect(() => postCanRun(iframeRef.current, runBlockedReason), [runBlockedReason])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = iframeRef.current?.contentWindow
      if (!frame || event.source !== frame) return
      const intent = readBridgeMessage(event.data, skills, channel)
      if (!intent) return
      const reply = (message: object) => frame.postMessage(message, '*')

      if (intent.kind === 'open-chat') { showChat(); return }
      if (intent.kind === 'copy') {
        navigator.clipboard.writeText(intent.value).then(
          () => reply({ type: 'ochat:copied', ok: true }),
          () => reply({ type: 'ochat:copied', ok: false }),
        )
        return
      }
      if (runBlockedReason) { reply({ type: 'ochat:refused', reason: runBlockedReason }); return }
      if (intent.kind === 'skill') onRunSkill(intent.skill, intent.args)
      else onSendPrompt(intent.prompt)
      reply({ type: 'ochat:started', task: intent.task })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [skills, onRunSkill, onSendPrompt, runBlockedReason, showChat, channel])

  // Both are keyed on the current srcDoc, so a new snapshot is a fresh document
  // whose first load is expected again — no reset needed.
  const navigatedAway = blockedFor !== null && blockedFor === srcDoc

  if (navigatedAway || !srcDoc) {
    // Nothing on the wire says "this agent has no dashboard" — the Host simply never
    // sends one. So `loading` has to come from the caller (are we still connecting?),
    // or this pane sits on a spinner forever for every agent whose host predates the
    // feature.
    const message = navigatedAway
      ? 'This Control Center tried to open another page and was stopped. It can run tasks here, but not link out.'
      : loading ? 'Loading Control Center…' : `${agentName} has no Control Center yet.`
    return (
      <div className={className}>
        <div className="flex h-full items-center justify-center p-8 text-center">
          <p className="max-w-[40ch] text-sm text-co-muted">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      title={`${agentName} Control Center`}
      // allow-forms gives the Run box real submit semantics (Enter, keyboard and
      // assistive-tech submit, native required/maxlength checks). It cannot
      // navigate: the bridge cancels every submit and the CSP says form-action 'none'.
      sandbox="allow-scripts allow-forms"
      srcDoc={srcDoc}
      onLoad={() => {
        if (loadedFor.current !== srcDoc) { loadedFor.current = srcDoc; postCanRun(iframeRef.current, runBlockedReason); return }
        setBlockedFor(srcDoc)
      }}
      className={className}
    />
  )
}
