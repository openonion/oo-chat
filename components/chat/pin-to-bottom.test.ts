import { describe, it, expect } from 'vitest'
import { pinToBottom } from './pin-to-bottom'

/** A scroll container whose height grows on a schedule, the way a real one does
 *  when a late layout lands. `scrollTop` clamps like a browser's, which is the
 *  detail that made #113 hard to see: assigning `scrollHeight` does not put you
 *  at the bottom of a box that is about to get taller. */
function scroller(heights: number[], clientHeight = 468) {
  let frame = 0
  const el = {
    _top: 0,
    get scrollHeight() {
      return heights[Math.min(frame, heights.length - 1)]
    },
    get scrollTop() {
      return this._top
    },
    set scrollTop(v: number) {
      this._top = Math.min(v, Math.max(0, this.scrollHeight - clientHeight))
    },
  }
  const pending: (() => void)[] = []
  const schedule = (cb: () => void) => {
    pending.push(cb)
    return pending.length
  }
  const advance = () => {
    frame++
    const due = pending.splice(0, pending.length)
    for (const cb of due) cb()
  }
  const gap = () => el.scrollHeight - el.scrollTop - clientHeight
  return { el, schedule, advance, gap }
}

describe('pinToBottom', () => {
  it('reaches the bottom of content that stops growing immediately', () => {
    const s = scroller([1112])
    pinToBottom(s.el, s.schedule, () => true)
    expect(s.gap()).toBe(0)
  })

  it('catches up when the content grows after the pin — #113', () => {
    // The measured failure: pinned while the content was 1012 tall, which clamps
    // scrollTop to 544; the content then reached 1112, whose bottom is 644. The
    // old code pinned once more on the next frame and still read 1012, so it
    // stopped 100px short and stayed there.
    const s = scroller([1012, 1012, 1112])

    pinToBottom(s.el, s.schedule, () => true)
    expect(s.el.scrollTop, 'the first pin should clamp to the height it can see').toBe(544)

    s.advance()
    s.advance()

    expect(s.el.scrollTop, 'never caught up with the late growth').toBe(644)
    expect(s.gap()).toBe(0)
  })

  it('keeps up with content that grows over many frames', () => {
    // A slow device delivering a long reply in pieces. Nothing here should
    // depend on how many frames it takes.
    const s = scroller([300, 500, 700, 900, 1112])
    pinToBottom(s.el, s.schedule, () => true)
    for (let i = 0; i < 6; i++) s.advance()
    expect(s.gap()).toBe(0)
  })

  it('stops once the height has been still for a few frames', () => {
    // A pin that never stops is a loop running for the life of the session. The
    // requirement is that it stops soon, not that it stops on a particular
    // frame — this assertion asked for the latter and had to be corrected when
    // the stop condition moved from one stable frame to several.
    const s = scroller([1112])
    let scheduled = 0
    pinToBottom(s.el, cb => { scheduled++; return s.schedule(cb) }, () => true)
    for (let i = 0; i < 12; i++) s.advance()
    expect(scheduled, 'kept scheduling after the content settled').toBeLessThanOrEqual(6)
  })

  it('does nothing when the reader has scrolled away', () => {
    // The whole point of the stick-to-bottom flag: never yank someone back down.
    const s = scroller([1012, 1112])
    s.el.scrollTop = 0
    pinToBottom(s.el, s.schedule, () => false)
    expect(s.el.scrollTop).toBe(0)
  })

  it('gives up rather than spinning on content that never settles', () => {
    // An animation would otherwise keep this rescheduling forever.
    const forever = Array.from({ length: 500 }, (_, i) => 300 + i * 10)
    const s = scroller(forever)
    pinToBottom(s.el, s.schedule, () => true, { maxFrames: 5 })
    for (let i = 0; i < 50; i++) s.advance()
    // Bounded: it stopped on its own rather than following the growth forever.
    expect(s.el.scrollTop).toBeLessThan(s.el.scrollHeight)
  })
})
