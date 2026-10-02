/**
 * @purpose Tell "the reader was replaced" from "the frame loaded its blank
 *   document first" for the private co rem's iframe.
 * @llm-note The first backstop counted loads and called a second one a
 *   navigation. An iframe given its srcdoc after it is in the page loads
 *   about:blank first, in Chromium and in WebKit, so a reader that never moved
 *   showed "The co rem tried to leave this page" (2026-10-01). The guard we put
 *   in front of the reader now says READY_MESSAGE on each of its own loads; a
 *   load is a navigation only if the reader had said ready before, and did not
 *   say it again within READY_WINDOW_MS of that load.
 */

export const READY_MESSAGE = 'oo-rem-ready'
export const READY_WINDOW_MS = 250

export function createFrameWatch() {
  let lastReady = Number.NEGATIVE_INFINITY
  let everReady = false
  return {
    /** The reader's guard said it loaded, at `now`. */
    ready(now: number) {
      everReady = true
      lastReady = now
    },
    /** Asked READY_WINDOW_MS after a load at `loadAt`: was that load something other than the reader? */
    leftAfter(loadAt: number): boolean {
      return everReady && Math.abs(lastReady - loadAt) > READY_WINDOW_MS
    },
  }
}
