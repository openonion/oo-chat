'use client'

import {
  HiOutlineCheck,
  HiOutlineShieldCheck,
  HiOutlineX,
  HiOutlineStop,
  HiOutlineQuestionMarkCircle
} from 'react-icons/hi'

export type ApprovalState = 'approved' | 'approved_session' | 'skipped' | 'stopped' | null

interface BatchTool {
  tool: string
  arguments: string
}

interface ApprovalButtonsProps {
  approvalSent: ApprovalState
  onApproval: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => void
  toolName?: string
  description?: string
  batchRemaining?: BatchTool[]
}

function getToolSummary(tool: string, args: string): string {
  const baseTool = tool.split(':')[0]
  try {
    const parsed = JSON.parse(args)
    if (baseTool === 'bash' || baseTool === 'shell' || baseTool === 'run' || baseTool === 'run_background') return parsed.command || ''
    if (baseTool === 'write' || baseTool === 'edit' || baseTool === 'read') return parsed.file_path || parsed.path || ''
    if (baseTool === 'send_email') return parsed.to || ''
    // fallback: show first string value
    const first = Object.values(parsed).find(v => typeof v === 'string')
    return (first as string) || ''
  } catch {
    return args
  }
}

export function ApprovalButtons({ approvalSent, onApproval, toolName, description, batchRemaining }: ApprovalButtonsProps) {
  if (approvalSent) {
    return (
      <div className="py-2 px-1 border-t border-neutral-100 mt-1 animate-in fade-in duration-300">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-medium italic">
          {approvalSent === 'skipped' ? (
            <span className="flex items-center gap-1.5"><HiOutlineX className="w-3.5 h-3.5 shrink-0" /> Tool rejected</span>
          ) : approvalSent === 'stopped' ? (
            <span className="flex items-center gap-1.5 text-red-500"><HiOutlineStop className="w-3.5 h-3.5 shrink-0" /> Execution stopped</span>
          ) : (
            <span className="flex items-center gap-1.5 text-brand-600">
              <HiOutlineCheck className="w-3.5 h-3.5" />
              {approvalSent === 'approved_session' ? 'Session authorized' : 'Approved'} — running...
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 border-l-2 border-neutral-200 bg-neutral-50/50 rounded-r-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="p-1">
        {/* Main Approve Action */}
        <button
          onClick={() => onApproval(true, 'once')}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white transition-colors group"
        >
          <HiOutlineCheck className="w-4 h-4 text-neutral-400 group-hover:text-brand-600" />
          <div className="flex-1">
            <span className="text-sm font-semibold text-neutral-800">Allow once</span>
            <span className="text-xs text-neutral-500 ml-2 font-normal">{description || 'Only this command'}</span>
          </div>
        </button>

        {/* Session Approval */}
        <button
          onClick={() => onApproval(true, 'session')}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white transition-colors group"
        >
          <HiOutlineShieldCheck className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600" />
          <div className="flex-1 min-w-0">
            {/* Same weight as "Allow once": this grant is the broader of the two,
                and rendering it lighter made the wider permission read as the
                more casual choice. The consequence is spelled out rather than
                implied by the words "for this session". */}
            <span className="text-sm font-semibold text-neutral-800">Trust {toolName || 'this tool'}</span>
            <span className="text-xs text-neutral-500 ml-2">for this session</span>
            <span className="block text-xs text-neutral-500">Won&apos;t ask again this conversation</span>
          </div>
        </button>

        <div className="mx-3 my-1 border-t border-neutral-100" />

        {/* Reject/Stop actions */}
        <div className="flex flex-wrap items-center">
          <button
            onClick={() => onApproval(false, 'once', 'reject_soft')}
            className="flex-1 min-w-[7.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-white transition-colors"
          >
            <HiOutlineX className="w-3.5 h-3.5 shrink-0" />
            <span>Reject</span>
            <span className="text-neutral-500">this tool</span>
          </button>
          <div className="w-px h-4 bg-neutral-100" />
          <button
            onClick={() => onApproval(false, 'once', 'reject_hard')}
            className="flex-1 min-w-[7.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-neutral-500 hover:text-red-600 hover:bg-white transition-colors"
          >
            <HiOutlineStop className="w-3.5 h-3.5 shrink-0" />
            <span>Stop</span>
            <span className="text-neutral-500">all & redirect</span>
          </button>
          <div className="w-px h-4 bg-neutral-100" />
          <button
            onClick={() => onApproval(false, 'once', 'reject_explain')}
            className="flex-1 min-w-[7.5rem] flex items-center justify-center gap-1.5 py-2.5 text-xs text-neutral-500 hover:text-neutral-800 hover:bg-white transition-colors"
            title="I don't understand - please explain this action"
          >
            <HiOutlineQuestionMarkCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Explain</span>
            <span className="text-neutral-500">why?</span>
          </button>
        </div>
      </div>

      {batchRemaining && batchRemaining.length > 0 && (
        <div className="px-3 py-2.5 bg-neutral-100/50 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Up Next ({batchRemaining.length})</span>
          </div>
          <div className="space-y-1.5">
            {batchRemaining.map((t, i) => {
              const summary = getToolSummary(t.tool, t.arguments)
              return (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono leading-tight">
                  <span className="text-neutral-300 mt-0.5">$</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-neutral-800 font-semibold mr-2">{t.tool}</span>
                    <span className="text-neutral-500 truncate inline-block w-full">{summary}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
