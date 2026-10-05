/**
 * @purpose Tell "the reader was replaced" from loads that are still the reader,
 *   for the private co rem's iframe.
 * @llm-note Two loads are not navigation. An iframe given its srcdoc loads
 *   about:blank first (2026-10-01), and WebKit fires a load on the iframe when
 *   the reader sets location.hash for a link, with no load inside it, so a
 *   phone blocked the first tap on a person (2026-10-05). After every load
 *   RemFrame pings the frame; the guard in front of the reader answers
 *   READY_MESSAGE, as it does on its own loads. A load is a navigation only if
 *   the reader had said ready before and has not said it since shortly before
 *   that load, READY_WAIT_MS later. A replaced document has no guard to answer.
 */

export const READY_MESSAGE = 'oo-rem-ready'
export const PING_MESSAGE = 'oo-rem-ping'
export const READY_WAIT_MS = 1500
const READY_BEFORE_MS = 250

export function createFrameWatch() {
  let lastReady = Number.NEGATIVE_INFINITY
  let everReady = false
  return {
    /** The reader's guard said it is there, at `now`. */
    ready(now: number) {
      everReady = true
      lastReady = now
    },
    /** Asked READY_WAIT_MS after a load at `loadAt`: was that load something other than the reader? */
    leftAfter(loadAt: number): boolean {
      return everReady && lastReady < loadAt - READY_BEFORE_MS
    },
  }
}
