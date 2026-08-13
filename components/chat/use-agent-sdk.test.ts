import { describe, expect, it } from 'vitest'
import type { ChatItem } from '@connectonion/react'

import { extractPendingStates } from './use-agent-sdk'

const runningTool: ChatItem = {
  id: 'tool-1',
  type: 'tool_call',
  name: 'write',
  args: { path: 'release.txt' },
  status: 'running',
}

function approval(answered?: boolean): ChatItem {
  return {
    id: 'permission-1',
    type: 'approval_needed',
    tool: 'write',
    arguments: { path: 'release.txt' },
    ...(answered === undefined ? {} : { answered }),
  }
}

describe('extractPendingStates', () => {
  it('keeps an unanswered approval attached to its running tool', () => {
    expect(extractPendingStates([runningTool, approval()]).pendingApproval).toEqual({
      tool: 'write',
      arguments: { path: 'release.txt' },
    })
  })

  it('clears an answered approval even before the tool receives a terminal update', () => {
    expect(extractPendingStates([runningTool, approval(true)]).pendingApproval).toBeNull()
  })
})
