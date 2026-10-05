import { describe, expect, it } from 'vitest'
import { createFrameWatch, READY_WAIT_MS } from './frame-watch'

describe('createFrameWatch', () => {
  it('ignores the blank document a frame loads before its srcdoc', () => {
    // An iframe given its srcdoc after it is in the page fires load twice in
    // Chromium (about:blank, then the reader), and WebKit does it anyway. The
    // owner saw "The co rem tried to leave this page" on a reader that had not
    // moved (2026-10-01).
    const watch = createFrameWatch()
    const blank = 1000
    const reader = 1040
    watch.ready(1035)
    expect(watch.leftAfter(blank)).toBe(false)
    expect(watch.leftAfter(reader)).toBe(false)
  })

  it('ignores a load that comes before the reader has ever said it is ready', () => {
    const watch = createFrameWatch()
    expect(watch.leftAfter(1000)).toBe(false)
  })

  it('flags a load long after the reader was ready, with no ready of its own', () => {
    const watch = createFrameWatch()
    watch.ready(1000)
    expect(watch.leftAfter(1000 + 30_000)).toBe(true)
  })

  it('does not flag the reader loading again when it says it is ready again', () => {
    const watch = createFrameWatch()
    watch.ready(1000)
    watch.ready(9000)
    expect(watch.leftAfter(9000 - 100)).toBe(false)
  })

  it('does not flag the load WebKit fires for a hash link, answered slowly', () => {
    // In WebKit a sandboxed srcdoc frame that sets location.hash gets its
    // hashchange and then a load event on the iframe, with no load inside it.
    // On a phone the guard's answer to the ping came 600 ms later, and the
    // owner's first tap on a person was blocked (2026-10-05).
    const watch = createFrameWatch()
    watch.ready(1000)
    const hashLoad = 9000
    watch.ready(hashLoad + 600)
    expect(watch.leftAfter(hashLoad)).toBe(false)
    expect(READY_WAIT_MS).toBeGreaterThan(600)
  })
})
