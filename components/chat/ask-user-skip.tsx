'use client'

// Shared by every ask_user surface (login-card, ask-user-card, chat-ask-user):
// one sentinel answer string the agent reads as "proceed without this", and
// the button that sends it.
export const ASK_USER_SKIP_ANSWER =
  'User skipped this question and will not answer. Proceed without this information; do not ask again.'

export function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="w-full text-xs font-medium text-neutral-400 hover:text-neutral-600 py-1 transition-colors"
    >
      Skip this question
    </button>
  )
}
