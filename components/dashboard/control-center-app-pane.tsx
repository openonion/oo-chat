'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createControlCenterHost, boundControlSnapshot, type ControlActionContext, type ControlSnapshot, type ControlCenterState, type ControlCenterCommand } from '@connectonion/react'
import { capabilityPolicy, validateControlCenterApp, type ControlCenterActionResult, type ControlCenterAppDescriptor, type ControlCenterConversationTarget } from './control-center-app'
import { ControlCenterControls } from './control-center-controls'

type Props = {
  app: ControlCenterAppDescriptor | null
  state?: ControlCenterState | null
  agentAddress: string
  agentName?: string
  sessionId: string | null
  skills: { name: string; description?: string }[]
  snapshot?: ControlSnapshot
  command?: (action: ControlCenterCommand, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>
  onSendMessage: (message: string, target: ControlCenterConversationTarget, context?: ControlActionContext) => Promise<ControlCenterActionResult>
  onRunSkill: (skill: string, args: string | undefined, target: ControlCenterConversationTarget, context?: ControlActionContext) => Promise<ControlCenterActionResult>
  className?: string
}

export function ControlCenterAppPane({app, state, agentAddress, sessionId, skills, snapshot, command, onSendMessage, onRunSkill, className}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bridge = useRef<ReturnType<typeof createControlCenterHost> | null>(null)
  const actions = useRef({onSendMessage, onRunSkill})
  const currentSnapshot = useRef<ControlSnapshot | null>(null)
  const loads = useRef(0)
  const deadline = useRef<number | undefined>(undefined)
  const [connected, setConnected] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [focused, setFocused] = useState(false)
  const [view, setView] = useState<'preview' | 'code'>('preview')
  const [pinnedRevision, setPinnedRevision] = useState<string | null>(null)
  const parentOrigin = typeof window === 'undefined' ? '' : window.location.origin
  const validation = useMemo(() => validateControlCenterApp(app, parentOrigin), [app, parentOrigin])
  const validated = validation.app
  const revision = validated?.revision
  const appOrigin = validated?.origin
  const approved = validated?.review.status === 'approved'
  const source = useMemo(() => {
    if (!validated) return undefined
    const url = new URL(validated.url)
    url.hash = new URLSearchParams({'co-parent':parentOrigin, 'co-revision':validated.revision}).toString()
    return url.href
  }, [validated, parentOrigin])
  const conversation = useMemo<ControlSnapshot>(() => boundControlSnapshot(snapshot ?? {
    agentAddress, sessionId, skills, chatItems:[], status:'idle', connectionState:'connected',
  }), [snapshot, agentAddress, sessionId, skills])

  useEffect(() => { actions.current = {onSendMessage, onRunSkill} }, [onSendMessage, onRunSkill])
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.get('view') === 'control-center') {
      // Browser-only layout selection; the normal shell restores the Host session first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocused(true)
      setPinnedRevision(query.get('revision'))
    }
  }, [])
  useEffect(() => {
    currentSnapshot.current = conversation
    bridge.current?.publish(conversation)
  }, [conversation])
  useEffect(() => {
    if (!approved || !revision || !appOrigin || (pinnedRevision && pinnedRevision !== revision)) return
    loads.current = 0
    // New revision/load owns a new handshake; previous readiness cannot carry over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnected(false)
    setFailure(null)
    let disposed = false
    deadline.current = window.setTimeout(() => {
      if (!bridge.current && !disposed) setFailure('The app did not connect. Retry or ask the Agent to fix it.')
    }, 15000)
    const receive = (event: MessageEvent) => {
      const value = event.data
      if (disposed || event.source !== frameRef.current?.contentWindow || event.origin !== appOrigin
          || !value || value.type !== 'connectonion.control-center/ready' || value.version !== 1
          || value.revision !== revision || bridge.current) return
      const channel = new MessageChannel()
      const epoch = crypto.randomUUID()
      frameRef.current.contentWindow!.postMessage({type:'connectonion.control-center/connect',version:1,revision,epoch}, appOrigin, [channel.port2])
      bridge.current = createControlCenterHost(channel.port1, {revision, epoch, snapshot:currentSnapshot.current!,
        sendMessage:(message, context)=>actions.current.onSendMessage(message, context.conversation, context),
        runSkill:(skill,args,context)=>actions.current.onRunSkill(skill,args,context.conversation,context),
      })
      window.clearTimeout(deadline.current)
      setConnected(true); setFailure(null)
    }
    window.addEventListener('message', receive)
    return () => {
      disposed = true; window.clearTimeout(deadline.current); window.removeEventListener('message', receive)
      bridge.current?.dispose(); bridge.current=null
    }
  }, [approved, revision, appOrigin, reload, pinnedRevision])

  const retry = () => { bridge.current?.dispose(); bridge.current=null; setConnected(false); setFailure(null); setReload(value=>value+1) }
  const newTab = revision && sessionId ? `/${encodeURIComponent(agentAddress)}/${encodeURIComponent(sessionId)}?view=control-center&revision=${encodeURIComponent(revision)}` : null
  const blocked = validated && !approved
  const pinnedMismatch = pinnedRevision && pinnedRevision !== revision

  return <div ref={containerRef} className={`${focused ? 'fixed inset-0 z-50 bg-white dark:bg-neutral-950' : `relative ${className ?? ''}`} flex min-h-0 min-w-0 flex-col`}>
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <button className="min-h-11 rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-pressed={view==='preview'} onClick={()=>setView('preview')}>Preview</button>
      {command && <button className="min-h-11 rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-pressed={view==='code'} onClick={()=>setView('code')}>Code</button>}
      <span className="flex-1" />
      <button className="min-h-11 rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={()=>setFocused(!focused)}>{focused ? 'Exit focus' : 'Focus'}</button>
      <button className="min-h-11 rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={()=>{void containerRef.current?.requestFullscreen?.().catch(()=>setFailure('Fullscreen is unavailable in this browser.'))}}>Fullscreen</button>
      {newTab && <a href={newTab} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800">New tab</a>}
    </div>
    {command && <ControlCenterControls state={state ?? null} command={command} showCode={view==='code'} onFix={()=>onSendMessage('Fix the Control Center findings and update the app through update_control_center.', 'current')} />}
    <div className={`${view==='preview'?'flex':'hidden'} relative min-h-0 flex-1 flex-col`}>
      {pinnedMismatch ? <div role="alert" className="p-6 text-sm">The approved revision has changed. <button className="underline" onClick={()=>setPinnedRevision(null)}>Open the current approved app</button></div>
      : blocked ? <div role={validated.review.status==='blocked'?'alert':'status'} className="p-6 text-sm">{validated.review.status==='blocked'?'Control Center blocked by review':'Control Center is being reviewed'}</div>
      : !validated ? <div role="status" className="p-6 text-sm text-neutral-500">{validation.error || (state?.status==='reviewing'?'Control Center is being reviewed.':'No approved Control Center app yet.')}</div>
      : <>
        {!connected && !failure && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50 text-sm dark:bg-neutral-950">Connecting Control Center…</div>}
        {failure && <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white p-6 text-center text-sm dark:bg-neutral-950"><p>{failure}</p><button className="min-h-11 rounded border px-4" onClick={retry}>Retry app</button>{command && <button className="min-h-11 rounded border px-4" onClick={()=>{void onSendMessage('Fix the Control Center loading failure and update the app.', 'current')}}>Fix with AI</button>}</div>}
        <iframe key={`${revision}:${reload}`} ref={frameRef} title="Agent Control Center app" src={source}
          allow={capabilityPolicy(validated.capabilities)} allowFullScreen={validated.capabilities?.includes('fullscreen')}
          referrerPolicy="no-referrer" onError={()=>setFailure('The app could not load.')}
          onLoad={()=>{loads.current++; if (loads.current>1) {bridge.current?.dispose();bridge.current=null;setConnected(false);setFailure(null);window.clearTimeout(deadline.current);deadline.current=window.setTimeout(()=>setFailure('The app did not reconnect. Retry or ask the Agent to fix it.'),15000)}}}
          className="block h-full min-h-0 w-full flex-1 border-0" />
      </>}
    </div>
  </div>
}
