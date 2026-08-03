/**
 * Turning a skill's description into something worth tapping.
 *
 * Lived in app/[address]/page.tsx while the landing page was the only surface
 * with an opening screen. The empty session needs the same three openers — it is
 * the screen every visitor sees after passing a gate — so it moved here, beside
 * the component that renders them, rather than being duplicated.
 */

/** The offer that always applies, whatever the agent turns out to do.
 *
 *  It leads the chip row on both surfaces: skill-derived offers only help a
 *  reader who already knows roughly what they want, and the person staring at a
 *  fresh session — usually one second after being let through an invite gate —
 *  is precisely the one who does not. One definition, because it was a bare
 *  string on the landing page and simply absent from the empty session. */
export const UNIVERSAL_OPENER = 'What can you do?'

/** A chip is a speech act — it must complete "Help me ___". Extract a short
 *  imperative from the skill description's opening (cutting at the first
 *  clause boundary), or return null so command-named skills stay off the
 *  chip row entirely rather than leaking identifiers into it. */
export function chipOffer(skill: { name: string; description?: string }): string | null {
  const first = (skill.description || '').split(/(?<=[.!?])\s/)[0]
  if (!first) return null
  let cut = first
  for (const b of [', ', '; ', ' — ', ' - ', ' in the ', ' through ', ' via ', ' using ', ' by ', ' from ', ' so ', ' and then ']) {
    const idx = cut.indexOf(b)
    if (idx > 0 && cut.slice(0, idx).split(' ').length >= 4) cut = cut.slice(0, idx)
  }
  cut = cut.replace(/[.!?,;:]\s*$/, '').trim()
  const words = cut.split(' ')
  // A clean offer, or no chip at all: reject over-long cuts and dangling endings
  if (cut.length > 48 || words.length < 2) return null
  if (/^(a|an|the|to|of|in|into|on|or|and|for|with|by|from)$/i.test(words[words.length - 1])) return null
  return fixBrandCase(cut)
}

function fixBrandCase(text: string): string {
  return text.replace(/linkedin/gi, 'LinkedIn').replace(/github/gi, 'GitHub').replace(/youtube/gi, 'YouTube')
}

// Chips are the agent's three BEST offers, not its three most parseable ones:
// internal/debug utilities never make the handshake row, and offers that lead
// with a payoff verb outrank ones that lead with mechanism.
const INTERNAL_SKILL = /debug|capture|not for direct|called by other skills|internal/i
const GOAL_VERB = /^(publish|post|submit|send|create|write|draft|schedule|generate|search|find|reply|engage|react|comment|log|translate|summarize|analyze|review|build|make|plan|book)\b/i

export function bestOffers(skills: { name: string; description?: string }[]) {
  return skills
    .filter(s => !INTERNAL_SKILL.test(s.name) && !INTERNAL_SKILL.test(s.description || ''))
    .map(skill => ({ skill, offer: chipOffer(skill) }))
    .filter((x): x is { skill: (typeof skills)[number]; offer: string } => x.offer !== null)
    .sort((a, b) =>
      Number(!GOAL_VERB.test(a.offer)) - Number(!GOAL_VERB.test(b.offer)) ||
      a.offer.length - b.offer.length)
    .slice(0, 3)
}
