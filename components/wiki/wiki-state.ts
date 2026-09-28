/**
 * @purpose Turn what the Host (or the lack of one) said about a Wiki read into
 *   one of a few states the reader can act on.
 * @llm-note The strings matched here are the Host's own WIKI_RESULT errors
 *   (connectonion/network/host/ws_router/wiki.py) and the SDK's session-request
 *   errors. Matching is deliberately loose: an unrecognised message falls
 *   through to `failed`, which still shows the message and a retry, so a
 *   reworded Host error degrades to a less specific next step, never to a
 *   blank page.
 */

export type WikiProblem =
  /** The Host is not connected to the relay, or the address is not a live agent. */
  | { kind: 'offline' }
  /** This browser is not an administrator of the Host. */
  | { kind: 'denied' }
  /** The Host is up but has no notebook at its Wiki root. */
  | { kind: 'unavailable' }
  /** The Host predates signed Wiki reads. */
  | { kind: 'outdated' }
  /** The notebook rendered past the Host's size bound. */
  | { kind: 'too-large' }
  | { kind: 'failed'; message: string }

export function classifyWikiError(cause: unknown): WikiProblem {
  const message = cause instanceof Error ? cause.message : String(cause ?? '')
  const code = (cause as { code?: unknown } | null)?.code
  if (/only to the Host owner|Authentication required|Signed Wiki request required/i.test(message)) {
    return { kind: 'denied' }
  }
  if (/not available on this Host/i.test(message)) return { kind: 'unavailable' }
  if (/16 MiB|exceeds/i.test(message)) return { kind: 'too-large' }
  if (code === 'unsupported_extension' || /session-sync\/0\.1/i.test(message)) {
    return { kind: 'outdated' }
  }
  if (/not connected|offline|not found|no route/i.test(message)) return { kind: 'offline' }
  return { kind: 'failed', message: message || 'The Wiki could not be loaded.' }
}
