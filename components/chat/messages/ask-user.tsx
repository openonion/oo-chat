import type { AskUserUI } from '../types'

// ask_user interaction is rendered inline in the ask_user tool card (ask-user-card.tsx)
// This message-level component is kept for backward compatibility but renders nothing
export function AskUser({ question: _question }: { question: AskUserUI }) {
  return null
}
