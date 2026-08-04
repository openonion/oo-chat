/**
 * Hold a scroll container at its bottom while its content is still settling.
 *
 * The naive form — `el.scrollTop = el.scrollHeight` inside a ResizeObserver — is
 * wrong in a way that only shows under load, and #113 measured it exactly: the
 * pin ran while the content was 1012px tall, `scrollTop` clamped to 544, the
 * content then grew its last 100px to 1112, and no further pin ran. The
 * transcript rested 100px short of the bottom and stayed there for ten seconds,
 * which on a 468px pane puts the end of the reply below the fold.
 *
 * #98 added one `requestAnimationFrame` re-pin. That is a guess at a frame
 * count: both reads happen before the layout that produces 1112, so it re-reads
 * the stale height and changes nothing.
 *
 * So this keeps pinning until the height has held still for several consecutive
 * frames, not one. One is not enough and the unit test proves it: the measured
 * sequence 1012 → 1012 → 1112 looks settled at the second sample and is not.
 * My first version of this stopped there and reproduced #113 exactly — the same
 * mistake as #98, one frame further along.
 *
 * `stableFrames` is a heuristic with a bound, and worth naming as one rather
 * than dressing up: there is no number of frames that is provably enough. What
 * makes it safe is that guessing high costs only a few no-op assignments, while
 * guessing low costs a reader the end of their answer.
 *
 * `maxFrames` is the backstop: content that grows every frame forever (an
 * animation) must not spin this indefinitely.
 */
export function pinToBottom(
  el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight'>,
  schedule: (cb: () => void) => number,
  shouldContinue: () => boolean,
  options: {
    /** Called immediately before each write, so the scroll event it produces can
     *  be told apart from a gesture. Without this the pin's own landing reads as
     *  the reader scrolling away and turns the pin off — which is what #113
     *  turned out to be. */
    markSelfScroll?: () => void
    /** Called with where the write actually landed, after the browser clamps it,
     *  so a scroll event at that exact position can be recognised as this pin's
     *  own echo rather than a gesture. */
    onPinned?: (top: number) => void
    maxFrames?: number
    stableFrames?: number
  } = {},
): number | null {
  const {
    markSelfScroll = () => {},
    onPinned = () => {},
    maxFrames = 30,
    stableFrames = 4,
  } = options
  let lastHeight = -1
  let steady = 0
  let frames = 0

  const step = (): number | null => {
    if (!shouldContinue()) return null

    const height = el.scrollHeight
    markSelfScroll()
    el.scrollTop = height
    onPinned(Math.round(el.scrollTop))

    // Several consecutive unchanged heights, not one. A single stable sample is
    // exactly what the 1012 -> 1012 -> 1112 sequence produces before it grows.
    if (height === lastHeight) {
      if (++steady >= stableFrames) return null
    } else {
      steady = 0
      lastHeight = height
    }

    if (++frames >= maxFrames) return null
    return schedule(() => { step() })
  }

  return step()
}
