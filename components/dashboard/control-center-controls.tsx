'use client'

import { useEffect, useRef, useState } from 'react'
import type { ControlCenterCommand, ControlCenterState } from '@connectonion/react'

type Command = (action:ControlCenterCommand, payload?:Record<string,unknown>) => Promise<Record<string,unknown>>
type Props = {state:ControlCenterState|null; command:Command; showCode:boolean; onFix:()=>Promise<unknown>}
const button = 'min-h-11 rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
const input = 'min-h-11 w-full rounded border border-neutral-300 bg-transparent px-3 text-sm dark:border-neutral-700'
const text = (value:unknown) => typeof value==='string' ? value : ''
const when = (value:unknown) => typeof value==='number' ? new Date(value*1000).toLocaleString() : 'Not yet'

export function ControlCenterControls({state,command,showCode,onFix}:Props) {
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [panel,setPanel]=useState<'history'|'updates'|null>(null)
  const actions=useRef(command)
  useEffect(()=>{actions.current=command},[command])
  const run=async(action:()=>Promise<unknown>)=>{
    setBusy(true);setError(null)
    try {await action()} catch(cause) {setError(cause instanceof Error?cause.message:'The action failed.')}
    finally {setBusy(false)}
  }
  const updates=state?.updates??{}
  const reviewing=state?.status==='reviewing'||updates.last_status==='running'
  const last=state?.history[state.history.length-1]
  const findings=Array.isArray(last?.findings)?last.findings as Record<string,unknown>[]:[]
  const label=reviewing?'Reviewing':state?.status==='blocked'?'Blocked':state?.active?'Approved by AI':'Awaiting first review'
  return <>
    <div className="shrink-0 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="mr-auto text-sm font-medium">{label}</span>
        <button className={button} disabled={busy||reviewing} onClick={()=>{void run(()=>actions.current('update'))}}>Update app</button>
        <button className={button} aria-expanded={panel==='history'} onClick={()=>setPanel(panel==='history'?null:'history')}>History</button>
        <button className={button} aria-expanded={panel==='updates'} onClick={()=>setPanel(panel==='updates'?null:'updates')}>Updates</button>
      </div>
      {state?.status==='blocked' && <div className="mt-2 text-sm"><p>{state.error?.message??'This build needs changes. The previous approved app remains available.'}</p>
        {findings.map((finding,index)=><p key={index} className="mt-1 break-words">{text(finding.path)}: {text(finding.message)}</p>)}
        <button className={`${button} mt-2`} disabled={busy} onClick={()=>{void run(onFix)}}>Fix with AI</button>
      </div>}
      {error && <p role="alert" className="mt-2 break-words text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
    {panel==='history' && <section aria-label="Revision history" className="max-h-64 shrink-0 overflow-auto border-b p-3 text-sm">
      {!state?.history.length && <p>No review attempts yet.</p>}
      {[...(state?.history??[])].reverse().map((record,index)=><div key={text(record.id)||index} className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1"><p>{text(record.status)} · {when(record.finished_at??record.started_at)}</p><code className="break-all text-xs">{text(record.revision)}</code>
          <p className="text-xs text-neutral-500">{text(record.reviewer_model)}</p></div>
        {record.status==='approved' && record.revision!==state?.active?.revision && <button className={button} disabled={busy} onClick={()=>{void run(()=>actions.current('rollback',{revision:record.revision}))}}>Restore</button>}
      </div>)}
    </section>}
    {panel==='updates' && <section aria-label="App update settings" className="max-h-96 shrink-0 overflow-auto border-b p-3 text-sm">
      <p>Last attempt: {when(updates.last_attempt)}</p><p>Last success: {when(updates.last_success)}</p><p>Next scheduled run: {when(updates.next_run)}</p>
      {Boolean(updates.last_error) && <p role="alert" className="mt-1">{typeof updates.last_error==='string'?updates.last_error:text((updates.last_error as Record<string,unknown>).message)}</p>}
      <form key={JSON.stringify([updates.enabled,updates.every_seconds,updates.at,updates.tz,updates.events])} className="mt-3 grid gap-3" onSubmit={event=>{
        event.preventDefault();const data=new FormData(event.currentTarget);const daily=data.get('frequency')==='daily'
        void run(()=>actions.current('configure',{enabled:data.get('enabled')==='on',every_seconds:daily?null:Number(data.get('seconds')),at:daily?data.get('at'):null,tz:data.get('tz'),events:data.getAll('events')}))
      }}>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={updates.enabled===true}/>Enable automatic updates</label>
        <label>Frequency<select name="frequency" className={input} defaultValue={updates.at?'daily':'interval'}><option value="interval">Interval</option><option value="daily">Daily at a local time</option></select></label>
        <label>Interval in seconds<input className={input} name="seconds" type="number" min={60} max={604800} defaultValue={typeof updates.every_seconds==='number'?updates.every_seconds:3600}/></label>
        <label>Daily time<input className={input} name="at" type="time" defaultValue={text(updates.at)||'09:00'}/></label>
        <label>Timezone<input className={input} name="tz" defaultValue={text(updates.tz)||'UTC'}/></label>
        {[['agent.turn.completed','After Agent turns'],['agent.skill.completed','After skill turns'],['control_center.source.changed','When app source changes']].map(([value,label])=><label key={value} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="events" value={value} defaultChecked={Array.isArray(updates.events)&&updates.events.includes(value)}/>{label}</label>)}
        <p className="text-xs text-neutral-500">The Host checks about once per minute. Missed runs are combined. Daily generation and review budgets apply.</p>
        <button className={button} disabled={busy}>Save update settings</button>
      </form>
    </section>}
    {showCode && <CodeView command={command} state={state}/>}
  </>
}

function CodeView({command,state}:{command:Command;state:ControlCenterState|null}) {
  const [path,setPath]=useState('index.html')
  const [revision,setRevision]=useState('')
  const [base,setBase]=useState('')
  const approved=[...new Set((state?.history??[]).filter(record=>record.status==='approved').map(record=>text(record.revision)))]
  const [source,setSource]=useState<{text:string;files:string[];revision:string}|null>(null)
  const [error,setError]=useState<string|null>(null)
  const action=useRef(command)
  useEffect(()=>{action.current=command},[command])
  useEffect(()=>{
    let alive=true
    void action.current(base?'diff':'source',{path, ...(revision?{revision}:{}), ...(base?{base_revision:base}:{})}).then(result=>{
      if(alive){setSource({text:text(result.text),files:Array.isArray(result.files)?result.files as string[]:[],revision:text(result.revision)});setError(null)}
    },cause=>{if(alive)setError(cause instanceof Error?cause.message:'Source could not be read')})
    return()=>{alive=false}
  },[path,revision,base,state?.active?.revision])
  return <section aria-label="Control Center source" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">Revision<select aria-label="Source revision" className={input} value={revision} onChange={event=>setRevision(event.target.value)}><option value="">Current build</option>{approved.map(value=><option key={value} value={value}>{value.slice(0,19)}</option>)}</select></label>
      <label className="text-sm">Compare with<select aria-label="Compare revision" className={input} value={base} onChange={event=>setBase(event.target.value)}><option value="">Show source</option>{approved.map(value=><option key={value} value={value}>{value.slice(0,19)}</option>)}</select></label>
    </div>
    <label className="text-sm">Build file<select aria-label="Build file" className={input} value={path} onChange={event=>setPath(event.target.value)}>{(source?.files.length?source.files:[path]).map(file=><option key={file}>{file}</option>)}</select></label>
    {error?<p role="alert" className="text-sm text-red-700">{error}</p>:source?<><p className="break-all font-mono text-xs text-neutral-500">{source.revision}</p><pre className="min-h-0 flex-1 overflow-auto rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900"><code>{source.text}</code></pre></>:<p role="status">Loading source…</p>}
  </section>
}
