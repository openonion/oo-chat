'use client'

import { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight, HiOutlineCursorClick, HiOutlineX } from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'

interface BrowserCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

/** Args often carry JSON-as-string fields (args_json) — unwrap them so the
 *  panel shows real structure instead of a wall of \" escapes. */
function prettyArgs(args: Record<string, unknown>): string {
  const unwrapped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    unwrapped[k] = typeof v === 'string' ? maybeParse(v) : v
  }
  return JSON.stringify(unwrapped, null, 2)
}

function maybeParse(text: string): unknown {
  const t = text.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return text
  try {
    return JSON.parse(t)
  } catch {
    return text
  }
}

function prettyResult(result: string): string {
  const t = result.trim()
  // Base64 blobs (e.g. take_screenshot returns image bytes) are noise as text —
  // the image itself already renders as its own transcript item.
  if (t.length > 200 && /^[A-Za-z0-9+/=]+$/.test(t.slice(0, 400))) {
    return `[binary data · ${Math.round((t.length * 3) / 4 / 1024)} KB]`
  }
  const parsed = maybeParse(result)
  return typeof parsed === 'string' ? result : JSON.stringify(parsed, null, 2)
}

/** Browser tool names → this card. Keep in sync with the SDK's browser toolkit. */
export const BROWSER_TOOLS = new Set([
  'go_to', 'open_browser', 'newtab', 'close_tab', 'get_current_url',
  'click', 'double_click', 'right_click', 'hover', 'mouse_click',
  'scroll', 'wait', 'set_viewport',
  'take_screenshot', 'save_page_context', 'save_state',
  'run_page_script', 'run_frame_script',
  'extract_data', 'extract_items_by_selector', 'get_text', 'get_links_from_page',
  'get_element_text_by_selector', 'count_elements_by_selector', 'find_element_by_description',
  'type_text_by_selector', 'keyboard_type', 'keyboard_press',
  'select_option', 'check_checkbox',
  'click_element_by_selector', 'click_element_near_selector',
  'upload_file_by_selector', 'upload_file_after_click_by_selector',
])

/** One human-readable line per browser action: verb + single-line detail. */
function describeAction(name: string, args: Record<string, unknown> = {}): { verb: string; detail: string } {
  const s = (k: string) => (args[k] != null ? String(args[k]) : '')
  switch (name) {
    case 'go_to': return { verb: 'Open', detail: s('url') }
    case 'open_browser': return { verb: 'Open browser', detail: '' }
    case 'newtab': return { verb: 'New tab', detail: s('url') }
    case 'close_tab': return { verb: 'Close tab', detail: s('key') }
    case 'get_current_url': return { verb: 'Get URL', detail: '' }
    case 'click':
    case 'click_element_by_selector':
    case 'click_element_near_selector':
      return { verb: 'Click', detail: s('description') || s('selector') || s('target_selector') }
    case 'double_click': return { verb: 'Double-click', detail: s('description') }
    case 'right_click': return { verb: 'Right-click', detail: s('description') }
    case 'hover': return { verb: 'Hover', detail: s('description') }
    case 'mouse_click': return { verb: 'Click at', detail: `${s('x')}, ${s('y')}` }
    case 'scroll': return { verb: 'Scroll', detail: s('description') }
    case 'wait': return { verb: 'Wait', detail: `${s('seconds')}s` }
    case 'set_viewport': return { verb: 'Viewport', detail: `${s('width')}×${s('height')}` }
    case 'take_screenshot': return { verb: 'Screenshot', detail: basename(s('path')) }
    case 'save_page_context': return { verb: 'Save page context', detail: s('name') }
    case 'save_state': return { verb: 'Save login state', detail: basename(s('path')) }
    case 'run_page_script':
    case 'run_frame_script': {
      // Full args live in the expanded panel — the row shows the script name only.
      const argsJson = s('args_json')
      const hasArgs = argsJson && argsJson !== '{}'
      return { verb: 'Run script', detail: `${basename(s('script_path'))}${hasArgs ? ' · args' : ''}` }
    }
    case 'extract_data': return { verb: 'Extract', detail: s('selector') }
    case 'extract_items_by_selector': return { verb: 'Extract items', detail: s('container_selector') }
    case 'get_text': return { verb: 'Read page text', detail: '' }
    case 'get_links_from_page': return { verb: 'Extract links', detail: s('domain_filter') }
    case 'get_element_text_by_selector': return { verb: 'Read element', detail: s('selector') }
    case 'count_elements_by_selector': return { verb: 'Count elements', detail: s('selector') }
    case 'find_element_by_description': return { verb: 'Find element', detail: s('description') }
    case 'type_text_by_selector':
    case 'keyboard_type':
      return { verb: 'Type', detail: s('text') }
    case 'keyboard_press': return { verb: 'Press', detail: s('key') }
    case 'select_option': return { verb: 'Select', detail: `${s('option')} in ${s('field_description')}` }
    case 'check_checkbox': return { verb: 'Check', detail: s('description') }
    case 'upload_file_by_selector':
    case 'upload_file_after_click_by_selector':
      return { verb: 'Upload', detail: basename(s('file_path')) }
    default: return { verb: name, detail: Object.values(args).map(String).join(', ') }
  }
}

export function BrowserCard({ toolCall, pendingApproval, onApprovalResponse }: BrowserCardProps) {
  const { name, args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)

  const needsApproval = !!pendingApproval && !!onApprovalResponse

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    else setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode)
  }

  const { verb, detail: rawDetail } = describeAction(name.toLowerCase(), args)
  const detail = rawDetail.length > 120 ? rawDetail.slice(0, 120) : rawDetail
  const hasOutput = result && result.length > 0
  const hasArgs = args && Object.keys(args).length > 0
  const isError = status === 'error'

  return (
    // The left rail: consecutive browser rows abut into one continuous line,
    // reading as a single automation block without any sibling logic.
    <div className="relative pl-2 before:absolute before:left-0 before:inset-y-0 before:w-0.5 before:bg-neutral-200">
      <div
        className={`flex h-7 items-center gap-1.5 cursor-pointer select-none rounded-md px-1.5 -mr-1.5 py-1 -my-1 ${isError ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-neutral-100/70'}`}
        onClick={() => (hasOutput || hasArgs || needsApproval) && setIsExpanded(!isExpanded)}
      >
        {(hasOutput || hasArgs || needsApproval) ? (
          <HiOutlineChevronRight className={`w-3 h-3 shrink-0 text-neutral-300 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon slot doubles as status: quiet icon when done, pulsing dot while live, red X on error */}
        {isError ? (
          <HiOutlineX className="w-4 h-4 shrink-0 text-red-500" />
        ) : status === 'running' ? (
          <span className={`mx-[5px] h-1.5 w-1.5 shrink-0 rounded-full animate-pulse ${needsApproval && !approvalSent ? 'bg-neutral-400' : 'bg-brand-500'}`} />
        ) : (
          <HiOutlineCursorClick className="w-4 h-4 shrink-0 text-neutral-400" />
        )}

        <span className={`text-[13px] font-medium shrink-0 whitespace-nowrap ${isError ? 'text-red-600' : 'text-neutral-800'}`}>{verb}</span>
        {detail && <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-500">{detail}</span>}

        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] tabular-nums text-neutral-400">
          {needsApproval && status === 'running' && !approvalSent ? (
            <span className="font-medium text-neutral-500">awaiting approval</span>
          ) : status === 'running' ? (
            'running…'
          ) : timing_ms ? (
            formatTime(timing_ms)
          ) : null}
        </span>
      </div>

      {/* Collapsed error rows surface the failure reason inline — one truncated line */}
      {isError && hasOutput && !isExpanded && (
        <div className="ml-7 mb-1 truncate text-xs text-red-600/80">{result.split('\n')[0]}</div>
      )}

      {needsApproval && status === 'running' && (
        <div className="mt-2 ml-5 mb-2">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName={name} description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}

      {!needsApproval && isExpanded && (hasArgs || hasOutput) && (
        <div className="mb-1 ml-7 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {hasArgs && (
            <div className={`px-2.5 py-2 ${hasOutput ? 'border-b border-neutral-100' : ''}`}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Arguments</div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-600 max-h-40 overflow-y-auto">
                {prettyArgs(args)}
              </pre>
            </div>
          )}
          {hasOutput && (
            <div className={`px-2.5 py-2 ${isError ? 'bg-red-50/50' : ''}`}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">Result</div>
              <pre className={`whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-72 overflow-y-auto ${isError ? 'text-red-700' : 'text-neutral-700'}`}>
                {prettyResult(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
