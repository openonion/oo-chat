export interface BriefingSection {
  title: string
  body: string
}

export interface ReplyDraft {
  draftId: string
  messageId: string
  subject: string
  from: string
  draftBody: string
  originalEmail?: string
}

export interface MeetingProposal {
  title?: string
  date?: string
  start_time?: string
  end_time?: string
  location?: string
  attendees?: string
  is_video_call?: boolean
  meeting_id?: string
}

export interface BriefingData {
  scanSince?: number
  scanUntil?: number
  provider?: string
  messagesSeen?: number
  briefingSections: BriefingSection[]
  summary: string
  drafts?: ReplyDraft[]
  meetings?: MeetingProposal[]
}

export interface PriorityEmailCounts {
  high: number
  medium: number
  low: number
}

export type DraftListRow =
  | { kind: 'draft'; draft: ReplyDraft }
  | { kind: 'deleted'; draftId: string; subject: string }

export type MeetingListRow =
  | { kind: 'meeting'; meeting: MeetingProposal }
  | { kind: 'removed'; meetingId: string; title: string }
