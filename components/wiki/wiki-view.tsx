/**
 * @purpose The full-page private Wiki (connectonion#1637): read the owner's
 *   notebook from their Host over a signed OIP `WIKI_READ` and render it alone,
 *   with no sidebar, chat or Control Center around it.
 * @llm-note
 *   Order of checks, each with its own message and next step, because a blank or
 *   eternally "Opening…" page is what `co wiki open` produced before (#1828):
 *   1. relay directory says the Host is not connected → offline (no socket opened);
 *   2. the Host gates this browser (ONBOARD_REQUIRED, or WIKI_RESULT refusing a
 *      non-admin) → denied, with the exact `co trust admin add` line;
 *   3. WIKI_RESULT errors → unavailable / too large / outdated Host;
 *   4. nothing at all within READ_DEADLINE_MS → "did not answer", with retry.
 *   No state before `ready` ever renders notebook content.
 *
 *   One session id per browser and agent, kept in localStorage, not a new UUID
 *   per visit: the SDK persists every session it opens and keeps only the 20
 *   most recent, so a fresh id on each Wiki visit would push real chats out.
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { HiOutlineBookOpen, HiOutlineExclamationCircle, HiOutlineLockClosed, HiOutlineStatusOffline } from 'react-icons/hi'
import { useAgentForHuman } from '@connectonion/react'
import { buildWikiSrcDoc, WIKI_SANDBOX } from './build-wiki-srcdoc'
import { classifyWikiError, type WikiProblem } from './wiki-state'

/** A Host renders the notebook on request; a large one takes a few seconds. */
const READ_DEADLINE_MS = 25_000

export function wikiSessionId(address: string): string {
  const key = `oo-chat:wiki-session:${address}`
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const created = `wiki-${crypto.randomUUID()}`
    localStorage.setItem(key, created)
    return created
  } catch {
    return `wiki-${crypto.randomUUID()}`
  }
}

type ReadState = { kind: 'loading' } | { kind: 'ready'; html: string } | WikiProblem

interface WikiReaderProps {
  address: string
  browserAddress: string
}

/** Mounted only once the Host is known to be online and this browser has a key. */
export function WikiReader({ address, browserAddress }: WikiReaderProps) {
  // Client-only: this component mounts after the browser identity has loaded.
  const sessionId = useMemo(() => wikiSessionId(address), [address])
  const { wikiRead, ui } = useAgentForHuman(address, sessionId)
  const [state, setState] = useState<ReadState>({ kind: 'loading' })
  const gated = ui.some(item => item.type === 'onboard_required')

  useEffect(() => {
    let active = true
    const deadline = setTimeout(() => {
      if (active) setState(s => (s.kind === 'loading' ? { kind: 'failed', message: 'The Host did not answer.' } : s))
    }, READ_DEADLINE_MS)
    wikiRead().then(
      html => { if (active) setState({ kind: 'ready', html }) },
      cause => { if (active) setState(classifyWikiError(cause)) },
    ).finally(() => clearTimeout(deadline))
    return () => { active = false; clearTimeout(deadline) }
  }, [wikiRead])

  if (gated && state.kind === 'loading') return <WikiNotice problem={{ kind: 'denied' }} browserAddress={browserAddress} />
  if (state.kind === 'loading') return <WikiLoading label="Opening Wiki…" />
  if (state.kind === 'ready') return <WikiFrame html={state.html} />
  return <WikiNotice problem={state} browserAddress={browserAddress} />
}

function WikiFrame({ html }: { html: string }) {
  const srcDoc = useMemo(() => buildWikiSrcDoc(html), [html])
  // The reader is one page with fragment navigation, so the frame loads once. A
  // second load means something replaced it (a meta refresh, a script setting
  // location) with a document outside our CSP; show that instead of it.
  const loads = useRef(0)
  const [navigatedAway, setNavigatedAway] = useState(false)
  if (navigatedAway) {
    return (
      <WikiCard icon="alert" title="The Wiki tried to leave this page">
        <p>It was blocked. The Wiki is a single page and does not navigate away. Reload to open it again.</p>
        <RetryButton />
      </WikiCard>
    )
  }
  return (
    <iframe
      title="Private Wiki"
      sandbox={WIKI_SANDBOX}
      allow="clipboard-write"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      onLoad={() => { loads.current += 1; if (loads.current > 1) setNavigatedAway(true) }}
      className="block h-dvh w-full border-0 bg-white"
    />
  )
}

export function WikiLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-6 text-center" role="status" aria-live="polite">
      <p className="text-sm text-neutral-600">{label}</p>
    </div>
  )
}

export function WikiNotice({ problem, browserAddress }: { problem: WikiProblem; browserAddress?: string }) {
  switch (problem.kind) {
    case 'offline':
      return (
        <WikiCard icon="offline" title="Host offline">
          <p>
            The Wiki is read live from the computer that runs this agent, and that Host is not
            connected right now. Nothing from the notebook is stored here.
          </p>
          <NextStep>
            On that computer, start the Host with <Cmd>co ai</Cmd>, then retry. To read the notebook
            without the Host, run <Cmd>co wiki open --local</Cmd> there.
          </NextStep>
          <RetryButton />
        </WikiCard>
      )
    case 'denied':
      return (
        <WikiCard icon="lock" title="Not your agent's Wiki">
          <p>
            This Wiki is private to the owner of this agent&apos;s Host, and this browser is not one
            of its administrators. No notebook content was sent.
          </p>
          <NextStep>
            If this is your agent, allow this browser on the Host computer, then retry:
            {browserAddress && <Cmd block>co trust admin add {browserAddress}</Cmd>}
          </NextStep>
          <RetryButton />
        </WikiCard>
      )
    case 'unavailable':
      return (
        <WikiCard icon="book" title="No Wiki on this Host">
          <p>The Host is online but has no notebook to show.</p>
          <NextStep>
            On the Host computer, build it with <Cmd>co wiki init</Cmd>, then retry.
          </NextStep>
          <RetryButton />
        </WikiCard>
      )
    case 'too-large':
      return (
        <WikiCard icon="alert" title="Wiki too large to open here">
          <p>The notebook is bigger than the 16 MiB a Host sends to the browser.</p>
          <NextStep>On the Host computer, open it with <Cmd>co wiki open --local</Cmd>.</NextStep>
        </WikiCard>
      )
    case 'outdated':
      return (
        <WikiCard icon="alert" title="This Host cannot serve the Wiki yet">
          <p>The Host&apos;s ConnectOnion version predates the private Wiki.</p>
          <NextStep>
            On the Host computer, upgrade with <Cmd>pip install -U connectonion</Cmd> and restart{' '}
            <Cmd>co ai</Cmd>, then retry.
          </NextStep>
          <RetryButton />
        </WikiCard>
      )
    case 'failed':
      return (
        <WikiCard icon="alert" title="Wiki could not be opened">
          <p>{problem.message}</p>
          <NextStep>
            Check that <Cmd>co ai</Cmd> is still running on the Host computer, then retry.
          </NextStep>
          <RetryButton />
        </WikiCard>
      )
  }
}

const ICONS = {
  offline: HiOutlineStatusOffline,
  lock: HiOutlineLockClosed,
  book: HiOutlineBookOpen,
  alert: HiOutlineExclamationCircle,
}

function WikiCard({ icon, title, children }: { icon: keyof typeof ICONS; title: string; children: React.ReactNode }) {
  const Icon = ICONS[icon]
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-10">
      <section role="alert" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Private Wiki</p>
        <div className="mt-3 flex items-center gap-2">
          <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-neutral-500" />
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">{title}</h1>
        </div>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-700">{children}</div>
        <Link href="/" className="mt-6 inline-block text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
          Go to your agents
        </Link>
      </section>
    </main>
  )
}

function NextStep({ children }: { children: React.ReactNode }) {
  return <p><span className="font-semibold text-neutral-900">Next: </span>{children}</p>
}

function Cmd({ children, block }: { children: React.ReactNode; block?: boolean }) {
  return block
    ? <code className="mt-2 block break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-900">{children}</code>
    : <code className="whitespace-nowrap rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-900">{children}</code>
}

function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      Retry
    </button>
  )
}
